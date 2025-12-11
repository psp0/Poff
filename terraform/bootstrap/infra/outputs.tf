

output "terraform_cross_account_backend_role_arn" {
  description = "The ARN of the cross-account backend access role"
  value       = aws_iam_role.terraform_cross_account_backend_role.arn
}

output "terraform_cross_account_backend_role_name" {
  description = "The name of the cross-account backend access role"
  value       = aws_iam_role.terraform_cross_account_backend_role.name
}

# output "terraform_execution_role_arn" {
#   description = "ARN of the Terraform execution role for infra environment"
#   value       = aws_iam_role.terraform_execution_role.arn
# }

# output "terraform_execution_role_name" {
#   description = "Name of the Terraform execution role for infra environment"
#   value       = aws_iam_role.terraform_execution_role.name
# }



# output "github_oidc_provider_arn" {
#   description = "The ARN of the GitHub OIDC provider"
#   value       = aws_iam_openid_connect_provider.github_oidc.arn
# }

output "dns_management_role_arn" {
  description = "The ARN of the DNS management role for cross-account Route53 access"
  value       = aws_iam_role.dns_management.arn
}

output "dns_management_role_name" {
  description = "The name of the DNS management role"
  value       = aws_iam_role.dns_management.name
}
