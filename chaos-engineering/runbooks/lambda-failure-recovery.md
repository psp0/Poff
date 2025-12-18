# Runbook: Lambda Function Failure Recovery

## 📋 Overview

**Incident Type:** Lambda Function Failure  
**Severity:** HIGH  
**Response Time:** 15 minutes  
**Recovery Time Objective (RTO):** 30 minutes  
**Recovery Point Objective (RPO):** 0 (stateless)  

## 🚨 Symptoms

- API Gateway returning 502/503 errors
- CloudWatch Logs showing Lambda errors/timeouts
- Increased error rates in monitoring dashboards
- User reports of functionality not working

## 🔍 Diagnosis

### Step 1: Identify Affected Function

```bash
# List recent Lambda errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/pokehabit-prod-pokemon-management \
  --start-time $(date -d '10 minutes ago' +%s000) \
  --filter-pattern "ERROR"
```

### Step 2: Check Function Health

```bash
# Get function configuration
aws lambda get-function --function-name pokehabit-prod-pokemon-management

# Check concurrent executions
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name ConcurrentExecutions \
  --dimensions Name=FunctionName,Value=pokehabit-prod-pokemon-management \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Maximum
```

### Step 3: Check Dependencies

```bash
# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier pokehabit-prod-mysql \
  --query 'DBInstances[0].DBInstanceStatus'

# Check VPC connectivity (if applicable)
# Check Security Groups
# Check Environment Variables
```

## 🔧 Resolution Steps

### Scenario 1: Function Code Error

**Symptoms:** High error rate, specific error pattern in logs

**Resolution:**
1. Check recent deployments
   ```bash
   aws lambda list-versions-by-function \
     --function-name pokehabit-prod-pokemon-management
   ```

2. Rollback to previous version
   ```bash
   # Get previous version number from list
   PREVIOUS_VERSION=3
   
   aws lambda update-alias \
     --function-name pokehabit-prod-pokemon-management \
     --name prod \
     --function-version $PREVIOUS_VERSION
   ```

3. Verify rollback
   ```bash
   aws lambda get-alias \
     --function-name pokehabit-prod-pokemon-management \
     --name prod
   ```

4. Monitor error rates for 5-10 minutes
5. Trigger production rollback workflow if needed:
   ```bash
   gh workflow run rollback-production.yml
   ```

### Scenario 2: Concurrency Limit Reached

**Symptoms:** Throttling errors, 429 responses

**Resolution:**
1. Check current concurrency
   ```bash
   aws lambda get-function-concurrency \
     --function-name pokehabit-prod-pokemon-management
   ```

2. Increase reserved concurrency (temporary)
   ```bash
   aws lambda put-function-concurrency \
     --function-name pokehabit-prod-pokemon-management \
     --reserved-concurrent-executions 200
   ```

3. Monitor for 10 minutes
4. Plan permanent increase if needed

### Scenario 3: Timeout Issues

**Symptoms:** Function timing out frequently

**Resolution:**
1. Check current timeout setting
   ```bash
   aws lambda get-function-configuration \
     --function-name pokehabit-prod-pokemon-management \
     --query 'Timeout'
   ```

2. Increase timeout (if appropriate)
   ```bash
   aws lambda update-function-configuration \
     --function-name pokehabit-prod-pokemon-management \
     --timeout 30
   ```

3. Investigate root cause:
   - Slow database queries
   - External API delays
   - Memory constraints

### Scenario 4: Memory Issues

**Symptoms:** Out of memory errors, slow execution

**Resolution:**
1. Check memory usage
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Duration \
     --dimensions Name=FunctionName,Value=pokehabit-prod-pokemon-management \
     --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Average,Maximum
   ```

2. Increase memory allocation
   ```bash
   aws lambda update-function-configuration \
     --function-name pokehabit-prod-pokemon-management \
     --memory-size 512
   ```

### Scenario 5: Cold Start Issues

**Symptoms:** Intermittent slow responses, timeout on first invocation

**Resolution:**
1. Enable provisioned concurrency
   ```bash
   aws lambda put-provisioned-concurrency-config \
     --function-name pokehabit-prod-pokemon-management \
     --provisioned-concurrent-executions 5 \
     --qualifier prod
   ```

2. Monitor improvement

## ✅ Verification

### Post-Recovery Checks

1. **Test Function Manually**
   ```bash
   aws lambda invoke \
     --function-name pokehabit-prod-pokemon-management \
     --payload '{"test": true}' \
     response.json
   cat response.json
   ```

2. **Check Error Rates**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --dimensions Name=FunctionName,Value=pokehabit-prod-pokemon-management \
     --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

3. **Monitor CloudWatch Dashboard** for 15 minutes

4. **Test User-Facing Functionality**
   - Open application
   - Test affected features
   - Verify no errors in browser console

## 📊 Post-Incident Actions

### Immediate (Within 1 hour)
- [ ] Document incident timeline
- [ ] Notify stakeholders of resolution
- [ ] Create tracking issue in GitHub

### Short-term (Within 24 hours)
- [ ] Analyze CloudWatch Logs for root cause
- [ ] Review and update monitoring/alerting
- [ ] Create action items for prevention

### Long-term (Within 1 week)
- [ ] Conduct post-mortem meeting
- [ ] Update runbooks with lessons learned
- [ ] Implement preventive measures
- [ ] Update documentation

## 📞 Escalation

### Level 1: On-Call Engineer
- Initial diagnosis and common fixes
- Response time: 15 minutes

### Level 2: Senior DevOps Engineer
- Complex issues, architectural decisions
- Response time: 30 minutes

### Level 3: System Architect
- Critical system-wide issues
- Response time: 1 hour

## 📚 Related Runbooks

- [Database Failure Recovery](./database-failure-recovery.md)
- [API Gateway Issues](./api-gateway-issues.md)
- [Complete System Outage](./system-outage-recovery.md)

## 🔗 Useful Links

- [CloudWatch Dashboard](https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#dashboards:)
- [Lambda Console](https://console.aws.amazon.com/lambda/home?region=ap-northeast-2)
- [Datadog Dashboard](https://app.datadoghq.com/)
- [GitHub Actions](https://github.com/psp0/PokeHabit/actions)

## 📝 Notes

- Always test in dev environment first if possible
- Document all changes made during incident
- Consider enabling Lambda X-Ray for detailed tracing
- Keep this runbook updated with new scenarios
