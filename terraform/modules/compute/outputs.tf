output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_apigatewayv2_api.main.id
}

output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_stage.main.invoke_url
}

output "api_gateway_custom_domain" {
  description = "API Gateway custom domain name"
  value       = var.api_custom_domain_name != "" ? var.api_custom_domain_name : null
}

output "lambda_function_arns" {
  description = "Map of Lambda function names to ARNs"
  value       = { for k, v in aws_lambda_function.functions : k => v.arn }
}

output "api_domain_name_config" {
  description = "API domain name configuration for Route53"
  value = var.api_custom_domain_name != "" ? {
    target_domain_name = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name
    hosted_zone_id     = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].hosted_zone_id
  } : null
}
