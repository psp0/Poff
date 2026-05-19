# Dev 환경의 기본 Provider
provider "aws" {
  region  = var.aws_region
  profile = "dev-exec-poff"

  # assume_role {
  #   role_arn = "arn:aws:iam::604225987817:role/poff-dev-execution-role"
  # }
}

# Terraform 버전 요구사항
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {}
}
