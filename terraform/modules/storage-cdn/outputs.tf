output "s3_bucket_name" {
  description = "Name of the S3 bucket for frontend"
  value       = data.aws_s3_bucket.frontend.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for frontend"
  value       = data.aws_s3_bucket.frontend.arn
}

output "s3_assets_bucket_name" {
  description = "Name of the S3 bucket for assets"
  value       = data.aws_s3_bucket.assets.id
}

output "s3_assets_bucket_arn" {
  description = "ARN of the S3 bucket for assets"
  value       = data.aws_s3_bucket.assets.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].id : null
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].domain_name : null
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID for Route53"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].hosted_zone_id : null
}

output "cloudfront_custom_domain" {
  description = "CloudFront custom domain name"
  value       = var.cloudfront_custom_domain_name != "" ? var.cloudfront_custom_domain_name : null
}
