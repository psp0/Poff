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
  description = "The environment name (e.g., 'dev', 'dev-pr-123')."
  type        = string
  default     = "dev"
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
# CloudFront / CDN Configuration
################################################################################

variable "enable_cloudfront" {
  description = "Enable CloudFront distribution"
  type        = bool
  default     = true
}

variable "cloudfront_custom_domain_name" {
  description = "Custom domain name for CloudFront"
  type        = string
  default     = "dev.poff.psp0.tech"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

################################################################################
# Route53 Configuration
################################################################################

variable "hosted_zone_domain_name" {
  description = "Route53 hosted zone domain name (in Infra account)"
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
  default     = "us5.datadoghq.com"
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

variable "firebase_service_account_key_base64" {
  description = "Firebase Service Account Key JSON (Must be Base64 encoded)"
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
