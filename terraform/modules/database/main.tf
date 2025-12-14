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

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [var.nat_security_group_id]
    description     = "Allow MySQL access from NAT instances"
  }

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [var.lambda_security_group_id]
    description     = "Allow MySQL access from Lambda functions"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Generate RDS admin password
resource "random_password" "rds_admin_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"

  keepers = {
    project     = var.project_name
    environment = var.environment
  }
}

# RDS MySQL instance
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-rds"
  engine         = "mysql"
  engine_version = "8.4.5"
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

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds"
  })
}

# RDS Credentials in Parameter Store
resource "aws_ssm_parameter" "rds_admin_username" {
  name        = "/${var.project_name}/database/admin/username"
  type        = "String"
  value       = var.rds_admin_username
  description = "Admin username for RDS instance"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-admin-username"
  })
}

resource "aws_ssm_parameter" "rds_admin_password" {
  name        = "/${var.project_name}/database/admin/password"
  type        = "SecureString"
  value       = random_password.rds_admin_password.result
  description = "Admin password for RDS instance"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-admin-password"
  })
}

resource "aws_ssm_parameter" "rds_endpoint" {
  name        = "/${var.project_name}/database/endpoint"
  type        = "String"
  value       = aws_db_instance.main.endpoint
  description = "RDS endpoint"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-rds-endpoint"
  })
}

# RDS Credentials in Secrets Manager (for GitHub Actions & Applications)
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}/${var.environment}/database/credentials"
  description = "Database credentials for ${var.environment}"

  # Allow overwriting if it was deleted but not purged
  recovery_window_in_days = 0

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-db-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.rds_admin_username
    password = random_password.rds_admin_password.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = replace(var.project_name, "-", "_")
    engine   = "mysql"
  })
}
