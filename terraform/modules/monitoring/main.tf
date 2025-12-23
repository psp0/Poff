locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Datadog AWS Integration
resource "datadog_integration_aws_account" "main" {
  aws_account_id = var.aws_account_id
  aws_partition  = "aws"

  auth_config {
    aws_auth_config_role {
      # Break circular dependency by using the known role name string
      role_name = "${var.project_name}-datadog-integration-role"
    }
  }

  aws_regions {
    include_only = ["ap-northeast-2", "us-east-1"]
  }

  metrics_config {
    enabled = true
    namespace_filters {
      include_only = ["AWS/Lambda", "AWS/RDS", "AWS/ApiGateway"]
    }
  }

  resources_config {
    cloud_security_posture_management_collection = false
    extended_collection                          = false
  }

  logs_config {
    lambda_forwarder {
      # Default empty configuration
    }
  }

  traces_config {
    xray_services {
      include_only = []
    }
  }
}

# Datadog IAM Role for AWS Integration
resource "aws_iam_role" "datadog_integration" {
  # Use fixed name to allow referencing in datadog_integration_aws_account without cycle
  name = "${var.project_name}-datadog-integration-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::464622532012:root"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            # Reference the generated external_id
            "sts:ExternalId" = datadog_integration_aws_account.main.auth_config.aws_auth_config_role.external_id
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-datadog-integration-role"
  })
}

# Datadog Integration Policy
resource "aws_iam_policy" "datadog_integration" {
  name_prefix = "${var.project_name}-datadog-integration-"
  description = "Policy for Datadog AWS integration"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "lambda:GetFunction",
          "lambda:ListFunctions",
          "rds:DescribeDBInstances",
          "rds:DescribeEvents",
          "rds:ListTagsForResource",
          "rds:DescribeDBClusters",
          "apigateway:GET"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-datadog-integration-policy"
  })
}

resource "aws_iam_role_policy_attachment" "datadog_integration" {
  role       = aws_iam_role.datadog_integration.name
  policy_arn = aws_iam_policy.datadog_integration.arn
}
