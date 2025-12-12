variable "project_name" {
  description = "The name of the project (used for resource naming)"
  type        = string
  default     = "pokehabit"

  validation {
    condition     = can(regex("^[a-z0-9-]+", var.project_name))
    error_message = "Project name must only contain lowercase letters, numbers, and hyphens."
  }
}

variable "infra_account_id" {
  description = "AWS Account ID for the infrastructure/bootstrap account"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Deployment environment (e.g. infra, dev, prod)"
  type        = string
  default     = "prod"
}

variable "full_repo_path" {
  description = "GitHub repository name in the format 'owner/repo'."
  default     = "psp0/PokeHabit"
}