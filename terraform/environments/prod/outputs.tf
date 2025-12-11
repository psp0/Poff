# Essential outputs for production environment
# Sensitive values are stored in SSM Parameter Store and should be retrieved separately

output "vpc_id" {
  description = "VPC ID for the production environment"
  value       = module.network.vpc_id
}

output "rds_endpoint" {
  description = "RDS endpoint address (without port)"
  value       = module.database.rds_address
}

output "database_name" {
  description = "Name of the MySQL database"
  value       = module.database.database_name
}

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = module.compute.api_gateway_endpoint
}

output "rds_port" {
  description = "RDS port number"
  value       = module.database.rds_port
}

output "nat_instance_id" {
  description = "ID of the first NAT instance (for SSM access)"
  value       = module.network.nat_instance_id
}

output "s3_bucket" {
  description = "S3 bucket name for static assets"
  value       = module.storage_cdn.s3_bucket_name
}

output "cloudfront_url" {
  description = "CloudFront distribution domain name"
  value       = var.enable_cloudfront ? module.storage_cdn.cloudfront_domain_name : "CloudFront not enabled"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = var.enable_cloudfront ? module.storage_cdn.cloudfront_distribution_id : ""
}

# Note: Sensitive values are NOT exposed as outputs
# Retrieve them from SSM Parameter Store using these parameter names:
# - /${var.project_name}/${var.environment}/database/username
# - /${var.project_name}/${var.environment}/database/password
# - /${var.project_name}/${var.environment}/database/endpoint (includes port)
