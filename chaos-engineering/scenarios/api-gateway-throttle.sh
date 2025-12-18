#!/bin/bash

###############################################################################
# API Gateway Throttling Simulation
#
# Purpose: Test system behavior when API Gateway throttles requests
# Scenario: Temporarily reduce API Gateway throttling limits
# Recovery: Restore original throttling configuration
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../scripts/common.sh"

# Configuration
ENVIRONMENT="${1:-dev}"
THROTTLE_LIMIT="${2:-10}" # requests per second
BURST_LIMIT="${3:-20}" # burst capacity
DURATION="${4:-300}" # 5 minutes default

log "INFO" "Starting API Gateway Throttling Simulation"
log "INFO" "Environment: ${ENVIRONMENT}"
log "INFO" "Throttle Limit: ${THROTTLE_LIMIT} req/s"
log "INFO" "Burst Limit: ${BURST_LIMIT}"
log "INFO" "Duration: ${DURATION} seconds"

check_aws_cli
check_environment "${ENVIRONMENT}"
confirm_production "${ENVIRONMENT}"

# Get API Gateway ID
API_NAME="pokehabit-${ENVIRONMENT}-api"

log "INFO" "Finding API Gateway..."
API_ID=$(aws apigateway get-rest-apis \
    --query "items[?name=='${API_NAME}'].id" \
    --output text 2>/dev/null || echo "")

if [ -z "$API_ID" ]; then
    log "ERROR" "API Gateway ${API_NAME} not found"
    log "INFO" "Available APIs:"
    aws apigateway get-rest-apis --query "items[].name" --output table
    exit 1
fi

log "SUCCESS" "API Gateway found: ${API_ID}"

# Get current stage
STAGE_NAME="${ENVIRONMENT}"

log "INFO" "Getting current throttling settings..."
CURRENT_SETTINGS=$(aws apigateway get-stage \
    --rest-api-id "${API_ID}" \
    --stage-name "${STAGE_NAME}" 2>/dev/null || echo "")

if [ -z "$CURRENT_SETTINGS" ]; then
    log "ERROR" "Stage ${STAGE_NAME} not found"
    exit 1
fi

# Save original settings
ORIGINAL_RATE=$(echo "$CURRENT_SETTINGS" | jq -r '.throttleSettings.rateLimit // "null"')
ORIGINAL_BURST=$(echo "$CURRENT_SETTINGS" | jq -r '.throttleSettings.burstLimit // "null"')

log "INFO" "Original settings:"
log "INFO" "  Rate Limit: ${ORIGINAL_RATE}"
log "INFO" "  Burst Limit: ${ORIGINAL_BURST}"

# Apply throttling
log "WARN" "Applying strict throttling limits..."

# Create patch operations
PATCH_OPS='[
  {
    "op": "replace",
    "path": "/throttle/rateLimit",
    "value": "'${THROTTLE_LIMIT}'"
  },
  {
    "op": "replace",
    "path": "/throttle/burstLimit",
    "value": "'${BURST_LIMIT}'"
  }
]'

aws apigateway update-stage \
    --rest-api-id "${API_ID}" \
    --stage-name "${STAGE_NAME}" \
    --patch-operations "$PATCH_OPS" > /dev/null

log "SUCCESS" "Throttling limits applied"
log "INFO" "New settings:"
log "INFO" "  Rate Limit: ${THROTTLE_LIMIT} req/s"
log "INFO" "  Burst Limit: ${BURST_LIMIT}"

# Monitor the impact
log "INFO" "Monitoring API Gateway metrics..."
START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))

TOTAL_4XX=0
TOTAL_5XX=0
TOTAL_COUNT=0
SAMPLE_COUNT=0

while [ $(date +%s) -lt $END_TIME ]; do
    sleep 30
    SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
    ELAPSED=$(($(date +%s) - START_TIME))
    
    log "INFO" "Throttling in effect... (${ELAPSED}/${DURATION} seconds)"
    
    # Get 4xx errors (throttling = 429)
    CURRENT_4XX=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApiGateway \
        --metric-name 4XXError \
        --dimensions Name=ApiName,Value="${API_NAME}" Name=Stage,Value="${STAGE_NAME}" \
        --start-time $(date -u -d '2 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 60 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    CURRENT_COUNT=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApiGateway \
        --metric-name Count \
        --dimensions Name=ApiName,Value="${API_NAME}" Name=Stage,Value="${STAGE_NAME}" \
        --start-time $(date -u -d '2 minutes ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 60 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0")
    
    log "INFO" "4XX Errors: ${CURRENT_4XX} | Total Requests: ${CURRENT_COUNT}"
    
    # Validate numeric values before using bc
    if [[ "$CURRENT_4XX" =~ ^[0-9.]+$ ]] && [[ "$CURRENT_4XX" != "None" ]]; then
        TOTAL_4XX=$(echo "$TOTAL_4XX + $CURRENT_4XX" | bc)
    fi
    
    if [[ "$CURRENT_COUNT" =~ ^[0-9.]+$ ]] && [[ "$CURRENT_COUNT" != "None" ]]; then
        TOTAL_COUNT=$(echo "$TOTAL_COUNT + $CURRENT_COUNT" | bc)
    fi
done

# Restore original settings
log "INFO" "Restoring original throttling settings..."

if [ "$ORIGINAL_RATE" = "null" ]; then
    # Remove throttling if it wasn't set before
    log "INFO" "Removing throttling limits..."
    aws apigateway update-stage \
        --rest-api-id "${API_ID}" \
        --stage-name "${STAGE_NAME}" \
        --patch-operations '[{"op": "remove", "path": "/throttle"}]' > /dev/null
else
    # Restore original values
    RESTORE_OPS='[
      {
        "op": "replace",
        "path": "/throttle/rateLimit",
        "value": "'${ORIGINAL_RATE}'"
      },
      {
        "op": "replace",
        "path": "/throttle/burstLimit",
        "value": "'${ORIGINAL_BURST}'"
      }
    ]'
    
    aws apigateway update-stage \
        --rest-api-id "${API_ID}" \
        --stage-name "${STAGE_NAME}" \
        --patch-operations "$RESTORE_OPS" > /dev/null
fi

log "SUCCESS" "Original throttling settings restored"

# Calculate throttle rate
if [ "$TOTAL_COUNT" != "0" ]; then
    THROTTLE_RATE=$(echo "scale=2; ($TOTAL_4XX / $TOTAL_COUNT) * 100" | bc)
else
    THROTTLE_RATE="0"
fi

# Summary
log "INFO" "=== Chaos Experiment Summary ==="
log "INFO" "Experiment: API Gateway Throttling"
log "INFO" "Duration: ${DURATION} seconds"
log "INFO" "Applied Limits: ${THROTTLE_LIMIT} req/s, burst ${BURST_LIMIT}"
log "INFO" "Total Requests: ${TOTAL_COUNT}"
log "INFO" "Total 4XX Errors: ${TOTAL_4XX}"
log "INFO" "Throttle Rate: ${THROTTLE_RATE}%"
log "INFO" "Status: Completed"
log "INFO" "Recovery: Successful"

# Generate report
RESULTS_DIR=$(ensure_results_dir)
REPORT_FILE="${RESULTS_DIR}/api-throttle-$(date +%Y%m%d-%H%M%S).json"

cat > "${REPORT_FILE}" << EOF
{
  "experiment": "api-gateway-throttle",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "apiId": "${API_ID}",
  "stageName": "${STAGE_NAME}",
  "appliedLimits": {
    "rateLimit": ${THROTTLE_LIMIT},
    "burstLimit": ${BURST_LIMIT}
  },
  "originalLimits": {
    "rateLimit": "${ORIGINAL_RATE}",
    "burstLimit": "${ORIGINAL_BURST}"
  },
  "duration": ${DURATION},
  "totalRequests": ${TOTAL_COUNT},
  "total4xxErrors": ${TOTAL_4XX},
  "throttleRate": ${THROTTLE_RATE},
  "status": "completed",
  "recovery": "successful"
}
EOF

log "INFO" "Report saved to ${REPORT_FILE}"
log "SUCCESS" "API Gateway throttling simulation completed"
