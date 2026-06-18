# Essential outputs for application environment
# Sensitive values are stored in SSM Parameter Store and should be retrieved separately

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = module.compute.api_gateway_endpoint
}

output "api_gateway_domain_extracted" {
  description = "Extracted API Gateway domain for CloudFront"
  value       = replace(replace(module.compute.api_gateway_endpoint, "https://", ""), "/.*", "")
}

output "s3_bucket" {
  description = "S3 bucket name for static assets"
  value       = module.storage_cdn.s3_bucket_name
}

output "cloudfront_url" {
  description = "CloudFront distribution domain name"
  value       = var.enable_cloudfront ? module.storage_cdn.cloudfront_domain_name : "CloudFront not enabled"
}

output "website_url" {
  description = "Main website URL (CloudFront or custom domain)"
  value       = local.cloudfront_domain != "" ? "https://${local.cloudfront_domain}" : (var.enable_cloudfront ? "https://${module.storage_cdn.cloudfront_domain_name}" : "CloudFront not enabled")
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = var.enable_cloudfront ? module.storage_cdn.cloudfront_distribution_id : ""
}

output "rds_endpoint" {
  description = "RDS endpoint address (without port) for migrations and seeding"
  value       = local.rds_address
  sensitive   = true
}

output "rds_port" {
  description = "RDS port number for migrations and seeding"
  value       = local.rds_port
  sensitive   = true
}

output "database_name" {
  description = "Name of the database for migrations and seeding"
  value       = replace(var.project_name, "-", "_")
}

output "nat_instance_id" {
  description = "ID of the NAT instance for SSM Port Forwarding"
  value       = data.aws_ssm_parameter.nat_instance_id.value
  sensitive   = true
}
