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
  default     = "poff"
}

variable "environment" {
  description = "The environment name (always 'dev' for this root)."
  type        = string
  default     = "dev"
}

################################################################################
# Network Configuration Variables
################################################################################

variable "vpc_cidr_block" {
  description = "The CIDR block for the VPC."
  type        = string
  default     = "10.120.0.0/16"
}

variable "availability_zones" {
  description = "List of Availability Zones to use for subnets."
  type        = list(string)
  default     = ["ap-northeast-2b", "ap-northeast-2a"]
}

variable "public_subnet_cidr_blocks" {
  description = "List of public subnet CIDR blocks."
  type        = list(string)
  default     = ["10.120.1.0/24", "10.120.3.0/24"]
}

variable "private_subnet_cidr_blocks" {
  description = "List of private subnet CIDR blocks."
  type        = list(string)
  default     = ["10.120.2.0/24", "10.120.4.0/24"]
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
# ACM / CloudFront / Route53 Configuration
################################################################################

variable "cloudfront_custom_domain_name" {
  description = "Custom domain name for CloudFront (used for ACM cert)"
  type        = string
  default     = "dev.poff.psp0.tech"
}

variable "cloudfront_subject_alternative_names" {
  description = "List of subject alternative names for the CloudFront certificate"
  type        = list(string)
  default     = []
}

variable "hosted_zone_domain_name" {
  description = "Route53 hosted zone domain name (in Infra account)"
  type        = string
  default     = "psp0.tech"
}
