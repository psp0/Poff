output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "nat_public_ips" {
  description = "List of public Elastic IPs created for AWS NAT Gateway"
  value       = aws_instance.nat[*].public_ip
}

output "db_subnet_group_name" {
  description = "Name of database subnet group"
  value       = aws_db_subnet_group.main.name
}

output "nat_security_group_id" {
  description = "Security group ID for NAT instances"
  value       = aws_security_group.nat.id
}

output "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  value       = aws_security_group.lambda.id
}

output "nat_instance_id" {
  description = "ID of the first NAT instance"
  value       = length(aws_instance.nat) > 0 ? aws_instance.nat[0].id : ""
}
