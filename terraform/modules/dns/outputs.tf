output "api_certificate_arn" {
  description = "ARN of the API Gateway ACM certificate"
  value       = var.api_custom_domain_name != "" ? aws_acm_certificate_validation.api[0].certificate_arn : ""
}

output "cloudfront_certificate_arn" {
  description = "ARN of the CloudFront ACM certificate"
  value       = var.cloudfront_custom_domain_name != "" ? aws_acm_certificate_validation.cloudfront[0].certificate_arn : ""
}
