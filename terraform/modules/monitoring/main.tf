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
    # us-east-1 is included because CloudFront custom domain ACM certificates must be created in us-east-1
    include_only = ["ap-northeast-2", "us-east-1"]
  }

  metrics_config {
    enabled = false
    namespace_filters {
      include_only = ["AWS/Lambda", "AWS/RDS", "AWS/ApiGateway", "AWS/CloudFront"]
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
          "apigateway:GET",
          "cloudfront:GetDistributionConfig",
          "cloudfront:ListDistributions"
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

# ==============================================================================
# CloudWatch Metric Streams to Datadog (Cost-Efficient Alternative to API Polling)
# ==============================================================================

# S3 Bucket for Kinesis Firehose backup (Failed deliveries only)
resource "aws_s3_bucket" "firehose_backup" {
  bucket        = "${var.project_name}-${var.environment}-datadog-firehose-backup"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "firehose_backup" {
  bucket = aws_s3_bucket.firehose_backup.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role for Kinesis Firehose to write to S3
resource "aws_iam_role" "firehose_to_datadog" {
  name = "${var.project_name}-firehose-datadog-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "firehose_to_datadog" {
  name = "${var.project_name}-firehose-datadog-policy"
  role = aws_iam_role.firehose_to_datadog.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.firehose_backup.arn,
          "${aws_s3_bucket.firehose_backup.arn}/*"
        ]
      }
    ]
  })
}

# Kinesis Firehose Delivery Stream to Datadog
resource "aws_kinesis_firehose_delivery_stream" "datadog_metrics" {
  name        = "${var.project_name}-datadog-metrics-stream"
  destination = "http_endpoint"

  http_endpoint_configuration {
    url                = "https://aws-kinesis-http-intake.${var.datadog_site}/v1/input"
    name               = "Datadog"
    access_key         = var.datadog_api_key
    buffering_size     = 2 # MiB (Datadog max 권장값 2 MiB)
    buffering_interval = 60
    role_arn           = aws_iam_role.firehose_to_datadog.arn

    s3_backup_mode = "FailedDataOnly"

    request_configuration {
      content_encoding = "GZIP"
    }

    s3_configuration {
      role_arn           = aws_iam_role.firehose_to_datadog.arn
      bucket_arn         = aws_s3_bucket.firehose_backup.arn
      buffering_size     = 5
      buffering_interval = 300
      compression_format = "GZIP"
    }
  }
}

# IAM Role for CloudWatch Metric Stream
resource "aws_iam_role" "metric_stream_to_firehose" {
  name = "${var.project_name}-metric-stream-to-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "streams.metrics.cloudwatch.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "metric_stream_to_firehose" {
  name = "${var.project_name}-metric-stream-to-firehose-policy"
  role = aws_iam_role.metric_stream_to_firehose.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "firehose:PutRecord",
          "firehose:PutRecordBatch"
        ]
        Resource = [
          aws_kinesis_firehose_delivery_stream.datadog_metrics.arn
        ]
      }
    ]
  })
}

# IAM Role for Kinesis Firehose (us-east-1) to write to S3
resource "aws_iam_role" "firehose_to_datadog_us_east_1" {
  provider = aws.us_east_1
  name     = "${var.project_name}-firehose-datadog-role-use1"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "firehose_to_datadog_us_east_1" {
  provider = aws.us_east_1
  name     = "${var.project_name}-firehose-datadog-policy-use1"
  role     = aws_iam_role.firehose_to_datadog_us_east_1.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.firehose_backup.arn,
          "${aws_s3_bucket.firehose_backup.arn}/*"
        ]
      }
    ]
  })
}

# Kinesis Firehose Delivery Stream (us-east-1) to Datadog
resource "aws_kinesis_firehose_delivery_stream" "datadog_metrics_us_east_1" {
  provider    = aws.us_east_1
  name        = "${var.project_name}-datadog-metrics-stream-use1"
  destination = "http_endpoint"

  http_endpoint_configuration {
    url                = "https://aws-kinesis-http-intake.${var.datadog_site}/v1/input"
    name               = "Datadog"
    access_key         = var.datadog_api_key
    buffering_size     = 2 # MiB (Datadog max 권장값 2 MiB)
    buffering_interval = 60
    role_arn           = aws_iam_role.firehose_to_datadog_us_east_1.arn

    s3_backup_mode = "FailedDataOnly"

    request_configuration {
      content_encoding = "GZIP"
    }

    s3_configuration {
      role_arn           = aws_iam_role.firehose_to_datadog_us_east_1.arn
      bucket_arn         = aws_s3_bucket.firehose_backup.arn
      buffering_size     = 5
      buffering_interval = 300
      compression_format = "GZIP"
    }
  }
}

# IAM Role for CloudWatch Metric Stream (us-east-1)
resource "aws_iam_role" "metric_stream_to_firehose_us_east_1" {
  provider = aws.us_east_1
  name     = "${var.project_name}-metric-stream-firehose-role-use1"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "streams.metrics.cloudwatch.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "metric_stream_to_firehose_us_east_1" {
  provider = aws.us_east_1
  name     = "${var.project_name}-metric-stream-firehose-policy-use1"
  role     = aws_iam_role.metric_stream_to_firehose_us_east_1.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "firehose:PutRecord",
          "firehose:PutRecordBatch"
        ]
        Resource = [
          aws_kinesis_firehose_delivery_stream.datadog_metrics_us_east_1.arn
        ]
      }
    ]
  })
}

# CloudWatch Metric Stream (Active in default region: ap-northeast-2)
resource "aws_cloudwatch_metric_stream" "datadog" {
  name          = "${var.project_name}-datadog-metric-stream"
  role_arn      = aws_iam_role.metric_stream_to_firehose.arn
  firehose_arn  = aws_kinesis_firehose_delivery_stream.datadog_metrics.arn
  output_format = "opentelemetry0.7"

  # Stream only the required namespaces to optimize cost and data transfer
  include_filter {
    namespace = "AWS/Lambda"
  }
  include_filter {
    namespace = "AWS/RDS"
  }
  include_filter {
    namespace = "AWS/ApiGateway"
  }
  include_filter {
    namespace = "AWS/S3"
  }
}

# CloudWatch Metric Stream (Active in us-east-1 for global metrics like CloudFront)
resource "aws_cloudwatch_metric_stream" "datadog_us_east_1" {
  provider = aws.us_east_1

  name          = "${var.project_name}-datadog-metric-stream-us-east-1"
  role_arn      = aws_iam_role.metric_stream_to_firehose_us_east_1.arn
  firehose_arn  = aws_kinesis_firehose_delivery_stream.datadog_metrics_us_east_1.arn
  output_format = "opentelemetry0.7"

  include_filter {
    namespace = "AWS/CloudFront"
  }
}

# Datadog Cloudflare Integration
resource "datadog_integration_cloudflare_account" "main" {
  count   = var.cloudflare_api_token != "" ? 1 : 0
  api_key = var.cloudflare_api_token
  name    = "${var.project_name}-cloudflare"
  email   = var.cloudflare_email != "" ? var.cloudflare_email : null
}
