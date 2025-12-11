# CloudFront Function for Security Headers
resource "aws_cloudfront_function" "security_headers" {
  count   = var.enable_cloudfront ? 1 : 0
  name    = "${var.project_name}-${var.environment}-security-headers"
  runtime = "cloudfront-js-2.0"
  comment = "Add security headers to all responses"
  publish = true
  code    = <<-EOT
function handler(event) {
    var response = event.response;
    var headers = response.headers;
    
    // Strict-Transport-Security (HSTS)
    headers['strict-transport-security'] = { 
        value: 'max-age=31536000; includeSubDomains; preload'
    };
    
    // Prevent MIME type sniffing
    headers['x-content-type-options'] = { 
        value: 'nosniff'
    };
    
    // Prevent clickjacking
    headers['x-frame-options'] = { 
        value: 'DENY'
    };
    
    // XSS Protection (legacy browsers)
    headers['x-xss-protection'] = { 
        value: '1; mode=block'
    };
    
    // Content Security Policy
    headers['content-security-policy'] = { 
        value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.execute-api.${var.aws_region}.amazonaws.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    };
    
    // Referrer Policy
    headers['referrer-policy'] = { 
        value: 'strict-origin-when-cross-origin'
    };
    
    // Permissions Policy (formerly Feature Policy)
    headers['permissions-policy'] = { 
        value: 'geolocation=(), microphone=(), camera=()'
    };
    
    return response;
}
EOT
}
