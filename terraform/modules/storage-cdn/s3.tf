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

# S3 Bucket Data Source (CloudFront Logs)
# Managed in bootstrap/dev/s3.tf
data "aws_s3_bucket" "cloudfront_logs" {
  bucket = "${var.project_name}-${var.environment}-cloudfront-logs"
}
