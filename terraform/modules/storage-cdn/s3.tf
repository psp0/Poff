locals {
  shared_env = var.base_environment != "" ? var.base_environment : var.environment
  is_pr_env  = length(regexall("pr-", var.environment)) > 0
}

# S3 Bucket Data Source (Frontend)
# Managed in bootstrap/dev/s3.tf for base environments
data "aws_s3_bucket" "frontend" {
  count  = local.is_pr_env ? 0 : 1
  bucket = "${var.project_name}-${var.environment}-frontend"
}

# Dynamic S3 Bucket for PR environments
resource "aws_s3_bucket" "frontend_pr" {
  count         = local.is_pr_env ? 1 : 0
  bucket        = "${var.project_name}-${var.environment}-frontend"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend_pr" {
  count  = local.is_pr_env ? 1 : 0
  bucket = aws_s3_bucket.frontend_pr[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

locals {
  frontend_bucket_id          = local.is_pr_env ? aws_s3_bucket.frontend_pr[0].id : data.aws_s3_bucket.frontend[0].id
  frontend_bucket_arn         = local.is_pr_env ? aws_s3_bucket.frontend_pr[0].arn : data.aws_s3_bucket.frontend[0].arn
  frontend_bucket_domain_name = local.is_pr_env ? aws_s3_bucket.frontend_pr[0].bucket_regional_domain_name : data.aws_s3_bucket.frontend[0].bucket_regional_domain_name
}

# S3 Bucket Data Source (Assets)
# Reuses the base environment's assets bucket to avoid copying huge files
data "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-${local.shared_env}-assets"
}

# S3 Bucket Policy for CloudFront (Frontend)
resource "aws_s3_bucket_policy" "frontend" {
  bucket = local.frontend_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${local.frontend_bucket_arn}/*"
        Condition = var.enable_cloudfront ? {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main[0].arn
          }
        } : {}
      }
    ]
  })

  depends_on = [
    # aws_s3_bucket_public_access_block.frontend,
    aws_cloudfront_distribution.main
  ]
}

# S3 Bucket Policy for CloudFront (Assets)
# Note: assets 버킷 정책은 bootstrap/dev/s3.tf에서 계정 단위로 영구 관리합니다.
# 계정 내 모든 CloudFront(dev + 모든 PR 환경)에 대해 단일 정책으로 허용하여
# PR 환경마다 정책 충돌이 발생하는 문제를 방지합니다.

# S3 Bucket Data Source (CloudFront Logs)
# Reuses the base environment's logs bucket
data "aws_s3_bucket" "cloudfront_logs" {
  bucket = "${var.project_name}-${local.shared_env}-cloudfront-logs"
}
