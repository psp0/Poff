#!/bin/bash

###############################################################################
# Common functions for chaos engineering scripts
###############################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "ERROR")
            echo -e "${timestamp} ${RED}[ERROR]${NC} ${message}" >&2
            ;;
        "WARN")
            echo -e "${timestamp} ${YELLOW}[WARN]${NC} ${message}"
            ;;
        "SUCCESS")
            echo -e "${timestamp} ${GREEN}[SUCCESS]${NC} ${message}"
            ;;
        "INFO")
            echo -e "${timestamp} ${BLUE}[INFO]${NC} ${message}"
            ;;
        *)
            echo -e "${timestamp} [${level}] ${message}"
            ;;
    esac
}

# Check if AWS CLI is configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log "ERROR" "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "AWS CLI not configured. Please run 'aws configure'."
        exit 1
    fi
    
    log "SUCCESS" "AWS CLI configured"
}

# Check required environment variables
check_environment() {
    local env=$1
    if [ -z "$env" ]; then
        log "ERROR" "Environment not specified. Use 'dev' or 'prod'."
        exit 1
    fi
    
    if [ "$env" != "dev" ] && [ "$env" != "prod" ]; then
        log "ERROR" "Invalid environment. Use 'dev' or 'prod'."
        exit 1
    fi
    
    log "SUCCESS" "Environment validated: $env"
}

# Confirm action in production
confirm_production() {
    local env=$1
    if [ "$env" = "prod" ]; then
        log "WARN" "You are about to run chaos experiment in PRODUCTION!"
        read -p "Are you sure? Type 'yes' to continue: " confirm
        if [ "$confirm" != "yes" ]; then
            log "INFO" "Operation cancelled"
            exit 0
        fi
    fi
}

# Get CloudWatch alarm state
get_alarm_state() {
    local alarm_name=$1
    aws cloudwatch describe-alarms \
        --alarm-names "$alarm_name" \
        --query 'MetricAlarms[0].StateValue' \
        --output text 2>/dev/null || echo "NOT_FOUND"
}

# Wait for alarm to trigger
wait_for_alarm() {
    local alarm_name=$1
    local timeout=${2:-300} # 5 minutes default
    local elapsed=0
    
    log "INFO" "Waiting for alarm '${alarm_name}' to trigger..."
    
    while [ $elapsed -lt $timeout ]; do
        local state=$(get_alarm_state "$alarm_name")
        log "INFO" "Alarm state: $state"
        
        if [ "$state" = "ALARM" ]; then
            log "SUCCESS" "Alarm triggered"
            return 0
        fi
        
        sleep 10
        elapsed=$((elapsed + 10))
    done
    
    log "WARN" "Alarm did not trigger within ${timeout} seconds"
    return 1
}

# Send notification
send_notification() {
    local title=$1
    local message=$2
    local severity=${3:-INFO}
    
    # This can be extended to send to Slack, email, etc.
    log "$severity" "NOTIFICATION: $title - $message"
}

# Create results directory
ensure_results_dir() {
    local results_dir="${SCRIPT_DIR}/../results"
    mkdir -p "$results_dir"
    echo "$results_dir"
}

# Cleanup function (call on exit)
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log "ERROR" "Script failed with exit code $exit_code"
        log "WARN" "Please check if resources need manual cleanup"
    fi
}

# Register cleanup
trap cleanup EXIT

# Export functions
export -f log
export -f check_aws_cli
export -f check_environment
export -f confirm_production
export -f get_alarm_state
export -f wait_for_alarm
export -f send_notification
export -f ensure_results_dir
