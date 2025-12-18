# Runbook: Database Failure Recovery

## 📋 Overview

**Incident Type:** RDS Database Failure  
**Severity:** CRITICAL  
**Response Time:** 5 minutes  
**Recovery Time Objective (RTO):** 1 hour  
**Recovery Point Objective (RPO):** 5 minutes (automated backups)  

## 🚨 Symptoms

- All API endpoints returning 500 errors
- Database connection errors in Lambda logs
- RDS CloudWatch alarms triggering
- Complete application outage

## 🔍 Diagnosis

### Step 1: Check RDS Instance Status

```bash
# Check instance status
aws rds describe-db-instances \
  --db-instance-identifier pokehabit-prod-mysql \
  --query 'DBInstances[0].[DBInstanceStatus,Engine,DBInstanceClass]'

# Check recent events
aws rds describe-events \
  --source-identifier pokehabit-prod-mysql \
  --source-type db-instance \
  --duration 60
```

### Step 2: Check Connectivity

```bash
# Test connection from Lambda (via SSM to EC2 bastion if available)
aws ssm start-session --target i-xxxxx

# Once in session
mysql -h pokehabit-prod-mysql.xxxxx.ap-northeast-2.rds.amazonaws.com \
  -u admin -p pokehabit

# Check active connections
SELECT * FROM information_schema.processlist;
```

### Step 3: Check CloudWatch Metrics

```bash
# CPU Utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=pokehabit-prod-mysql \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Database Connections
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=pokehabit-prod-mysql \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Free Storage Space
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=pokehabit-prod-mysql \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Minimum
```

## 🔧 Resolution Steps

### Scenario 1: Instance Failed/Stopped

**Symptoms:** Instance status is "stopped" or "failed"

**Resolution:**
1. Check if instance can be restarted
   ```bash
   aws rds start-db-instance \
     --db-instance-identifier pokehabit-prod-mysql
   ```

2. Monitor status
   ```bash
   watch -n 10 'aws rds describe-db-instances \
     --db-instance-identifier pokehabit-prod-mysql \
     --query "DBInstances[0].DBInstanceStatus"'
   ```

3. If restart fails, proceed to restore from snapshot (Scenario 4)

### Scenario 2: Connection Pool Exhausted

**Symptoms:** "Too many connections" errors, high connection count

**Resolution:**
1. Check current connections
   ```bash
   # Via SSM session to bastion
   mysql -h pokehabit-prod-mysql.xxxxx.ap-northeast-2.rds.amazonaws.com \
     -u admin -p -e "SHOW PROCESSLIST;"
   ```

2. Kill idle/sleeping connections
   ```sql
   -- Identify long-running queries
   SELECT * FROM information_schema.processlist 
   WHERE command != 'Sleep' AND time > 300;
   
   -- Kill specific connection
   KILL <connection_id>;
   ```

3. Restart Lambda functions to reset connection pools
   ```bash
   # Update Lambda environment variable to force restart
   for func in pokemon-management exercise-management user-management; do
     aws lambda update-function-configuration \
       --function-name pokehabit-prod-${func} \
       --environment Variables="{RESTART_TIME=$(date +%s)}" \
       --no-cli-pager
   done
   ```

4. Consider increasing max_connections parameter
   ```bash
   # Check current value
   aws rds describe-db-parameters \
     --db-parameter-group-name pokehabit-prod-mysql \
     --query "Parameters[?ParameterName=='max_connections']"
   
   # Increase if needed (requires reboot)
   aws rds modify-db-parameter-group \
     --db-parameter-group-name pokehabit-prod-mysql \
     --parameters "ParameterName=max_connections,ParameterValue=200,ApplyMethod=pending-reboot"
   ```

### Scenario 3: Storage Full

**Symptoms:** Writes failing, "disk full" errors

**Resolution:**
1. Check current storage
   ```bash
   aws rds describe-db-instances \
     --db-instance-identifier pokehabit-prod-mysql \
     --query 'DBInstances[0].[AllocatedStorage,MaxAllocatedStorage]'
   ```

2. Enable storage autoscaling immediately
   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier pokehabit-prod-mysql \
     --max-allocated-storage 200 \
     --apply-immediately
   ```

3. Or increase storage manually
   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier pokehabit-prod-mysql \
     --allocated-storage 100 \
     --apply-immediately
   ```

4. Clean up old data if possible
   ```sql
   -- Delete old logs or temporary data
   DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
   ```

### Scenario 4: Data Corruption / Need to Restore

**Symptoms:** Data integrity issues, unrecoverable errors

**Resolution:**

⚠️ **WARNING: This will result in data loss. Only use as last resort.**

1. Identify latest good snapshot
   ```bash
   aws rds describe-db-snapshots \
     --db-instance-identifier pokehabit-prod-mysql \
     --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
     --output table
   ```

2. Create new instance from snapshot
   ```bash
   SNAPSHOT_ID="pokehabit-prod-mysql-2024-12-18-01-00"
   
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier pokehabit-prod-mysql-restored \
     --db-snapshot-identifier ${SNAPSHOT_ID} \
     --db-instance-class db.t3.medium \
     --db-subnet-group-name pokehabit-prod-db-subnet-group \
     --vpc-security-group-ids sg-xxxxx \
     --no-multi-az \
     --publicly-accessible false
   ```

3. Wait for instance to become available (15-30 minutes)
   ```bash
   watch -n 30 'aws rds describe-db-instances \
     --db-instance-identifier pokehabit-prod-mysql-restored \
     --query "DBInstances[0].DBInstanceStatus"'
   ```

4. Update Lambda functions to use new endpoint
   ```bash
   NEW_ENDPOINT=$(aws rds describe-db-instances \
     --db-instance-identifier pokehabit-prod-mysql-restored \
     --query 'DBInstances[0].Endpoint.Address' \
     --output text)
   
   # Update SSM parameter
   aws ssm put-parameter \
     --name /pokehabit/prod/database/endpoint \
     --value "${NEW_ENDPOINT}" \
     --overwrite
   ```

5. Restart all Lambda functions
   ```bash
   # Trigger deployment to pick up new parameter
   gh workflow run deploy-production.yml
   ```

### Scenario 5: Performance Degradation

**Symptoms:** Slow queries, high CPU, timeouts

**Resolution:**
1. Identify slow queries
   ```sql
   -- Enable slow query log
   CALL mysql.rds_set_configuration('slow_query_log', 1);
   CALL mysql.rds_set_configuration('long_query_time', 2);
   
   -- Check slow query log
   -- Download from CloudWatch Logs
   ```

2. Check for missing indexes
   ```sql
   -- Find queries without indexes
   SELECT * FROM information_schema.processlist 
   WHERE state = 'Sending data' AND time > 10;
   ```

3. Scale up instance temporarily
   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier pokehabit-prod-mysql \
     --db-instance-class db.t3.large \
     --apply-immediately
   ```

4. Enable Read Replica if high read load
   ```bash
   aws rds create-db-instance-read-replica \
     --db-instance-identifier pokehabit-prod-mysql-read-replica \
     --source-db-instance-identifier pokehabit-prod-mysql \
     --db-instance-class db.t3.medium
   ```

## ✅ Verification

### Post-Recovery Checks

1. **Test Database Connectivity**
   ```bash
   # From bastion/SSM
   mysql -h <endpoint> -u admin -p -e "SELECT 1;"
   ```

2. **Run Smoke Tests**
   ```bash
   cd load-tests
   npm run test:smoke
   ```

3. **Check Application**
   - Log in to application
   - Create/read/update data
   - Verify all features working

4. **Monitor for 30 minutes**
   - Watch CloudWatch metrics
   - Monitor error rates in Datadog
   - Check Lambda execution logs

## 🔄 Failover Procedure (Multi-AZ)

If Multi-AZ is enabled:

```bash
# Force failover to standby
aws rds reboot-db-instance \
  --db-instance-identifier pokehabit-prod-mysql \
  --force-failover
```

Expected downtime: 1-2 minutes

## 📊 Post-Incident Actions

### Immediate
- [ ] Document downtime duration
- [ ] Estimate data loss (if any)
- [ ] Notify all stakeholders
- [ ] Create incident report

### Short-term (24 hours)
- [ ] Analyze root cause
- [ ] Review backup strategy
- [ ] Check automated backup schedule
- [ ] Test point-in-time recovery

### Long-term (1 week)
- [ ] Implement Multi-AZ if not enabled
- [ ] Set up Read Replicas
- [ ] Improve monitoring and alerting
- [ ] Conduct disaster recovery drill
- [ ] Update RTO/RPO requirements

## 📞 Escalation

### Level 1: Database Administrator
- Connection issues, performance tuning
- Response time: 15 minutes

### Level 2: Senior DevOps + DBA
- Instance failures, restore operations
- Response time: 30 minutes

### Level 3: AWS Support (Enterprise)
- AWS infrastructure issues
- Response time: Per AWS SLA

## 📚 Related Runbooks

- [Lambda Failure Recovery](./lambda-failure-recovery.md)
- [Complete System Outage](./system-outage-recovery.md)

## 🔗 Useful Links

- [RDS Console](https://console.aws.amazon.com/rds/home?region=ap-northeast-2)
- [CloudWatch RDS Metrics](https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2)
- [Backup Strategy Documentation](../docs/backup-strategy.md)

## 📝 Backup Information

- **Automated Backups**: Daily at 03:00 KST, retention 7 days
- **Manual Snapshots**: Before major deployments
- **Point-in-Time Recovery**: Available within backup retention window
- **Backup Storage**: S3 (encrypted)
