output "datadog_integration_role_arn" {
  description = "ARN of the Datadog integration IAM role"
  value       = aws_iam_role.datadog_integration.arn
}
