variable "project_name" {
  description = "A prefix for all resource names to ensure uniqueness."
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., 'production')."
  type        = string
}

variable "vpc_cidr_block" {
  description = "The CIDR block for the VPC."
  type        = string
}

variable "availability_zones" {
  description = "List of Availability Zones to use for subnets in order of preference."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 1
    error_message = "At least one availability zone must be specified."
  }
}

variable "public_subnet_cidr_blocks" {
  description = "List of public subnet CIDR blocks."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_cidr_blocks) >= 1
    error_message = "At least one public subnet CIDR block must be provided."
  }
}

variable "private_subnet_cidr_blocks" {
  description = "List of private subnet CIDR blocks."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_cidr_blocks) >= 1
    error_message = "At least one private subnet CIDR block must be provided."
  }
}

variable "az_instance_type_map" {
  description = "Map of Availability Zone to EC2 instance type for NAT instances."
  type        = map(string)
}

