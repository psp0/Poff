# 기본 Provider (Infra 계정)
provider "aws" {
  region = var.aws_region
  profile = "infra"  
}