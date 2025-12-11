# Secrets Manager Access Policy
resource "aws_iam_role_policy" "lambda_secrets_access" {
  count = var.rds_secret_arn != "" ? 1 : 0
  name  = "${var.project_name}-lambda-secrets-access"
  role  = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          var.rds_secret_arn
        ]
      }
    ]
  })
}
