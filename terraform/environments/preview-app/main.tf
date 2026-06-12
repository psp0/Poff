# preview-app/main.tf
# Application resources: Compute (Lambda, API Gateway), CDN (S3, CloudFront), Route53 records, Monitoring

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  # PR 환경(e.g., dev-pr-123)일 때는 도메인을 비워 기본 CloudFront URL 사용, dev 본 환경일 때만 커스텀 도메인 사용
  is_pr             = var.environment != "dev"
  cloudfront_domain = local.is_pr ? "" : var.cloudfront_custom_domain_name
  # We always assume the base infrastructure is named "dev"
  base_env = "dev"
}

# -----------------------------------------------------------------------------
# Data Sources for Shared Dev Infrastructure
# -----------------------------------------------------------------------------
data "aws_vpc" "dev" {
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-vpc"]
  }
  filter {
    name   = "tag:Environment"
    values = [local.base_env]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.dev.id]
  }
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-private-subnet-*"]
  }
}

data "aws_security_group" "lambda" {
  vpc_id = data.aws_vpc.dev.id
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-lambda-sg"]
  }
}

data "aws_db_instance" "dev" {
  db_instance_identifier = "${var.project_name}-rds"
}

data "aws_ssm_parameter" "nat_instance_id" {
  name = "/${var.project_name}/${local.base_env}/infrastructure/nat_instance_id"
}

# -----------------------------------------------------------------------------
# Modules
# -----------------------------------------------------------------------------

# 1. Compute Module - Lambda & API Gateway
module "compute" {
  source = "../../modules/compute"

  project_name   = var.project_name
  environment    = var.environment
  aws_region     = data.aws_region.current.id
  aws_account_id = data.aws_caller_identity.current.account_id

  private_subnet_ids       = data.aws_subnets.private.ids
  lambda_security_group_id = data.aws_security_group.lambda.id

  rds_address   = data.aws_db_instance.dev.address
  rds_port      = data.aws_db_instance.dev.port
  database_name = replace(var.project_name, "-", "_")

  lambda_source_path        = var.lambda_source_path
  lambda_package_dir        = var.lambda_package_dir
  lambda_runtime            = var.lambda_runtime
  lambda_log_retention_days = var.lambda_log_retention_days

  # API CORS: Allow all for PRs, restrict for base dev if needed. Assuming * for flexibility in PRs.
  api_cors_allowed_origins   = ["*"]
  api_throttling_burst_limit = var.api_throttling_burst_limit
  api_throttling_rate_limit  = var.api_throttling_rate_limit

  datadog_api_key              = var.datadog_api_key
  datadog_site                 = var.datadog_site
  datadog_extension_version    = var.datadog_extension_version
  datadog_lambda_layer_version = var.datadog_lambda_layer_version

  firebase_service_account_key = base64decode(var.firebase_service_account_key_base64)
  firebase_api_key             = var.firebase_api_key
  firebase_auth_domain         = var.firebase_auth_domain
  firebase_project_id          = var.firebase_project_id
  firebase_messaging_sender_id = var.firebase_messaging_sender_id
  firebase_app_id              = var.firebase_app_id
}

# 2. Storage and CDN Module - S3 & CloudFront
module "storage_cdn" {
  source = "../../modules/storage-cdn"

  project_name                  = var.project_name
  environment                   = var.environment
  base_environment              = local.base_env # For sharing assets bucket
  aws_region                    = data.aws_region.current.id
  enable_cloudfront             = var.enable_cloudfront
  cloudfront_custom_domain_name = local.cloudfront_domain

  # For preview-app, fetch the ACM certificate ARN created by preview-infra.
  cloudfront_certificate_arn = local.cloudfront_domain != "" ? data.aws_acm_certificate.dev[0].arn : ""

  cloudfront_price_class = var.cloudfront_price_class

  # API Gateway Domain
  api_gateway_domain = replace(module.compute.api_gateway_endpoint, "/^https?://([^/]*).*/", "$1")
  waf_web_acl_id     = ""
}

# Fetch ACM certificate created by preview-infra
data "aws_acm_certificate" "dev" {
  provider = aws.us_east_1
  count    = local.cloudfront_domain != "" ? 1 : 0
  domain   = local.cloudfront_domain
  statuses = ["ISSUED"]
}

# 3. Route53 Records - Domain Aliases
data "aws_route53_zone" "main" {
  provider = aws.infra
  count    = var.hosted_zone_domain_name != "" ? 1 : 0

  name         = var.hosted_zone_domain_name
  private_zone = false
}

resource "aws_route53_record" "cloudfront" {
  provider = aws.infra
  count    = local.cloudfront_domain != "" && var.enable_cloudfront ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = local.cloudfront_domain
  type    = "A"

  alias {
    name                   = module.storage_cdn.cloudfront_domain_name
    zone_id                = module.storage_cdn.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "cloudfront_ipv6" {
  provider = aws.infra
  count    = local.cloudfront_domain != "" && var.enable_cloudfront ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = local.cloudfront_domain
  type    = "AAAA"

  alias {
    name                   = module.storage_cdn.cloudfront_domain_name
    zone_id                = module.storage_cdn.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# 4. Monitoring Module - Datadog (Optional)
module "monitoring" {
  source = "../../modules/monitoring"

  count = var.enable_datadog_monitoring ? 1 : 0

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project_name    = var.project_name
  environment     = var.environment
  aws_account_id  = data.aws_caller_identity.current.account_id
  aws_region      = data.aws_region.current.id
  datadog_api_key = var.datadog_api_key
  datadog_site    = var.datadog_site
}
