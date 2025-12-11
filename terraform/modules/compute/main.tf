locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  lambda_functions = {
    exercise-management = {
      handler     = "functions/exercise-management/index.handler"
      timeout     = 30
      memory_size = 512
    }
    exercise-rewards = {
      handler     = "functions/exercise-rewards/index.handler"
      timeout     = 30
      memory_size = 512
    }
    pokemon-collection = {
      handler     = "functions/pokemon-collection/index.handler"
      timeout     = 30
      memory_size = 512
    }
    screen-time-management = {
      handler     = "functions/screen-time-management/index.handler"
      timeout     = 30
      memory_size = 512
    }
    screen-time-rewards = {
      handler     = "functions/screen-time-rewards/index.handler"
      timeout     = 30
      memory_size = 512
    }
    egg-management = {
      handler     = "functions/egg-management/index.handler"
      timeout     = 30
      memory_size = 512
    }
    pokemon-management = {
      handler     = "functions/pokemon-management/index.handler"
      timeout     = 30
      memory_size = 512
    }
    user-management = {
      handler     = "functions/user-management/index.handler"
      timeout     = 30
      memory_size = 512
    }
  }

  api_routes = {
    "POST /api/exercises"               = "exercise-management"
    "GET /api/exercises"                = "exercise-management"
    "GET /api/exercises/{id}"           = "exercise-management"
    "PUT /api/exercises/{id}"           = "exercise-management"
    "DELETE /api/exercises/{id}"        = "exercise-management"
    "POST /api/exercises/{id}/complete" = "exercise-rewards"
    "GET /api/exercises/rewards"        = "exercise-rewards"
    "POST /api/screen-time"             = "screen-time-management"
    "GET /api/screen-time"              = "screen-time-management"
    "GET /api/screen-time/today"        = "screen-time-management"
    "POST /api/screen-time/check"       = "screen-time-rewards"
    "GET /api/pokemon"                  = "pokemon-collection"
    "GET /api/pokemon/{id}"             = "pokemon-collection"
    "POST /api/pokemon/collect"         = "pokemon-collection"
    "GET /api/collection"               = "pokemon-collection"
    # Egg Management
    "GET /api/eggs"          = "egg-management"
    "GET /api/eggs/search"   = "egg-management"
    "POST /api/eggs/acquire" = "egg-management"
    "POST /api/eggs/hatch"   = "egg-management"

    # Pokemon Management
    "POST /api/pokemon/evolve"       = "pokemon-management"
    "POST /api/pokemon/unlock-form"  = "pokemon-management"
    "POST /api/pokemon/unlock-shiny" = "pokemon-management"
    "GET /api/user/items"            = "pokemon-management"

    # User Management
    "POST /api/auth/sync"            = "user-management"
    "POST /api/user/terms-agreement" = "user-management"
  }
}

# Lambda Execution Role
resource "aws_iam_role" "lambda_execution" {
  name_prefix = "${var.project_name}-lambda-role-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-lambda-execution-role"
  })
}

resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_ssm_read" {
  name_prefix = "${var.project_name}-lambda-ssm-read-"
  role        = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.project_name}/database/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Archive Lambda source code (Entire lambda directory to include shared code)
# Only used if lambda_package_dir is not provided
data "archive_file" "lambda_source" {
  count       = var.lambda_package_dir == "" ? 1 : 0
  type        = "zip"
  source_dir  = var.lambda_source_path
  output_path = "${path.module}/.terraform/lambda-all.zip"
  excludes    = ["node_modules", ".git", "tests", "packages"] # Exclude packages dir to avoid recursion
}

# Lambda Functions
resource "aws_lambda_function" "functions" {
  for_each = local.lambda_functions

  function_name = "${var.project_name}-${each.key}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = each.value.handler
  runtime       = var.lambda_runtime
  timeout       = each.value.timeout
  memory_size   = each.value.memory_size

  filename         = var.lambda_package_dir != "" ? "${var.lambda_package_dir}/${each.key}.zip" : data.archive_file.lambda_source[0].output_path
  source_code_hash = var.lambda_package_dir != "" ? filebase64sha256("${var.lambda_package_dir}/${each.key}.zip") : data.archive_file.lambda_source[0].output_base64sha256

  layers = var.datadog_api_key != "" ? [
    "arn:aws:lambda:${var.aws_region}:464622532012:layer:Datadog-Extension:${var.datadog_extension_version}",
    "arn:aws:lambda:${var.aws_region}:464622532012:layer:Datadog-Node24-x:${var.datadog_lambda_layer_version}"
  ] : []

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  environment {
    variables = {
      NODE_ENV          = var.environment
      DB_HOST           = var.rds_address
      DB_PORT           = tostring(var.rds_port)
      DB_NAME           = var.database_name
      DB_USER_PARAM     = "/${var.project_name}/database/admin/username"
      DB_PASSWORD_PARAM = "/${var.project_name}/database/admin/password"

      # Datadog Configuration
      DD_API_KEY           = var.datadog_api_key
      DD_SITE              = "datadoghq.com"
      DD_LOGS_ENABLED      = var.datadog_api_key != "" ? "true" : "false"
      DD_SERVICE           = "${var.project_name}-${each.key}"
      DD_ENV               = var.environment
      DD_VERSION           = "1.0.0"
      DD_TRACE_ENABLED     = "true"
      DD_MERGE_XRAY_TRACES = "true"

      # Advanced Serverless Monitoring
      DD_COLD_START_TRACING = "true" # 콜드 스타트 상세 분석
      DD_LOGS_INJECTION     = "true" # 로그와 트레이스 자동 연결

      # Firebase Configuration
      FIREBASE_SERVICE_ACCOUNT = var.firebase_service_account
    }
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${each.key}"
  })

  depends_on = [
    aws_iam_role_policy_attachment.lambda_vpc_access,
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.lambda_ssm_read
  ]
}

# CloudWatch Log Groups for Lambda Functions
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${aws_lambda_function.functions[each.key].function_name}"
  retention_in_days = var.lambda_log_retention_days

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${each.key}-logs"
  })
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  description   = "HTTP API for ${var.project_name}"

  cors_configuration {
    allow_origins     = var.api_cors_allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
    expose_headers    = ["Content-Length", "Content-Type"]
    max_age           = 300
    allow_credentials = false
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-api"
  })
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId   = "$context.requestId"
      ip          = "$context.identity.sourceIp"
      requestTime = "$context.requestTime"
      httpMethod  = "$context.httpMethod"
      routeKey    = "$context.routeKey"
      status      = "$context.status"
    })
  }

  default_route_settings {
    throttling_burst_limit = var.api_throttling_burst_limit
    throttling_rate_limit  = var.api_throttling_rate_limit
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-api-stage"
  })
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${var.project_name}"
  retention_in_days = var.lambda_log_retention_days

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-api-logs"
  })
}

# API Gateway Integrations
resource "aws_apigatewayv2_integration" "lambda_integrations" {
  for_each = local.lambda_functions

  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.functions[each.key].invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000

  lifecycle {
    create_before_destroy = true
  }
}

# API Routes
resource "aws_apigatewayv2_route" "routes" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integrations[each.value].id}"
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  for_each = local.lambda_functions

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Custom Domain Name (if provided)
resource "aws_apigatewayv2_domain_name" "api" {
  count = var.api_custom_domain_name != "" ? 1 : 0

  domain_name = var.api_custom_domain_name

  domain_name_configuration {
    certificate_arn = var.api_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-api-domain"
  })
}

# API Mapping
resource "aws_apigatewayv2_api_mapping" "main" {
  count = var.api_custom_domain_name != "" ? 1 : 0

  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = aws_apigatewayv2_stage.main.id
}
