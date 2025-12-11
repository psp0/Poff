variable "project_name" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "hosted_zone_domain_name" {
  description = "Route53 hosted zone domain name (e.g., example.com)"
  type        = string
  default     = ""
}

variable "api_custom_domain_name" {
  description = "Custom domain name for API Gateway"
  type        = string
  default     = ""
}

variable "cloudfront_custom_domain_name" {
  description = "Custom domain name for CloudFront"
  type        = string
  default     = ""
}


