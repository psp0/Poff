variable "s3_bucket_name" {
  description = "Name of the S3 bucket for storing Terraform state"
  type        = string
  default     = "pokehabit-tfstate-ap-northeast-2"
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-northeast-2"
}
