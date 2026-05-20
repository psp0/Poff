# Refactored modular structure for Poff infrastructure
# This uses the new separated modules for better maintainability

# Get current AWS account and region info
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  is_pr_env         = length(regexall("pr-", var.environment)) > 0
  cloudfront_domain = local.is_pr_env ? "" : var.cloudfront_custom_domain_name
}

# -----------------------------------------------------------------------------
# Data Sources for PR Environments
# PR environments do not create their own Network/Database. They reuse "dev".
# -----------------------------------------------------------------------------
data "aws_vpc" "dev" {
  count = local.is_pr_env ? 1 : 0
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-vpc"]
  }
  filter {
    name   = "tag:Environment"
    values = ["dev"]
  }
}

data "aws_subnets" "private" {
  count = local.is_pr_env ? 1 : 0
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.dev[0].id]
  }
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-private-subnet-*"]
  }
}

data "aws_security_group" "lambda" {
  count  = local.is_pr_env ? 1 : 0
  vpc_id = data.aws_vpc.dev[0].id
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-lambda-sg"]
  }
}

data "aws_db_instance" "dev" {
  count                  = local.is_pr_env ? 1 : 0
  db_instance_identifier = "${var.project_name}-rds"
}

# 1. Network Module - VPC, NAT, Subnets (Skip for PRs)
module "network" {
  source = "../../modules/network"
  count  = local.is_pr_env ? 0 : 1

  project_name               = var.project_name
  environment                = var.environment
  vpc_cidr_block             = var.vpc_cidr_block
  availability_zones         = var.availability_zones
  public_subnet_cidr_blocks  = var.public_subnet_cidr_blocks
  private_subnet_cidr_blocks = var.private_subnet_cidr_blocks
  az_instance_type_map       = var.az_instance_type_map
}

# 2. Database Module - RDS, Security Groups (Skip for PRs)
module "database" {
  source = "../../modules/database"
  count  = local.is_pr_env ? 0 : 1

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.network[0].vpc_id
  db_subnet_group_name  = module.network[0].db_subnet_group_name
  nat_security_group_id = module.network[0].nat_security_group_id

  # [추가됨] RDS Proxy가 사용할 프라이빗 서브넷 ID 전달
  private_subnet_ids = module.network[0].private_subnet_ids

  lambda_security_group_id = module.network[0].lambda_security_group_id

  # [선택] 필요 시 루트 레벨 변수에서 제어하거나 직접 true/false 설정
  # enable_rds_proxy    = var.enable_rds_proxy

  rds_instance_class          = var.rds_instance_class
  rds_allocated_storage       = var.rds_allocated_storage
  rds_admin_username          = var.rds_admin_username
  rds_multi_az                = var.rds_multi_az
  rds_backup_retention_period = var.rds_backup_retention_period
  rds_backup_window           = var.rds_backup_window
  rds_maintenance_window      = var.rds_maintenance_window
  rds_skip_final_snapshot     = var.rds_skip_final_snapshot
  availability_zone           = var.availability_zones[0]
}

# 3. Compute Module - Lambda & API Gateway
module "compute" {
  source = "../../modules/compute"

  project_name   = var.project_name
  environment    = var.environment
  aws_region     = data.aws_region.current.id
  aws_account_id = data.aws_caller_identity.current.account_id

  private_subnet_ids       = local.is_pr_env ? data.aws_subnets.private[0].ids : module.network[0].private_subnet_ids
  lambda_security_group_id = local.is_pr_env ? data.aws_security_group.lambda[0].id : module.network[0].lambda_security_group_id

  rds_address   = local.is_pr_env ? data.aws_db_instance.dev[0].address : module.database[0].rds_address
  rds_port      = local.is_pr_env ? data.aws_db_instance.dev[0].port : module.database[0].rds_port
  database_name = local.is_pr_env ? replace(var.project_name, "-", "_") : module.database[0].database_name

  lambda_source_path        = var.lambda_source_path
  lambda_package_dir        = var.lambda_package_dir
  lambda_runtime            = var.lambda_runtime
  lambda_log_retention_days = var.lambda_log_retention_days

  api_cors_allowed_origins   = local.is_pr_env ? ["*"] : var.api_cors_allowed_origins
  api_throttling_burst_limit = var.api_throttling_burst_limit
  api_throttling_rate_limit  = var.api_throttling_rate_limit

  datadog_api_key              = var.datadog_api_key
  datadog_site                 = var.datadog_site
  datadog_extension_version    = var.datadog_extension_version
  datadog_lambda_layer_version = var.datadog_lambda_layer_version



  firebase_service_account = base64decode(var.firebase_service_account)

  firebase_api_key             = var.firebase_api_key
  firebase_auth_domain         = var.firebase_auth_domain
  firebase_project_id          = var.firebase_project_id
  firebase_messaging_sender_id = var.firebase_messaging_sender_id
  firebase_app_id              = var.firebase_app_id
}

# 5. Storage and CDN Module - S3 & CloudFront
module "storage_cdn" {
  source = "../../modules/storage-cdn"

  project_name                  = var.project_name
  environment                   = var.environment
  base_environment              = "dev" # For sharing assets bucket
  aws_region                    = data.aws_region.current.id
  enable_cloudfront             = var.enable_cloudfront
  cloudfront_custom_domain_name = local.cloudfront_domain
  cloudfront_certificate_arn    = local.cloudfront_domain != "" && var.hosted_zone_domain_name != "" ? module.acm[0].cloudfront_certificate_arn : ""
  cloudfront_price_class        = var.cloudfront_price_class

  # API Gateway 도메인 전달 (프로토콜 제거)
  api_gateway_domain = replace(module.compute.api_gateway_endpoint, "/^https?://([^/]*).*/", "$1")

  # WAF Web ACL ID 전달 (WAF 제거됨)
  waf_web_acl_id = ""
}

# 6. DNS Module - Route53 & ACM (Optional - only if custom domains configured)
# 6. ACM Module - Certificate Management (No Circular Dependency)
module "acm" {
  count  = var.hosted_zone_domain_name != "" ? 1 : 0
  source = "../../modules/acm"

  providers = {
    aws.us_east_1 = aws.us_east_1
    aws.infra     = aws.infra
  }

  project_name                         = var.project_name
  environment                          = var.environment
  hosted_zone_domain_name              = var.hosted_zone_domain_name
  cloudfront_custom_domain_name        = local.cloudfront_domain
  cloudfront_subject_alternative_names = var.cloudfront_subject_alternative_names
}

# 6. Route53 Records - Domain Aliases (Breaks Circular Dependency)
data "aws_route53_zone" "main" {
  provider = aws.infra
  count    = var.hosted_zone_domain_name != "" ? 1 : 0

  name         = var.hosted_zone_domain_name
  private_zone = false
}

# A record for CloudFront
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

# AAAA record for CloudFront (IPv6)
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

# 6. Monitoring Module - Datadog (Optional)
module "monitoring" {
  source = "../../modules/monitoring"

  # 모듈 전체를 조건부로 생성 (Datadog 안 쓸 거면 아예 로드하지 않음)
  count = var.enable_datadog_monitoring ? 1 : 0

  project_name    = var.project_name
  environment     = var.environment
  aws_account_id  = data.aws_caller_identity.current.account_id
  aws_region      = data.aws_region.current.id
  datadog_api_key = var.datadog_api_key
  datadog_site    = var.datadog_site
}
