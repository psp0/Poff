#!/bin/bash

# Configuration
AWS_REGION="ap-northeast-2"
ECR_REPO_NAME="poff-api"
ECS_CLUSTER_NAME="poff-cluster"
ECS_SERVICE_NAME="poff-api-service"
IMAGE_TAG="latest"

# 1. Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "🚀 Deploying to ${AWS_REGION}..."
echo "📦 ECR Repository: ${ECR_URI}"

# 2. Login to ECR
echo "🔑 Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# 3. Build Docker Image
echo "🔨 Building Docker image..."
# We need to build from the parent directory to include lambda/ folder
cd ..
docker build -f ecs-server/Dockerfile -t ${ECR_REPO_NAME}:${IMAGE_TAG} .
docker tag ${ECR_REPO_NAME}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}

# 4. Push to ECR
echo "TX Pushing image to ECR..."
docker push ${ECR_URI}:${IMAGE_TAG}

# 5. Update ECS Service
echo "🔄 Updating ECS Service..."
aws ecs update-service --cluster ${ECS_CLUSTER_NAME} --service ${ECS_SERVICE_NAME} --force-new-deployment --region ${AWS_REGION}

echo "✅ Deployment trigger sent!"
