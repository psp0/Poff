# ---- Cross-Account IAM Role (Infra 계정에 생성) ----
# 다른 계정(dev, prod)이 백엔드에 접근할 수 있도록 허용하는 역할

# Get current AWS account ID
data "aws_caller_identity" "current" {}

data "aws_s3_bucket" "terraform_state" {
  bucket = var.terraform_state_bucket_name
}

resource "aws_iam_role" "terraform_cross_account_backend_role" {
  name        = "${var.project_name}-${var.environment}-cross-account-backend-role"
  description = "Allows cross-account access to Terraform backend resources"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"
        Principal = {
          AWS = [
            # 부트스트랩과정을 위해 주석 일부로 남겨놓음
            # "arn:aws:iam::${var.dev_account_id}:root",
            # "arn:aws:iam::${var.prod_account_id}:root",
            "arn:aws:iam::${var.dev_account_id}:role/${var.project_name}-dev-execution-role",
            "arn:aws:iam::${var.prod_account_id}:role/${var.project_name}-prod-execution-role",
            "arn:aws:iam::${var.prod_account_id}:role/${var.project_name}-prod-gha-pr-role",
          ]
        }
      }
    ]
  })

}

# Cross-Account 역할에 부여할 백엔드 접근 정책
resource "aws_iam_policy" "terraform_cross_account_backend_policy" {
  name        = "${var.project_name}-${var.environment}-cross-account-backend-policy"
  description = "Policy for cross-account Terraform backend access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowListBucketForState"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = data.aws_s3_bucket.terraform_state.arn
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "bootstrap/*",
              "environments/dev/*",
              "environments/prod/*"
            ]
          }
        }
      },
      {
        Sid    = "AllowStateFileAccess"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [
          "${data.aws_s3_bucket.terraform_state.arn}/bootstrap/*",
          "${data.aws_s3_bucket.terraform_state.arn}/environments/dev/*",
          "${data.aws_s3_bucket.terraform_state.arn}/environments/prod/*"
        ]
      },
    ]
  })
}

# Cross-Account 역할과 정책 연결
resource "aws_iam_role_policy_attachment" "cross_account_backend_policy_attachment" {
  role       = aws_iam_role.terraform_cross_account_backend_role.name
  policy_arn = aws_iam_policy.terraform_cross_account_backend_policy.arn
}


# ---- DNS Management Role (Cross-Account) ----
# This role allows Dev/Prod accounts to manage Route53 records in the Infra account

resource "aws_iam_role" "dns_management" {
  name        = "${var.project_name}-${var.environment}-dns-management-role"
  description = "Allows cross-account Route53 DNS management from Dev/Prod accounts"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"
        Principal = {
          AWS = [
            # 부트스트랩과정을 위해 주석 일부로 남겨놓음
            # "arn:aws:iam::${var.dev_account_id}:root",
            # "arn:aws:iam::${var.prod_account_id}:root",
            "arn:aws:iam::${var.dev_account_id}:role/${var.project_name}-dev-execution-role",
            "arn:aws:iam::${var.prod_account_id}:role/${var.project_name}-prod-execution-role"
          ]
        }
      }
    ]
  })

  tags = {
    Name        = "DNSManagementRole"
    Environment = var.environment
    Purpose     = "Cross-account Route53 management"
  }
}

# DNS Management Policy
resource "aws_iam_policy" "dns_management" {
  name        = "${var.project_name}-${var.environment}-dns-management-policy"
  description = "Policy for managing Route53 DNS records"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRoute53RecordManagement"
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:ListResourceRecordSets",
          "route53:GetHostedZone",
          "route53:GetChange",
          "route53:ListTagsForResource"
        ]
        Resource = var.hosted_zone_id != "" ? [
          "arn:aws:route53:::hostedzone/${var.hosted_zone_id}",
          "arn:aws:route53:::change/*"
          ] : [
          "arn:aws:route53:::hostedzone/*",
          "arn:aws:route53:::change/*"
        ]
      },
      {
        Sid      = "AllowListHostedZones"
        Effect   = "Allow"
        Action   = ["route53:ListHostedZones", "route53:ListHostedZonesByName"]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "DNSManagementPolicy"
    Environment = var.environment
  }
}

# Attach DNS Management Policy to Role
resource "aws_iam_role_policy_attachment" "dns_management" {
  role       = aws_iam_role.dns_management.name
  policy_arn = aws_iam_policy.dns_management.arn
}


# ---- TerraformExecutionRole for Infra Account ----
resource "aws_iam_role" "terraform_execution_role" {
  name        = "${var.project_name}-${var.environment}-execution-role"
  description = "Terraform execution role for infrastructure resources in infra account"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
          ]
        }
      }
    ]
  })

  tags = {
    Name        = "TerraformExecutionRole"
    Environment = "infra"
  }
}

# TerraformExecutionRole 정책
resource "aws_iam_policy" "terraform_execution_policy" {
  name        = "${var.project_name}-${var.environment}-execution-policy"
  description = "Policy for Terraform execution role in infra account"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowBackendAccessForInfra"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          data.aws_s3_bucket.terraform_state.arn,
          "${data.aws_s3_bucket.terraform_state.arn}/*"
        ]
      }
    ]
  })
}


# TerraformExecutionRole과 정책 연결
resource "aws_iam_role_policy_attachment" "terraform_execution_policy_attachment" {
  role       = aws_iam_role.terraform_execution_role.name
  policy_arn = aws_iam_policy.terraform_execution_policy.arn
}
