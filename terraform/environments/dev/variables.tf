################################################################################
# AWS Provider Configuration
################################################################################

variable "aws_region" {
  description = "The AWS region where resources will be deployed."
  type        = string
  default     = "ap-northeast-2"
}

variable "aws_profile" {
  description = "The AWS CLI profile to use for authentication (Service Account)."
  type        = string
  default     = ""
}

variable "aws_infra_profile" {
  description = "The AWS CLI profile for infrastructure account (Route53 hosted zone)."
  type        = string
  default     = ""
}

variable "aws_infra_role_arn" {
  description = "The IAM Role ARN to assume in the infrastructure account for DNS management."
  type        = string
  default     = ""
}

################################################################################
# Project and Environment Variables
################################################################################

variable "project_name" {
  description = "A prefix for all resource names to ensure uniqueness."
  type        = string
  default     = "pokehabit"
}

variable "environment" {
  description = "The environment name (e.g., 'dev')."
  type        = string
  default     = "dev"
}

################################################################################
# Network Configuration Variables
################################################################################

variable "vpc_cidr_block" {
  description = "The CIDR block for the VPC."
  type        = string
  default     = "10.123.0.0/16"
}

variable "availability_zones" {
  description = "List of Availability Zones to use for subnets."
  type        = list(string)
  default     = ["ap-northeast-2b", "ap-northeast-2a"]
}

variable "public_subnet_cidr_blocks" {
  description = "List of public subnet CIDR blocks. Cannot exceed the number of availability zones."
  type        = list(string)
  default     = ["10.123.1.0/24", "10.123.3.0/24"]
}

variable "private_subnet_cidr_blocks" {
  description = "List of private subnet CIDR blocks. Cannot exceed the number of availability zones."
  type        = list(string)
  default     = ["10.123.2.0/24", "10.123.4.0/24"]
}

variable "az_instance_type_map" {
  description = "Map of Availability Zone to EC2 instance type for NAT instances."
  type        = map(string)
  default = {
    "ap-northeast-2a" = "t2.micro"
    "ap-northeast-2b" = "t3.micro"
    "ap-northeast-2c" = "t2.micro"
  }
}

################################################################################
# RDS Configuration Variables
################################################################################

variable "rds_instance_class" {
  description = "The instance class for the RDS instance"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "The allocated storage for the RDS instance (GB)"
  type        = number
  default     = 20
}

variable "rds_admin_username" {
  description = "The admin username for the RDS instance"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "rds_multi_az" {
  description = "Whether to enable Multi-AZ deployment for high availability"
  type        = bool
  default     = false
}

variable "rds_backup_retention_period" {
  description = "The backup retention period (days)"
  type        = number
  default     = 0
}

variable "rds_backup_window" {
  description = "The preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "rds_maintenance_window" {
  description = "The preferred maintenance window (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "rds_skip_final_snapshot" {
  description = "Whether to skip final snapshot when deleting"
  type        = bool
  default     = true
}

################################################################################
# Lambda Configuration
################################################################################

variable "lambda_source_path" {
  description = "Path to Lambda source code directory"
  type        = string
  default     = "../../../lambda"
}

variable "lambda_package_dir" {
  description = "Path to directory containing pre-built Lambda packages"
  type        = string
  default     = ""
}

variable "lambda_runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs24.x"
}

variable "lambda_log_retention_days" {
  description = "CloudWatch Logs retention period for Lambda functions"
  type        = number
  default     = 3
}

################################################################################
# API Gateway Configuration
################################################################################

variable "api_cors_allowed_origins" {
  description = "CORS allowed origins for API Gateway"
  type        = list(string)
  default     = ["https://dev.pokehabit.psp0.tech", "http://localhost:8080"]
}

variable "api_throttling_burst_limit" {
  description = "API Gateway throttling burst limit"
  type        = number
  default     = 500
}

variable "api_throttling_rate_limit" {
  description = "API Gateway throttling rate limit"
  type        = number
  default     = 100
}

################################################################################
# CloudFront Configuration
################################################################################

variable "enable_cloudfront" {
  description = "Enable CloudFront distribution"
  type        = bool
  default     = true
}

variable "cloudfront_custom_domain_name" {
  description = "Custom domain name for CloudFront"
  type        = string
  default     = "dev.pokehabit.psp0.tech"
}

variable "cloudfront_subject_alternative_names" {
  description = "List of subject alternative names for the CloudFront certificate"
  type        = list(string)
  default     = []
}

variable "cloudfront_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_200"
}

################################################################################
# Route53 Configuration
################################################################################

variable "hosted_zone_domain_name" {
  description = "Route53 hosted zone domain name (in Infra account, e.g., example.com)"
  type        = string
  default     = "psp0.tech"
}

################################################################################
# Datadog Configuration
################################################################################

variable "datadog_api_key" {
  description = "Datadog API key for monitoring"
  type        = string
  sensitive   = true
  default     = ""
}

variable "datadog_app_key" {
  description = "Datadog application key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "datadog_site" {
  description = "Datadog site URL"
  type        = string
  default     = "datadoghq.com"
}

variable "datadog_external_id" {
  description = "External ID for Datadog AWS integration"
  type        = string
  default     = ""
}

variable "enable_datadog_monitoring" {
  description = "Enable Datadog monitoring integration"
  type        = bool
  default     = false
}

variable "datadog_extension_version" {
  description = "Datadog Lambda Extension layer version"
  type        = number
  default     = 65
}

variable "datadog_lambda_layer_version" {
  description = "Datadog Lambda Layer version for Node.js"
  type        = number
  default     = 115
}

################################################################################
# External Services Configuration
################################################################################

variable "firebase_service_account" {
  description = "Firebase Service Account JSON (Base64 encoded)"
  type        = string
  sensitive   = true
}
