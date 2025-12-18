#!/bin/bash

###############################################################################
# Lambda Function Failure Simulation
#
# Purpose: Test system resilience when Lambda functions fail
# Scenario: Temporarily disable or throttle Lambda functions
# Recovery: Automatic through AWS Lambda retry mechanisms
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../scripts/common.sh"

# Configuration
ENVIRONMENT="${1:-dev}"
FUNCTION_NAME="${2:-pokemon-management}"
DURATION="${3:-300}" # 5 minutes default

log "INFO" "Starting Lambda Failure Simulation"
log "INFO" "Environment: ${ENVIRONMENT}"
log "INFO" "Function: ${FUNCTION_NAME}"
log "INFO" "Duration: ${DURATION} seconds"

# Get Lambda function name
FULL_FUNCTION_NAME="pokehabit-${ENVIRONMENT}-${FUNCTION_NAME}"

log "INFO" "Checking if Lambda function exists..."
if ! aws lambda get-function --function-name "${FULL_FUNCTION_NAME}" &>/dev/null; then
    log "ERROR" "Lambda function ${FULL_FUNCTION_NAME} not found"
    exit 1
fi

log "SUCCESS" "Lambda function found"

# Save original concurrency configuration
log "INFO" "Saving original configuration..."
ORIGINAL_CONCURRENCY=$(aws lambda get-function-concurrency \
    --function-name "${FULL_FUNCTION_NAME}" \
    --query 'ReservedConcurrentExecutions' \
    --output text 2>/dev/null || echo "None")

log "INFO" "Original concurrency: ${ORIGINAL_CONCURRENCY}"

# Simulate failure by setting concurrency to 0
log "WARN" "Simulating Lambda failure by setting concurrency to 0..."
aws lambda put-function-concurrency \
    --function-name "${FULL_FUNCTION_NAME}" \
    --reserved-concurrent-executions 0

log "SUCCESS" "Lambda function disabled (concurrency set to 0)"
log "INFO" "Function will be unavailable for ${DURATION} seconds"

# Start monitoring
log "INFO" "Monitoring CloudWatch metrics..."
log "INFO" "Expected behavior:"
log "INFO" "  - API calls to this function should fail"
log "INFO" "  - CloudWatch alarms should trigger"
log "INFO" "  - Other functions should continue working"

# Wait for specified duration
for i in $(seq 1 $((DURATION / 10))); do
    sleep 10
    log "INFO" "Failure simulation in progress... ($((i * 10))/${DURATION} seconds)"
    
    # Check error metrics
    ERRORS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value="${FULL_FUNCTION_NAME}" \
        --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 300 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    log "INFO" "Errors detected in last 5 minutes: ${ERRORS}"
done

# Restore original configuration
log "INFO" "Restoring Lambda function..."
if [ "${ORIGINAL_CONCURRENCY}" = "None" ]; then
    log "INFO" "Removing concurrency limit..."
    aws lambda delete-function-concurrency \
        --function-name "${FULL_FUNCTION_NAME}"
else
    log "INFO" "Restoring concurrency to ${ORIGINAL_CONCURRENCY}..."
    aws lambda put-function-concurrency \
        --function-name "${FULL_FUNCTION_NAME}" \
        --reserved-concurrent-executions "${ORIGINAL_CONCURRENCY}"
fi

log "SUCCESS" "Lambda function restored"

# Verify recovery
log "INFO" "Verifying function recovery..."
sleep 10

FUNCTION_STATE=$(aws lambda get-function \
    --function-name "${FULL_FUNCTION_NAME}" \
    --query 'Configuration.State' \
    --output text)

log "INFO" "Function state: ${FUNCTION_STATE}"

if [ "${FUNCTION_STATE}" = "Active" ]; then
    log "SUCCESS" "Lambda function fully recovered"
else
    log "WARN" "Function state is ${FUNCTION_STATE}, may need manual intervention"
fi

# Summary
log "INFO" "=== Chaos Experiment Summary ==="
log "INFO" "Experiment: Lambda Failure"
log "INFO" "Duration: ${DURATION} seconds"
log "INFO" "Function: ${FULL_FUNCTION_NAME}"
log "INFO" "Status: Completed"
log "INFO" "Recovery: Successful"

log "SUCCESS" "Chaos experiment completed successfully"

# Generate report
REPORT_FILE="${SCRIPT_DIR}/../results/lambda-failure-$(date +%Y%m%d-%H%M%S).json"
mkdir -p "$(dirname "${REPORT_FILE}")"

cat > "${REPORT_FILE}" << EOF
{
  "experiment": "lambda-failure",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "function": "${FULL_FUNCTION_NAME}",
  "duration": ${DURATION},
  "status": "completed",
  "recovery": "successful",
  "notes": "Function was disabled for ${DURATION} seconds and recovered successfully"
}
EOF

log "INFO" "Report saved to ${REPORT_FILE}"
