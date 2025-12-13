variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "db_subnet_group_name" {
  description = "Database subnet group name"
  type        = string
}

variable "nat_security_group_id" {
  description = "NAT security group ID"
  type        = string
}

variable "lambda_security_group_id" {
  description = "Lambda security group ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for RDS Proxy"
  type        = list(string)
  default     = []
}

variable "enable_rds_proxy" {
  description = "Enable RDS Proxy"
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
}

variable "rds_admin_username" {
  description = "RDS admin username"
  type        = string
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = false
}

variable "rds_backup_retention_period" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 7
}

variable "rds_backup_window" {
  description = "RDS backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "rds_maintenance_window" {
  description = "RDS maintenance window"
  type        = string
  default     = "Mon:04:00-Mon:05:00"
}

variable "rds_skip_final_snapshot" {
  description = "Skip final snapshot before deletion"
  type        = bool
  default     = true
}

variable "availability_zone" {
  description = "The Availability Zone of the RDS instance"
  type        = string
  default     = null
}
