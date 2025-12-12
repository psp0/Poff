terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 6.21"
      configuration_aliases = [aws.infra, aws.us_east_1]
    }
  }
}