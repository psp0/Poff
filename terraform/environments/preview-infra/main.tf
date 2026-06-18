# preview-infra/main.tf
# Foundation infrastructure: VPC, Subnets, NAT, RDS Database, ACM Certificate

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  cloudfront_domain = var.cloudfront_custom_domain_name
}

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

  project_name             = var.project_name
  environment              = var.environment
  vpc_id                   = module.network.vpc_id
  db_subnet_group_name     = module.network.db_subnet_group_name
  nat_security_group_id    = module.network.nat_security_group_id
  private_subnet_ids       = module.network.private_subnet_ids
  lambda_security_group_id = module.network.lambda_security_group_id

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

# 3. Store infra outputs in SSM so preview-app can resolve them deterministically
#    (avoids tag-based data source discovery which breaks on duplicate resources)
resource "aws_ssm_parameter" "vpc_id" {
  name        = "/${var.project_name}/${var.environment}/infrastructure/vpc_id"
  type        = "String"
  value       = module.network.vpc_id
  overwrite   = true
  description = "VPC ID for ${var.project_name} ${var.environment}"
}

resource "aws_ssm_parameter" "private_subnet_ids" {
  name        = "/${var.project_name}/${var.environment}/infrastructure/private_subnet_ids"
  type        = "String"
  value       = join(",", module.network.private_subnet_ids)
  overwrite   = true
  description = "Comma-separated private subnet IDs for ${var.project_name} ${var.environment}"
}

resource "aws_ssm_parameter" "lambda_security_group_id" {
  name        = "/${var.project_name}/${var.environment}/infrastructure/lambda_security_group_id"
  type        = "String"
  value       = module.network.lambda_security_group_id
  overwrite   = true
  description = "Lambda security group ID for ${var.project_name} ${var.environment}"
}

# 4. ACM Module - Certificate Management
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

# 5. Store ACM certificate ARN in SSM so preview-app can look it up by path
#    instead of doing a domain-based data "aws_acm_certificate" lookup, which
#    fails when two certificates share the same domain after an interrupted deploy.
resource "aws_ssm_parameter" "cloudfront_certificate_arn" {
  count = var.hosted_zone_domain_name != "" ? 1 : 0

  name        = "/${var.project_name}/${var.environment}/infrastructure/cloudfront_certificate_arn"
  type        = "String"
  value       = module.acm[0].cloudfront_certificate_arn
  overwrite   = true
  description = "CloudFront ACM certificate ARN for ${var.project_name} ${var.environment}"
}
