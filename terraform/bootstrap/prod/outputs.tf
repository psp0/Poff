output "terraform_execution_role_arn" {
  description = "ARN of the Terraform execution role for prod environment"
  value       = aws_iam_role.terraform_execution_role.arn
}

output "terraform_execution_role_name" {
  description = "Name of the Terraform execution role for prod environment"
  value       = aws_iam_role.terraform_execution_role.name
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions role for prod environment"
  value       = aws_iam_role.github_actions_role.arn
}

output "github_actions_role_name" {
  description = "Name of the GitHub Actions role for prod environment"
  value       = aws_iam_role.github_actions_role.name
}
