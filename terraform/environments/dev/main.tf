# Refactored modular structure for Poff infrastructure
# This uses the new separated modules for better maintainability

# Get current AWS account and region info
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# 1. Network Module - VPC, NAT, Subnets
module "network" {
  source = "../../modules/network"

  project_name               = var.project_name
  environment                = var.environment
  vpc_cidr_block             = var.vpc_cidr_block
  availability_zones         = var.availability_zones
  public_subnet_cidr_blocks  = var.public_subnet_cidr_blocks
  private_subnet_cidr_blocks = var.private_subnet_cidr_blocks
  az_instance_type_map       = var.az_instance_type_map
}

# 2. Database Module - RDS, Security Groups
module "database" {
  source = "../../modules/database"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.network.vpc_id
  db_subnet_group_name  = module.network.db_subnet_group_name
  nat_security_group_id = module.network.nat_security_group_id

  # [추가됨] RDS Proxy가 사용할 프라이빗 서브넷 ID 전달
  private_subnet_ids = module.network.private_subnet_ids

  lambda_security_group_id = module.network.lambda_security_group_id

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

  private_subnet_ids       = module.network.private_subnet_ids
  lambda_security_group_id = module.network.lambda_security_group_id

  rds_address   = module.database.rds_address
  rds_port      = module.database.rds_port
  database_name = module.database.database_name

  lambda_source_path        = var.lambda_source_path
  lambda_package_dir        = var.lambda_package_dir
  lambda_runtime            = var.lambda_runtime
  lambda_log_retention_days = var.lambda_log_retention_days

  api_cors_allowed_origins   = var.api_cors_allowed_origins
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

# 4. Storage and CDN Module - S3 & CloudFront
module "storage_cdn" {
  source = "../../modules/storage-cdn"

  project_name                  = var.project_name
  environment                   = var.environment
  aws_region                    = data.aws_region.current.id
  enable_cloudfront             = var.enable_cloudfront
  cloudfront_custom_domain_name = var.cloudfront_custom_domain_name
  cloudfront_certificate_arn    = var.cloudfront_custom_domain_name != "" && var.hosted_zone_domain_name != "" ? module.acm[0].cloudfront_certificate_arn : ""
  cloudfront_price_class        = var.cloudfront_price_class

  # API Gateway 도메인 전달 (프로토콜 제거)
  api_gateway_domain = replace(module.compute.api_gateway_endpoint, "/^https?://([^/]*).*/", "$1")
}

# 5. DNS Module - Route53 & ACM (Optional - only if custom domains configured)
# 5. ACM Module - Certificate Management (No Circular Dependency)
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
  cloudfront_custom_domain_name        = var.cloudfront_custom_domain_name
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
  count    = var.cloudfront_custom_domain_name != "" && var.enable_cloudfront ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.cloudfront_custom_domain_name
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
  count    = var.cloudfront_custom_domain_name != "" && var.enable_cloudfront ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.cloudfront_custom_domain_name
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

  project_name   = var.project_name
  environment    = var.environment
  aws_account_id = data.aws_caller_identity.current.account_id
  # enable_datadog_monitoring 변수는 이제 내부에 전달할 필요가 없을 수도 있음
}
