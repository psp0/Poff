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
      lambdas = [aws_cloudformation_stack.datadog_forwarder.outputs["DatadogForwarderArn"]]
      sources = []
    }
  }

  traces_config {
    xray_services {
      include_only = []
    }
  }
}

# Datadog Lambda Forwarder (CloudFormation 직접 배포 방식으로 우회)
resource "aws_cloudformation_stack" "datadog_forwarder" {
  name         = "${var.project_name}-datadog-forwarder"
  template_url = "https://datadog-cloudformation-template.s3.amazonaws.com/aws/forwarder/5.4.1.yaml"
  capabilities = ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"]

  parameters = {
    DdApiKey     = var.datadog_api_key
    DdSite       = var.datadog_site
    FunctionName = "${var.project_name}-datadog-forwarder"
  }
}

# RDS Error 로그 → Datadog Forwarder
resource "aws_cloudwatch_log_subscription_filter" "rds_error_to_datadog" {
  name            = "${var.project_name}-rds-error-to-datadog"
  log_group_name  = "/aws/rds/instance/${var.project_name}-rds/error"
  filter_pattern  = ""
  destination_arn = aws_cloudformation_stack.datadog_forwarder.outputs["DatadogForwarderArn"]
}

# RDS Slowquery 로그 → Datadog Forwarder
resource "aws_cloudwatch_log_subscription_filter" "rds_slowquery_to_datadog" {
  name            = "${var.project_name}-rds-slowquery-to-datadog"
  log_group_name  = "/aws/rds/instance/${var.project_name}-rds/slowquery"
  filter_pattern  = ""
  destination_arn = aws_cloudformation_stack.datadog_forwarder.outputs["DatadogForwarderArn"]
}

# Forwarder에 CloudWatch 호출 권한 부여
resource "aws_lambda_permission" "datadog_forwarder_rds_error" {
  statement_id  = "AllowCWLogsRdsError"
  action        = "lambda:InvokeFunction"
  function_name = aws_cloudformation_stack.datadog_forwarder.outputs["DatadogForwarderArn"]
  principal     = "logs.amazonaws.com"
  source_arn    = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/rds/instance/${var.project_name}-rds/error:*"
}

resource "aws_lambda_permission" "datadog_forwarder_rds_slowquery" {
  statement_id  = "AllowCWLogsRdsSlowquery"
  action        = "lambda:InvokeFunction"
  function_name = aws_cloudformation_stack.datadog_forwarder.outputs["DatadogForwarderArn"]
  principal     = "logs.amazonaws.com"
  source_arn    = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/rds/instance/${var.project_name}-rds/slowquery:*"
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
