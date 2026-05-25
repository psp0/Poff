# Essential outputs for development infrastructure

output "vpc_id" {
  description = "VPC ID for the development environment"
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

output "nat_instance_id" {
  description = "ID of the first NAT instance (for SSM Port Forwarding)"
  value       = module.network.nat_instance_id
}

output "rds_port" {
  description = "RDS port number"
  value       = module.database.rds_port
}

output "cloudfront_certificate_arn" {
  description = "ACM Certificate ARN for CloudFront"
  value       = var.hosted_zone_domain_name != "" ? module.acm[0].cloudfront_certificate_arn : ""
}
