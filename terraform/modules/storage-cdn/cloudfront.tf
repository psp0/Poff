# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "main" {
  count = var.enable_cloudfront ? 1 : 0

  name                              = "${var.project_name}-oac"
  description                       = "OAC for ${var.project_name} S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  count = var.enable_cloudfront ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} frontend distribution"
  default_root_object = "index.html"
  price_class         = var.cloudfront_price_class
  aliases             = var.cloudfront_custom_domain_name != "" ? [var.cloudfront_custom_domain_name] : []

  origin {
    domain_name              = data.aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${data.aws_s3_bucket.frontend.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.main[0].id
  }

  origin {
    domain_name              = data.aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "S3-${data.aws_s3_bucket.assets.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.main[0].id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "S3-${data.aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/custom/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${data.aws_s3_bucket.assets.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/external/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${data.aws_s3_bucket.assets.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 604800 # 1 week
    max_ttl                = 31536000
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/base/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${data.aws_s3_bucket.assets.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  # CRITICAL: Service Worker and PWA manifest must NOT be cached
  # This must come BEFORE /assets/* to take precedence
  ordered_cache_behavior {
    path_pattern     = "/sw.js"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${data.aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  ordered_cache_behavior {
    path_pattern     = "/manifest.json"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${data.aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  # Cache behavior for Vite build assets (hashed files - long cache)
  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${data.aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 31536000 # 1 year (files have content hash)
    default_ttl            = 31536000
    max_ttl                = 31536000
    compress               = true
  }

  # API Gateway Origin
  origin {
    domain_name = var.api_gateway_domain
    origin_id   = "APIGateway"
    origin_path = "/${var.environment}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Cache behavior for API requests (Proxy to API Gateway)
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "APIGateway"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "X-Api-Key"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.cloudfront_custom_domain_name == ""
    acm_certificate_arn            = var.cloudfront_custom_domain_name != "" ? var.cloudfront_certificate_arn : null
    ssl_support_method             = var.cloudfront_custom_domain_name != "" ? "sni-only" : null
    minimum_protocol_version       = var.cloudfront_custom_domain_name != "" ? "TLSv1.2_2021" : "TLSv1"
  }

  logging_config {
    include_cookies = false
    bucket          = data.aws_s3_bucket.cloudfront_logs.bucket_domain_name
    prefix          = "cloudfront/"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-cloudfront"
  })
}
