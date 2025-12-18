#!/bin/bash

###############################################################################
# Database Latency Simulation
#
# Purpose: Test system behavior under high database latency
# Scenario: Add network latency to RDS connections
# Recovery: Automatic removal of latency simulation
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../scripts/common.sh"

# Configuration
ENVIRONMENT="${1:-dev}"
LATENCY_MS="${2:-500}" # 500ms default latency
DURATION="${3:-300}" # 5 minutes default

log "INFO" "Starting Database Latency Simulation"
log "INFO" "Environment: ${ENVIRONMENT}"
log "INFO" "Latency: ${LATENCY_MS}ms"
log "INFO" "Duration: ${DURATION} seconds"

check_aws_cli
check_environment "${ENVIRONMENT}"
confirm_production "${ENVIRONMENT}"

# Get RDS instance identifier
DB_IDENTIFIER="pokehabit-${ENVIRONMENT}-mysql"

log "INFO" "Checking RDS instance..."
DB_STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier "${DB_IDENTIFIER}" \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$DB_STATUS" = "NOT_FOUND" ]; then
    log "ERROR" "RDS instance ${DB_IDENTIFIER} not found"
    exit 1
fi

log "SUCCESS" "RDS instance found (status: ${DB_STATUS})"

# Note: Actual network latency simulation requires AWS SSM or network configuration
# For this demonstration, we'll simulate by monitoring and documenting the impact
log "WARN" "This is a SIMULATION MODE"
log "INFO" "In a real scenario, you would:"
log "INFO" "  1. Use AWS Network Firewall to add latency"
log "INFO" "  2. Use tc (traffic control) on EC2/ECS instances"
log "INFO" "  3. Use AWS SSM to modify network parameters"

log "INFO" "Monitoring database performance metrics..."

# Start time
START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))

# Collect baseline metrics
log "INFO" "Collecting baseline metrics..."
BASELINE_LATENCY=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name ReadLatency \
    --dimensions Name=DBInstanceIdentifier,Value="${DB_IDENTIFIER}" \
    --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average \
    --query 'Datapoints[0].Average' \
    --output text 2>/dev/null || echo "0")

log "INFO" "Baseline read latency: ${BASELINE_LATENCY}ms"

# Monitor during simulation
log "INFO" "Simulating high latency scenario..."
log "WARN" "SIMULATION: Assuming ${LATENCY_MS}ms additional latency"

SAMPLE_COUNT=0
TOTAL_CONNECTIONS=0
TOTAL_CPU=0

while [ $(date +%s) -lt $END_TIME ]; do
    sleep 30
    SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
    ELAPSED=$(($(date +%s) - START_TIME))
    
    log "INFO" "Monitoring... (${ELAPSED}/${DURATION} seconds)"
    
    # Get current metrics
    CURRENT_CONNECTIONS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/RDS \
        --metric-name DatabaseConnections \
        --dimensions Name=DBInstanceIdentifier,Value="${DB_IDENTIFIER}" \
        --start-time $(date -u -d '2 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 60 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null || echo "0")
    
    CURRENT_CPU=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/RDS \
        --metric-name CPUUtilization \
        --dimensions Name=DBInstanceIdentifier,Value="${DB_IDENTIFIER}" \
        --start-time $(date -u -d '2 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 60 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null || echo "0")
    
    log "INFO" "Current connections: ${CURRENT_CONNECTIONS}"
    log "INFO" "Current CPU: ${CURRENT_CPU}%"
    
    # Validate numeric values before using bc
    if [[ "$CURRENT_CONNECTIONS" =~ ^[0-9.]+$ ]] && [[ "$CURRENT_CONNECTIONS" != "None" ]]; then
        TOTAL_CONNECTIONS=$(echo "$TOTAL_CONNECTIONS + $CURRENT_CONNECTIONS" | bc)
    fi
    
    if [[ "$CURRENT_CPU" =~ ^[0-9.]+$ ]] && [[ "$CURRENT_CPU" != "None" ]]; then
        TOTAL_CPU=$(echo "$TOTAL_CPU + $CURRENT_CPU" | bc)
    fi
done

# Calculate averages
AVG_CONNECTIONS=$(echo "scale=2; $TOTAL_CONNECTIONS / $SAMPLE_COUNT" | bc)
AVG_CPU=$(echo "scale=2; $TOTAL_CPU / $SAMPLE_COUNT" | bc)

log "INFO" "=== Chaos Experiment Summary ==="
log "INFO" "Experiment: Database Latency Simulation"
log "INFO" "Duration: ${DURATION} seconds"
log "INFO" "Simulated Latency: ${LATENCY_MS}ms"
log "INFO" "Database: ${DB_IDENTIFIER}"
log "INFO" "Baseline Latency: ${BASELINE_LATENCY}ms"
log "INFO" "Avg Connections: ${AVG_CONNECTIONS}"
log "INFO" "Avg CPU: ${AVG_CPU}%"

# Expected behaviors
log "INFO" ""
log "INFO" "=== Expected Behaviors ==="
log "INFO" "✓ API response times should increase by ~${LATENCY_MS}ms"
log "INFO" "✓ Database connection pool may fill up"
log "INFO" "✓ Lambda functions may timeout if latency is very high"
log "INFO" "✓ User experience degradation"
log "INFO" ""
log "INFO" "=== Recovery Actions ==="
log "INFO" "✓ Connection timeouts cause retries"
log "INFO" "✓ Lambda auto-retries help recover"
log "INFO" "✓ CloudWatch alarms trigger notifications"
log "INFO" "✓ Auto-scaling can help (if configured)"

# Generate report
RESULTS_DIR=$(ensure_results_dir)
REPORT_FILE="${RESULTS_DIR}/database-latency-$(date +%Y%m%d-%H%M%S).json"

cat > "${REPORT_FILE}" << EOF
{
  "experiment": "database-latency",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "database": "${DB_IDENTIFIER}",
  "simulatedLatency": ${LATENCY_MS},
  "duration": ${DURATION},
  "baselineLatency": ${BASELINE_LATENCY},
  "avgConnections": ${AVG_CONNECTIONS},
  "avgCPU": ${AVG_CPU},
  "status": "completed",
  "mode": "simulation",
  "notes": "This was a monitoring simulation. Real latency injection requires network-level tools."
}
EOF

log "INFO" "Report saved to ${REPORT_FILE}"
log "SUCCESS" "Database latency simulation completed"
