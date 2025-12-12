variable "project_name" {
  description = "The name of the project (used for resource naming)"
  type        = string
  default     = "pokehabit"

  validation {
    condition     = can(regex("^[a-z0-9-]+", var.project_name))
    error_message = "Project name must only contain lowercase letters, numbers, and hyphens."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "dev_account_id" {
  description = "AWS Account ID for the development environment"
  type        = string
}

variable "prod_account_id" {
  description = "AWS Account ID for the production environment"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. infra, dev, prod)"
  default     = "infra"
}

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "hosted_zone_id" {
  description = "The Route53 hosted zone ID for DNS management"
  type        = string
  default     = ""
}

variable "terraform_state_bucket_name" {
  description = "Name of the S3 bucket for storing Terraform state"
  type        = string
  default     = ""
}




