locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Store S3 bucket name and CloudFront distribution ID in SSM so that:
#   1. GHA deploy workflow doesn't need `aws ssm put-parameter` after apply
#   2. Rollback workflow can read them with `aws ssm get-parameter` instead of
#      running `terraform init + terraform output` against a pinned tag checkout
resource "aws_ssm_parameter" "s3_bucket" {
  name        = "/${var.project_name}/${var.environment}/infrastructure/s3_bucket"
  type        = "String"
  value       = local.frontend_bucket_id
  overwrite   = true
  description = "Frontend S3 bucket name for ${var.project_name} ${var.environment}"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "cloudfront_distribution_id" {
  count = var.enable_cloudfront ? 1 : 0

  name        = "/${var.project_name}/${var.environment}/infrastructure/cloudfront_distribution_id"
  type        = "String"
  value       = aws_cloudfront_distribution.main[0].id
  overwrite   = true
  description = "CloudFront distribution ID for ${var.project_name} ${var.environment}"

  tags = local.common_tags
}
