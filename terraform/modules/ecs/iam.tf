resource "aws_iam_role" "ecs_execution_role" {
  name_prefix = "${var.project_name}-ecs-execution-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role (권한이 필요한 경우)
resource "aws_iam_role" "ecs_task_role" {
  name_prefix = "${var.project_name}-ecs-task-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# SSM Parameter Store 접근 권한 (DB 비밀번호 등)
resource "aws_iam_role_policy" "ecs_ssm_access" {
  name_prefix = "${var.project_name}-ecs-ssm-"
  role        = aws_iam_role.ecs_execution_role.id # 실행 역할에 부여 (secrets 용)

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/${var.environment}/*",
          "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/poff/*"
        ]
      }
    ]
  })
}
