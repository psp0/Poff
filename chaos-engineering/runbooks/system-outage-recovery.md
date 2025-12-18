# Runbook: Complete System Outage Recovery

## 📋 Overview

**Incident Type:** Complete System Outage  
**Severity:** CRITICAL  
**Response Time:** IMMEDIATE  
**Recovery Time Objective (RTO):** 2 hours  
**Recovery Point Objective (RPO):** 5 minutes  

## 🚨 Symptoms

- All application services unavailable
- API Gateway returning errors
- Multiple CloudWatch alarms triggered
- User reports of complete unavailability
- Health checks failing across all services

## 🔍 Initial Assessment

### Step 1: Confirm Outage Scope

```bash
# Check all critical services
echo "=== Service Health Check ==="

# API Gateway
aws apigateway get-rest-apis --query 'items[?name==`pokehabit-prod-api`].id' --output text

# Lambda Functions
for func in pokemon-management exercise-management user-management; do
  echo "Checking ${func}..."
  aws lambda get-function --function-name pokehabit-prod-${func} \
    --query 'Configuration.State' --output text
done

# RDS Database
aws rds describe-db-instances \
  --db-instance-identifier pokehabit-prod-mysql \
  --query 'DBInstances[0].DBInstanceStatus' --output text

# CloudFront Distribution
CLOUDFRONT_DISTRIBUTION_ID=$(aws ssm get-parameter \
  --name /pokehabit/prod/infrastructure/cloudfront_distribution_id \
  --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  aws cloudfront get-distribution \
    --id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --query 'Distribution.Status' --output text
fi
```

### Step 2: Check AWS Service Health

```bash
# Check AWS Service Health Dashboard
# https://status.aws.amazon.com/

# Check for regional issues
aws health describe-events \
  --filter eventTypeCategories=issue,accountSpecific \
  --region us-east-1
```

### Step 3: Review Recent Changes

```bash
# Check recent deployments
gh run list --workflow deploy-production.yml --limit 5

# Check recent Terraform changes
cd terraform/environments/prod
git log --oneline -10

# Check recent Lambda updates
aws lambda list-versions-by-function \
  --function-name pokehabit-prod-pokemon-management \
  --max-items 5
```

## 🔧 Recovery Procedures

### Priority 1: Database (Highest Priority)

Database must be recovered first as all other services depend on it.

**Check Database Status:**
```bash
DB_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier pokehabit-prod-mysql \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text)

echo "Database Status: ${DB_STATUS}"
```

**If Database is Down:**
1. Follow [Database Failure Recovery](./database-failure-recovery.md)
2. Wait for database to be fully available before proceeding
3. Verify connectivity:
   ```bash
   # From bastion/SSM
   mysql -h <endpoint> -u admin -p -e "SELECT 1;"
   ```

### Priority 2: Lambda Functions

**Check and Restore Lambda Functions:**
```bash
# Check all Lambda functions
FUNCTIONS=(
  "pokemon-management"
  "exercise-management"
  "user-management"
  "exercise-rewards"
  "pokemon-collection"
  "egg-management"
  "screen-time-management"
  "guest-mode"
)

for func in "${FUNCTIONS[@]}"; do
  echo "Checking pokehabit-prod-${func}..."
  
  STATUS=$(aws lambda get-function \
    --function-name "pokehabit-prod-${func}" \
    --query 'Configuration.State' \
    --output text 2>/dev/null || echo "MISSING")
  
  echo "  Status: ${STATUS}"
  
  if [ "${STATUS}" != "Active" ]; then
    echo "  ⚠️  Function needs attention!"
  fi
done
```

**If Lambda Functions are Failing:**
1. Check concurrency limits
2. Rollback to last known good version
3. Use rollback workflow:
   ```bash
   gh workflow run rollback-production.yml
   ```

### Priority 3: API Gateway

**Check API Gateway:**
```bash
# Get API Gateway details
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='pokehabit-prod-api'].id" \
  --output text)

if [ -n "${API_ID}" ]; then
  echo "API Gateway ID: ${API_ID}"
  
  # Check stage deployment
  aws apigateway get-stage \
    --rest-api-id "${API_ID}" \
    --stage-name prod
else
  echo "❌ API Gateway not found!"
fi
```

**If API Gateway is Down:**
1. Check stage deployment status
2. Redeploy if necessary:
   ```bash
   aws apigateway create-deployment \
     --rest-api-id "${API_ID}" \
     --stage-name prod \
     --description "Emergency redeployment"
   ```

### Priority 4: CloudFront & S3

**Check CloudFront:**
```bash
# List distributions
aws cloudfront list-distributions \
  --query 'DistributionList.Items[*].[Id,Status,DomainName]' \
  --output table

# Check specific distribution
CLOUDFRONT_DISTRIBUTION_ID=$(aws ssm get-parameter \
  --name /pokehabit/prod/infrastructure/cloudfront_distribution_id \
  --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  aws cloudfront get-distribution --id "$CLOUDFRONT_DISTRIBUTION_ID"
fi
```

**If CloudFront has Issues:**
1. Create invalidation:
   ```bash
   CLOUDFRONT_DISTRIBUTION_ID=$(aws ssm get-parameter \
     --name /pokehabit/prod/infrastructure/cloudfront_distribution_id \
     --query 'Parameter.Value' --output text)
   
   aws cloudfront create-invalidation \
     --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
     --paths "/*"
   ```

2. Check S3 bucket:
   ```bash
   aws s3 ls s3://pokehabit-prod-frontend/
   ```

## 🔄 Full System Restore

If all else fails, perform a complete redeployment:

### Option 1: Automated Redeployment

```bash
# Trigger production deployment workflow
gh workflow run deploy-production.yml \
  --ref main \
  -f action=apply \
  -f skip_approval=false \
  -f seed_data=false
```

### Option 2: Manual Terraform Apply

```bash
cd terraform/environments/prod

# Initialize Terraform
terraform init

# Review current state
terraform plan

# Apply if changes look correct
terraform apply
```

### Option 3: Restore from Backup (Last Resort)

This involves complete infrastructure recreation:

1. **Restore Database:**
   ```bash
   # Use latest automated snapshot
   SNAPSHOT_ID=$(aws rds describe-db-snapshots \
     --db-instance-identifier pokehabit-prod-mysql \
     --query 'DBSnapshots[0].DBSnapshotIdentifier' \
     --output text)
   
   # Restore to new instance
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier pokehabit-prod-mysql-restored \
     --db-snapshot-identifier "${SNAPSHOT_ID}"
   ```

2. **Redeploy Infrastructure:**
   ```bash
   cd terraform/environments/prod
   terraform apply -auto-approve
   ```

3. **Redeploy Lambda Functions:**
   ```bash
   gh workflow run deploy-production.yml --ref main
   ```

## ✅ Verification Checklist

After recovery, verify all services:

### 1. Database Verification
```bash
# [ ] Database is running
# [ ] Can connect to database
# [ ] Sample queries work
# [ ] Replication lag is acceptable (if Multi-AZ)
```

### 2. Lambda Verification
```bash
# [ ] All Lambda functions are Active
# [ ] No throttling errors
# [ ] Test invocations succeed
# [ ] CloudWatch Logs show normal activity
```

### 3. API Gateway Verification
```bash
# [ ] API Gateway is deployed
# [ ] All routes are working
# [ ] No throttling
# [ ] CORS configured correctly
```

### 4. Frontend Verification
```bash
# [ ] CloudFront distribution is active
# [ ] S3 bucket is accessible
# [ ] CDN cache is warm
# [ ] SSL certificate is valid
```

### 5. End-to-End Testing
```bash
# Run smoke tests
cd load-tests
npm run test:smoke

# [ ] All smoke tests pass
# [ ] Response times acceptable
# [ ] No errors in browser console
# [ ] Can perform CRUD operations
```

### 6. Monitoring Verification
```bash
# [ ] CloudWatch metrics flowing
# [ ] Datadog receiving data
# [ ] Alarms in OK state
# [ ] No active incidents
```

## 📊 Post-Recovery Actions

### Immediate (Within 1 hour)
1. **Notify Stakeholders**
   ```
   Subject: [RESOLVED] System Outage - All Services Restored
   
   Services have been fully restored as of [TIME].
   - Outage duration: [DURATION]
   - Root cause: [BRIEF DESCRIPTION]
   - Action taken: [SUMMARY]
   
   We will conduct a full post-mortem within 24 hours.
   ```

2. **Document Timeline**
   - When outage started
   - When detected
   - Actions taken
   - When recovered
   - Total downtime

3. **Preserve Evidence**
   - Export CloudWatch Logs
   - Save metrics/graphs
   - Screenshot error messages
   - Archive configuration states

### Short-term (Within 24 hours)
- [ ] Complete incident report
- [ ] Schedule post-mortem meeting
- [ ] Identify root cause
- [ ] Create action items
- [ ] Update runbooks

### Long-term (Within 1 week)
- [ ] Conduct post-mortem
- [ ] Implement preventive measures
- [ ] Update monitoring/alerting
- [ ] Disaster recovery drill
- [ ] Architecture review

## 🚨 Escalation Path

### Level 1: On-Call DevOps Engineer
- **Response Time**: 15 minutes
- **Authority**: Execute recovery procedures
- **Duration**: First 30 minutes

### Level 2: Senior DevOps + Team Lead
- **Response Time**: 30 minutes  
- **Authority**: Make architectural decisions
- **Duration**: If not resolved in 30 minutes

### Level 3: CTO + AWS TAM
- **Response Time**: 1 hour
- **Authority**: All decisions, budget approval
- **Duration**: If not resolved in 1 hour

### External Support
- **AWS Support**: Open Severity 1 ticket
- **Datadog Support**: Critical incident support
- **Third-party Vendors**: As needed

## 📞 Communication Plan

### Internal Communication
- **Slack**: #pokehabit-incidents (create if not exists)
- **Email**: engineering@company.com
- **Phone**: For critical escalations

### External Communication
- **Status Page**: Update status.pokehabit.com
- **Social Media**: Acknowledge issue on Twitter
- **Customer Support**: Provide talking points

### Communication Template
```
[TIMESTAMP] UPDATE: We are experiencing a service outage affecting 
all users. Our team is actively working on resolution. 
Next update in 30 minutes.

Affected Services: All
Status: Investigating | Identified | Monitoring | Resolved
Expected Resolution: TBD
```

## 📚 Related Resources

- [Lambda Failure Recovery](./lambda-failure-recovery.md)
- [Database Failure Recovery](./database-failure-recovery.md)
- [AWS Service Health Dashboard](https://status.aws.amazon.com/)
- [CloudWatch Dashboard](https://console.aws.amazon.com/cloudwatch/)
- [Incident Response Plan](../docs/incident-response-plan.md)

## 🔗 Quick Links

- [Production AWS Console](https://console.aws.amazon.com/)
- [Datadog Dashboard](https://app.datadoghq.com/)
- [GitHub Actions](https://github.com/psp0/PokeHabit/actions)
- [Terraform Cloud](https://app.terraform.io/)
- [Slack Alerts Channel](https://app.slack.com/client/)

## 📝 Recovery Metrics Template

```
Incident ID: INC-YYYY-MM-DD-XXX
Severity: Critical
Start Time: YYYY-MM-DD HH:MM:SS KST
Detection Time: YYYY-MM-DD HH:MM:SS KST
Recovery Time: YYYY-MM-DD HH:MM:SS KST
Total Duration: XX hours XX minutes
MTTD: XX minutes (Mean Time To Detect)
MTTR: XX minutes (Mean Time To Recover)
Affected Users: XXX (estimated)
Revenue Impact: $XXX (if applicable)
Root Cause: [Brief description]
Recovery Method: [Method used]
Lessons Learned: [Key takeaways]
```

## 🎓 Prevention Strategies

To prevent future complete outages:

1. **Multi-Region Deployment** (Future)
   - Active-passive or active-active
   - Cross-region replication
   - Global load balancing

2. **Improved Monitoring**
   - Synthetic monitoring
   - Real user monitoring (RUM)
   - Faster alerting

3. **Circuit Breakers**
   - Service-level circuit breakers
   - Graceful degradation
   - Feature flags

4. **Regular Drills**
   - Monthly chaos engineering
   - Quarterly DR drills
   - Annual full-scale tests

5. **Redundancy**
   - Multi-AZ for all services
   - Read replicas for database
   - Multiple Lambda deployments
