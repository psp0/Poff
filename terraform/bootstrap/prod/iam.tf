# Prod 환경의 IAM 역할
resource "aws_iam_role" "terraform_execution_role" {
  name = "${var.project_name}-${var.environment}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.project_name}-${var.environment}-gha-deploy-role",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
          ]
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-role"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution"
  }
}

# 기본 권한 정책 (STS AssumeRole 등)
resource "aws_iam_policy" "terraform_execution_base_policy" {
  name        = "${var.project_name}-${var.environment}-execution-base-policy"
  description = "Base permissions for Terraform execution role in ${var.environment} environment"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowAssumeBackendRole"
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = "arn:aws:iam::${var.infra_account_id}:role/${var.project_name}-infra-cross-account-backend-role"
      },
      {
        Sid      = "AllowAssumeDNSManagementRole"
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = "arn:aws:iam::${var.infra_account_id}:role/${var.project_name}-infra-dns-management-role"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-base-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-base"
  }
}

# VPC 및 네트워킹 정책 (Security Group 포함)
resource "aws_iam_policy" "terraform_execution_vpc_policy" {
  name        = "${var.project_name}-${var.environment}-execution-vpc-policy"
  description = "VPC and networking permissions for Terraform execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "VPCNetworkingPermissions"
        Effect   = "Allow"
        Action   = "ec2:*"
        Resource = "*"
      },
      {
        Sid      = "TaggingPermissions"
        Effect   = "Allow"
        Action   = "ec2:*"
        Resource = "*"
      },
      {
        Sid      = "SecurityGroupPermissions"
        Effect   = "Allow"
        Action   = "ec2:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-vpc-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-vpc"
  }
}

# Lambda 정책
resource "aws_iam_policy" "terraform_execution_lambda_policy" {
  name        = "${var.project_name}-${var.environment}-execution-lambda-policy"
  description = "Lambda permissions for Terraform execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "LambdaPermissions"
        Effect   = "Allow"
        Action   = "lambda:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-lambda-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-lambda"
  }
}

# API Gateway 정책
resource "aws_iam_policy" "terraform_execution_apigateway_policy" {
  name        = "${var.project_name}-${var.environment}-execution-apigateway-policy"
  description = "API Gateway permissions for Terraform execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "APIGatewayPermissions"
        Effect   = "Allow"
        Action   = "apigateway:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-apigateway-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-apigateway"
  }
}

# CloudFront 정책
resource "aws_iam_policy" "terraform_execution_cloudfront_policy" {
  name        = "${var.project_name}-${var.environment}-execution-cloudfront-policy"
  description = "CloudFront permissions for Terraform execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "CloudFrontPermissions"
        Effect   = "Allow"
        Action   = "cloudfront:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-cloudfront-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-cloudfront"
  }
}

# WAF 정책
resource "aws_iam_policy" "terraform_execution_waf_policy" {
  name        = "${var.project_name}-${var.environment}-execution-waf-policy"
  description = "WAF permissions for Terraform execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "WAFPermissions"
        Effect   = "Allow"
        Action   = ["wafv2:*", "waf:*", "waf-regional:*"]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-waf-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-waf"
  }
}

# RDS 정책
resource "aws_iam_policy" "terraform_execution_rds_policy" {
  name        = "${var.project_name}-${var.environment}-execution-rds-policy"
  description = "RDS permissions for Terraform execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "RDSPermissions"
        Effect   = "Allow"
        Action   = "rds:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-rds-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-rds"
  }
}

# IAM 정책
resource "aws_iam_policy" "terraform_execution_iam_policy" {
  name        = "${var.project_name}-${var.environment}-execution-iam-policy"
  description = "IAM permissions for Terraform execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "IAMPermissions"
        Effect   = "Allow"
        Action   = "iam:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-iam-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-iam"
  }
}

# 기타 서비스 정책 (SSM, KMS, ACM, S3, Route53, CloudWatch)
resource "aws_iam_policy" "terraform_execution_misc_policy" {
  name        = "${var.project_name}-${var.environment}-execution-misc-policy"
  description = "SSM, KMS, ACM, S3, Route53, CloudWatch permissions for Terraform execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "SSMParameterStorePermissions"
        Effect   = "Allow"
        Action   = "ssm:*"
        Resource = "*"
      },
      {
        Sid      = "KMSPermissions"
        Effect   = "Allow"
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid      = "ACMPermissions"
        Effect   = "Allow"
        Action   = "acm:*"
        Resource = "*"
      },
      {
        Sid      = "CloudWatchLogsPermissions"
        Effect   = "Allow"
        Action   = "logs:*"
        Resource = "*"
      },
      {
        Sid      = "S3BucketPermissions"
        Effect   = "Allow"
        Action   = "s3:*"
        Resource = "*"
      },
      {
        Sid      = "Route53Permissions"
        Effect   = "Allow"
        Action   = "route53:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-${var.environment}-execution-misc-policy"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "terraform-execution-misc"
  }
}

# 정책 연결 (9개 - AWS 제한 10개 이하)
resource "aws_iam_role_policy_attachment" "terraform_execution_policy_attachments" {
  for_each = {
    base       = aws_iam_policy.terraform_execution_base_policy.arn
    vpc        = aws_iam_policy.terraform_execution_vpc_policy.arn
    lambda     = aws_iam_policy.terraform_execution_lambda_policy.arn
    apigateway = aws_iam_policy.terraform_execution_apigateway_policy.arn
    cloudfront = aws_iam_policy.terraform_execution_cloudfront_policy.arn
    waf        = aws_iam_policy.terraform_execution_waf_policy.arn
    rds        = aws_iam_policy.terraform_execution_rds_policy.arn
    iam        = aws_iam_policy.terraform_execution_iam_policy.arn
    misc       = aws_iam_policy.terraform_execution_misc_policy.arn
  }

  role       = aws_iam_role.terraform_execution_role.name
  policy_arn = each.value
}

# ---- GitHub OIDC Provider for Prod Account ----
# Use existing OIDC provider (already created in the account)
data "aws_iam_openid_connect_provider" "github_oidc" {
  url = "https://token.actions.githubusercontent.com"
}

# ---- GitHub Actions Role for Prod Account ----
resource "aws_iam_role" "github_actions_role" {
  name        = "${var.project_name}-${var.environment}-gha-deploy-role"
  description = "Role for GitHub Actions to assume TerraformExecutionRole in prod account"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRoleWithWebIdentity"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github_oidc.arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          },
          StringLike = {
            "token.actions.githubusercontent.com:sub" = [
              "repo:${var.full_repo_path}:ref:refs/heads/main"
            ]
          }
        }
      }
    ]
  })

  tags = {
    Name        = "gha-deploy-role"
    Environment = "prod"
  }
}

# GitHub Actions가 TerraformExecutionRole을 assume할 수 있는 정책
resource "aws_iam_policy" "github_actions_policy" {
  name        = "${var.project_name}-${var.environment}-gha-policy"
  description = "Policy for GitHub Actions to assume TerraformExecutionRole"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowAssumeTerraformExecutionRole"
        Effect   = "Allow"
        Action   = "sts:AssumeRole"
        Resource = aws_iam_role.terraform_execution_role.arn
      }
    ]
  })
}

# GitHub Actions 역할과 정책 연결
resource "aws_iam_role_policy_attachment" "github_actions_policy_attachment" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = aws_iam_policy.github_actions_policy.arn
}
