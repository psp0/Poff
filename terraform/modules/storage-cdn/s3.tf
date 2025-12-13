# S3 Bucket Data Source (Frontend)
# Managed in bootstrap/dev/s3.tf
data "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-${var.environment}-frontend"
}

# S3 Bucket Data Source (Assets)
# Managed in bootstrap/dev/s3.tf
data "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-${var.environment}-assets"
}

# S3 Bucket Policy for CloudFront (Frontend)
resource "aws_s3_bucket_policy" "frontend" {
  bucket = data.aws_s3_bucket.frontend.id

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
        Resource = "${data.aws_s3_bucket.frontend.arn}/*"
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
resource "aws_s3_bucket_policy" "assets" {
  bucket = data.aws_s3_bucket.assets.id

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
        Resource = "${data.aws_s3_bucket.assets.arn}/*"
        Condition = var.enable_cloudfront ? {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main[0].arn
          }
        } : {}
      }
    ]
  })

  depends_on = [
    # aws_s3_bucket_public_access_block.assets,
    aws_cloudfront_distribution.main
  ]
}

# S3 Bucket for CloudFront Logs
resource "aws_s3_bucket" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = "${var.project_name}-${var.environment}-cloudfront-logs"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-cloudfront-logs"
  })
}

resource "aws_s3_bucket_public_access_block" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = aws_s3_bucket.cloudfront_logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = aws_s3_bucket.cloudfront_logs[0].id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_ownership_controls" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = aws_s3_bucket.cloudfront_logs[0].id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}
