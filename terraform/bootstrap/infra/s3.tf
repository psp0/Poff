# S3 Bucket for App Releases (Centralized Artifact Archive in Infra Account)
resource "aws_s3_bucket" "releases" {
  bucket = "${var.project_name}-infra-releases"

  # Prevent accidental deletion of bucket
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-infra-releases"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform-bootstrap"
  }
}

resource "aws_s3_bucket_public_access_block" "releases" {
  bucket = aws_s3_bucket.releases.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "releases" {
  bucket = aws_s3_bucket.releases.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Policy to allow cross-account access from Dev and Prod accounts
resource "aws_s3_bucket_policy" "releases" {
  bucket = aws_s3_bucket.releases.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCrossAccountAccess"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${var.dev_account_id}:role/${var.project_name}-dev-execution-role",
            "arn:aws:iam::${var.prod_account_id}:role/${var.project_name}-prod-execution-role",
            "arn:aws:iam::${var.prod_account_id}:role/${var.project_name}-prod-gha-ci-role"
          ]
        }
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.releases.arn,
          "${aws_s3_bucket.releases.arn}/*"
        ]
      }
    ]
  })
}
