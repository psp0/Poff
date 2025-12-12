# Prod 환경의 기본 Provider
provider "aws" {
  region  = var.aws_region
  profile = "prod"

  # assume_role {
  #   role_arn = "arn:aws:iam::344700869057:role/mep-prod-execution-role"
  # }
}

# Terraform 버전 요구사항
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {}
}
