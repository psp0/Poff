

data "aws_route53_zone" "main" {
  provider = aws.infra
  count    = var.hosted_zone_domain_name != "" ? 1 : 0

  name         = var.hosted_zone_domain_name
  private_zone = false
}

# ACM Certificate for API Gateway (Regional)
resource "aws_acm_certificate" "api" {
  # provider = aws.infra  <-- Removed: Must use default provider (Service Account)
  count = var.api_custom_domain_name != "" ? 1 : 0

  domain_name               = var.api_custom_domain_name
  validation_method         = "DNS"
  subject_alternative_names = var.api_subject_alternative_names

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-api-certificate"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ACM Certificate for CloudFront (must be in us-east-1)
resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1
  count    = var.cloudfront_custom_domain_name != "" ? 1 : 0

  domain_name               = var.cloudfront_custom_domain_name
  validation_method         = "DNS"
  subject_alternative_names = var.cloudfront_subject_alternative_names

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-cloudfront-certificate"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# DNS validation records for API certificate
resource "aws_route53_record" "api_cert_validation" {
  provider = aws.infra
  for_each = var.api_custom_domain_name != "" ? {
    for dvo in aws_acm_certificate.api[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main[0].zone_id
}

# DNS validation records for CloudFront certificate
resource "aws_route53_record" "cloudfront_cert_validation" {
  provider = aws.infra
  for_each = var.cloudfront_custom_domain_name != "" ? {
    for dvo in aws_acm_certificate.cloudfront[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main[0].zone_id
}

# Wait for API certificate validation
resource "aws_acm_certificate_validation" "api" {
  provider = aws.infra
  count    = var.api_custom_domain_name != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]

  timeouts {
    create = "45m"
  }
}

# Wait for CloudFront certificate validation
resource "aws_acm_certificate_validation" "cloudfront" {
  provider = aws.us_east_1
  count    = var.cloudfront_custom_domain_name != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.cloudfront[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cloudfront_cert_validation : record.fqdn]

  timeouts {
    create = "45m"
  }
}
