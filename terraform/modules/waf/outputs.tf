output "regional_web_acl_arn" {
  description = "ARN of the Regional Web ACL"
  value       = var.enable_waf ? aws_wafv2_web_acl.regional[0].arn : ""
}

output "cloudfront_web_acl_arn" {
  description = "ARN of the CloudFront Web ACL"
  value       = var.enable_waf ? aws_wafv2_web_acl.cloudfront[0].arn : ""
}
