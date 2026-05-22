terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    datadog = {
      source  = "DataDog/datadog"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  backend "s3" {}
}

# Default AWS Provider (Service Account - Prod)
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront requires ACM certificates in us-east-1
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Infrastructure Account Provider (for Route53 hosted zone)
provider "aws" {
  alias   = "infra"
  region  = var.aws_region
  profile = var.aws_infra_profile

  dynamic "assume_role" {
    for_each = var.aws_infra_role_arn != "" ? [1] : []
    content {
      role_arn = var.aws_infra_role_arn
    }
  }

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = "infra"
      ManagedBy   = "terraform"
    }
  }
}

# Datadog Provider
provider "datadog" {
  api_key  = var.datadog_api_key
  app_key  = var.datadog_app_key
  api_url  = "https://api.${var.datadog_site}"
  validate = var.datadog_api_key != ""
}
