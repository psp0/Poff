# =============================================================================
# RDS Proxy Configuration
# =============================================================================
# 
# enable_rds_proxy = true 로 설정하여 활성화
# 권장 시점: 동시 사용자 100명 이상 또는 Lambda 동시성 이슈 발생 시
#
# 비용: ~$22/월 (db.t3.micro 기준, ap-northeast-2)
# 장점:
#   - Connection Pooling으로 DB 연결 안정화
#   - Lambda 스케일 아웃 시에도 연결 수 제어
#   - Multi-AZ 자동 Failover 지원
#   - Idle 연결 자동 정리
# =============================================================================

# Get current region for KMS condition
data "aws_region" "current" {}

# Secrets Manager Secret for RDS Credentials (Required for RDS Proxy)
resource "aws_secretsmanager_secret" "rds_credentials" {
  count       = var.enable_rds_proxy ? 1 : 0
  name_prefix = "${var.project_name}-rds-credentials-"
  description = "RDS credentials for RDS Proxy authentication"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "rds_credentials" {
  count     = var.enable_rds_proxy ? 1 : 0
  secret_id = aws_secretsmanager_secret.rds_credentials[0].id
  secret_string = jsonencode({
    username = var.rds_admin_username
    password = random_password.rds_admin_password.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = replace(var.project_name, "-", "_")
  })
}

# IAM Role for RDS Proxy
resource "aws_iam_role" "rds_proxy" {
  count       = var.enable_rds_proxy ? 1 : 0
  name_prefix = "${var.project_name}-rds-proxy-role-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-proxy-role"
  })
}

# IAM Policy for RDS Proxy to access Secrets Manager
resource "aws_iam_role_policy" "rds_proxy_secrets" {
  count = var.enable_rds_proxy ? 1 : 0
  name  = "${var.project_name}-rds-proxy-secrets-policy"
  role  = aws_iam_role.rds_proxy[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.rds_credentials[0].arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${data.aws_region.current.id}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# RDS Proxy
resource "aws_db_proxy" "main" {
  count                  = var.enable_rds_proxy ? 1 : 0
  name                   = "${var.project_name}-proxy"
  debug_logging          = var.environment == "dev" ? true : false
  engine_family          = "MYSQL"
  idle_client_timeout    = 1800 # 30분 - Lambda 실행 패턴에 적합
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy[0].arn
  vpc_security_group_ids = [aws_security_group.rds.id]
  vpc_subnet_ids         = var.private_subnet_ids

  auth {
    auth_scheme               = "SECRETS"
    client_password_auth_type = "MYSQL_NATIVE_PASSWORD"
    iam_auth                  = "DISABLED" # IAM 인증 비활성화 (기존 방식 유지)
    secret_arn                = aws_secretsmanager_secret.rds_credentials[0].arn
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-proxy"
  })

  depends_on = [
    aws_iam_role_policy.rds_proxy_secrets
  ]
}

# RDS Proxy Default Target Group
resource "aws_db_proxy_default_target_group" "main" {
  count         = var.enable_rds_proxy ? 1 : 0
  db_proxy_name = aws_db_proxy.main[0].name

  connection_pool_config {
    # 최대 연결 비율 (RDS 인스턴스의 max_connections 대비)
    max_connections_percent = 100

    # 연결 대기 시간 (초) - Lambda 타임아웃보다 짧게
    connection_borrow_timeout = 120

    # 세션 고정 필터 (트랜잭션 레벨 변경 시에만 고정)
    session_pinning_filters = ["EXCLUDE_VARIABLE_SETS"]

    # 초기화 쿼리 (연결 시 실행할 SQL)
    init_query = "SET NAMES utf8mb4"
  }
}

# RDS Proxy Target (RDS 인스턴스 연결)
resource "aws_db_proxy_target" "main" {
  count                  = var.enable_rds_proxy ? 1 : 0
  db_proxy_name          = aws_db_proxy.main[0].name
  target_group_name      = aws_db_proxy_default_target_group.main[0].name
  db_instance_identifier = aws_db_instance.main.identifier
}

# CloudWatch Alarms for RDS Proxy
resource "aws_cloudwatch_metric_alarm" "rds_proxy_connections" {
  count               = var.enable_rds_proxy ? 1 : 0
  alarm_name          = "${var.project_name}-rds-proxy-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80 # 80% 연결 사용 시 알람
  alarm_description   = "RDS Proxy connections are high"

  dimensions = {
    DBProxyName = aws_db_proxy.main[0].name
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-proxy-alarm"
  })
}
