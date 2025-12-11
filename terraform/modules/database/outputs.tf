output "rds_endpoint" {
  description = "The RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "The RDS instance hostname"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "The RDS instance port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Name of the database"
  value       = replace(var.project_name, "-", "_")
}



output "rds_security_group_id" {
  description = "Security group ID for RDS instance"
  value       = aws_security_group.rds.id
}

output "rds_secret_arn" {
  description = "ARN of the RDS credentials secret in Secrets Manager"
  value       = try(aws_secretsmanager_secret.rds_credentials[0].arn, "")
}
