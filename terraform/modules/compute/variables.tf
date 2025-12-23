variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Lambda"
  type        = list(string)
}

variable "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  type        = string
}

variable "rds_address" {
  description = "RDS hostname"
  type        = string
}

variable "rds_port" {
  description = "RDS port"
  type        = number
}

variable "database_name" {
  description = "Database name"
  type        = string
}

variable "lambda_source_path" {
  description = "Path to Lambda source code directory"
  type        = string
}

variable "lambda_package_dir" {
  description = "Path to directory containing pre-built Lambda packages (optional)"
  type        = string
  default     = ""
}

variable "lambda_runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs24.x"
}

variable "lambda_log_retention_days" {
  description = "CloudWatch Logs retention period"
  type        = number
  default     = 7
}

variable "api_cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
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

variable "api_custom_domain_name" {
  description = "Custom domain name for API Gateway"
  type        = string
  default     = ""
}

variable "api_certificate_arn" {
  description = "ACM certificate ARN for API Gateway"
  type        = string
  default     = ""
}

variable "datadog_api_key" {
  description = "Datadog API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "datadog_site" {
  description = "Datadog site URL (e.g. datadoghq.com, datadoghq.eu)"
  type        = string
  default     = "datadoghq.com"
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




variable "firebase_service_account" {
  description = "Firebase Service Account JSON (Base64 encoded)"
  type        = string
  sensitive   = true
}

variable "firebase_api_key" {
  description = "Firebase API Key"
  type        = string
  default     = ""
}

variable "firebase_auth_domain" {
  description = "Firebase Auth Domain"
  type        = string
  default     = ""
}

variable "firebase_project_id" {
  description = "Firebase Project ID"
  type        = string
  default     = ""
}

variable "firebase_messaging_sender_id" {
  description = "Firebase Messaging Sender ID"
  type        = string
  default     = ""
}

variable "firebase_app_id" {
  description = "Firebase App ID"
  type        = string
  default     = ""
}
