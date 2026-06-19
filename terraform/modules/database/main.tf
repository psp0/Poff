locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-sg-"
  description = "Security group for RDS instance"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "rds_ingress_nat" {
  security_group_id        = aws_security_group.rds.id
  type                     = "ingress"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  source_security_group_id = var.nat_security_group_id
  description              = "Allow MySQL access from NAT instances"
}

resource "aws_security_group_rule" "rds_ingress_lambda" {
  security_group_id        = aws_security_group.rds.id
  type                     = "ingress"
  from_port                = 3306
  to_port                  = 3306
  protocol                 = "tcp"
  source_security_group_id = var.lambda_security_group_id
  description              = "Allow MySQL access from Lambda functions"
}

resource "aws_security_group_rule" "rds_egress" {
  security_group_id = aws_security_group.rds.id
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}

# Generate RDS admin password
resource "random_password" "rds_admin_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"

  keepers = {
    project     = var.project_name
    environment = var.environment
    # Force password rotation to sync out-of-sync credentials
    rotation = "1"
  }
}

# RDS MySQL instance
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-rds"
  engine         = "mysql"
  engine_version = "8.4.7"
  instance_class = var.rds_instance_class

  allocated_storage = var.rds_allocated_storage
  storage_type      = "gp2"
  storage_encrypted = true

  db_name  = replace(var.project_name, "-", "_")
  username = var.rds_admin_username
  password = random_password.rds_admin_password.result

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = var.rds_multi_az
  availability_zone   = var.rds_multi_az ? null : var.availability_zone
  publicly_accessible = false

  backup_retention_period = var.rds_backup_retention_period
  backup_window           = var.rds_backup_window
  maintenance_window      = var.rds_maintenance_window

  skip_final_snapshot = var.rds_skip_final_snapshot
  apply_immediately   = true

  enabled_cloudwatch_logs_exports = ["error", "slowquery"]

  lifecycle {
    ignore_changes = [engine_version]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds"
  })
}

# CloudWatch Log Groups for RDS (pre-create to control retention)
resource "aws_cloudwatch_log_group" "rds_error" {
  name              = "/aws/rds/instance/${var.project_name}-rds/error"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-error-logs"
  })
}

resource "aws_cloudwatch_log_group" "rds_slowquery" {
  name              = "/aws/rds/instance/${var.project_name}-rds/slowquery"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-slowquery-logs"
  })
}

# RDS Credentials in Parameter Store (Updated to include environment)
resource "aws_ssm_parameter" "rds_admin_username" {
  name        = "/${var.project_name}/${var.environment}/database/admin/username"
  type        = "String"
  value       = var.rds_admin_username
  description = "Admin username for RDS instance (${var.environment})"
  overwrite   = true
  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-admin-username-${var.environment}"
  })
}

resource "aws_ssm_parameter" "rds_admin_password" {
  name        = "/${var.project_name}/${var.environment}/database/admin/password"
  type        = "SecureString"
  value       = random_password.rds_admin_password.result
  description = "Admin password for RDS instance (${var.environment})"
  overwrite   = true

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-admin-password-${var.environment}"
  })
}

resource "aws_ssm_parameter" "rds_endpoint" {
  name        = "/${var.project_name}/${var.environment}/database/endpoint"
  type        = "String"
  value       = aws_db_instance.main.endpoint
  description = "RDS endpoint (${var.environment})"
  overwrite   = true

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-endpoint-${var.environment}"
  })
}

# Environment-specific infrastructure parameters for GitHub Actions
resource "aws_ssm_parameter" "rds_endpoint_env" {
  name        = "/${var.project_name}/${var.environment}/infrastructure/rds_endpoint"
  type        = "String"
  value       = aws_db_instance.main.address
  overwrite   = true
  description = "RDS endpoint address for ${var.environment}"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-endpoint-${var.environment}"
  })
}

resource "aws_ssm_parameter" "rds_port_env" {
  name        = "/${var.project_name}/${var.environment}/infrastructure/rds_port"
  type        = "String"
  value       = tostring(aws_db_instance.main.port)
  overwrite   = true
  description = "RDS port for ${var.environment}"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-port-${var.environment}"
  })
}

resource "aws_ssm_parameter" "database_name_env" {
  name        = "/${var.project_name}/${var.environment}/infrastructure/database_name"
  type        = "String"
  value       = replace(var.project_name, "-", "_")
  overwrite   = true
  description = "Database name for ${var.environment}"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-database-name-${var.environment}"
  })
}
