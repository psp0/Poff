#!/bin/bash

# PokeHabit NAT Instance Connection Script via SSM
# This script fetches the NAT instance ID from AWS SSM Parameter Store and connects to it.

PROJECT="pokehabit"
ENV="dev"
PROFILE=${1:-""} # Get profile from first argument, default to empty
PARAM_PATH="/$PROJECT/$ENV/infrastructure/nat_instance_id"

echo "----------------------------------------------------"
echo "🎣 PokeHabit NAT Connector (SSM)"
[ -n "$PROFILE" ] && echo "👤 Profile: $PROFILE"
echo "----------------------------------------------------"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed."
    exit 1
fi

# Build AWS command with profile if provided
AWS_CMD="aws"
[ -n "$PROFILE" ] && AWS_CMD="aws --profile $PROFILE"

# Fetch NAT Instance ID
echo "🔍 Fetching NAT Instance ID from SSM ($PARAM_PATH)..."
INSTANCE_ID=$($AWS_CMD ssm get-parameter --name "$PARAM_PATH" --query "Parameter.Value" --output text 2>/dev/null)

if [ -z "$INSTANCE_ID" ]; then
    echo "❌ Error: Could not find NAT Instance ID."
    echo "   Make sure you have the correct AWS credentials/profile and the parameter exists."
    exit 1
fi

echo "✅ Found Instance: $INSTANCE_ID"
echo "🚀 Connecting..."
echo "----------------------------------------------------"

# Start Session
$AWS_CMD ssm start-session --target "$INSTANCE_ID"
