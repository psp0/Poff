locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  nat_instances_by_az = { for inst in aws_instance.nat : inst.availability_zone => inst.primary_network_interface_id }
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-vpc"
    }
  )
}

# Public Subnets
resource "aws_subnet" "public" {
  count = min(length(var.public_subnet_cidr_blocks), length(var.availability_zones))

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr_blocks[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-public-subnet-${count.index + 1}"
    }
  )
}

# Private Subnets
resource "aws_subnet" "private" {
  count = min(length(var.private_subnet_cidr_blocks), length(var.availability_zones))

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidr_blocks[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-private-subnet-${count.index + 1}"
    }
  )
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-igw"
    }
  )
}

# NAT Instance Security Group
resource "aws_security_group" "nat" {
  name_prefix = "${var.project_name}-nat-sg-"
  description = "Security group for NAT instance"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = var.private_subnet_cidr_blocks
    description = "Allow all TCP from Private Subnets"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-nat-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# Lambda Security Group (Moved from Database module to avoid circular dependency)
resource "aws_security_group" "lambda" {
  name_prefix = "${var.project_name}-lambda-sg-"
  description = "Security group for Lambda functions"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-lambda-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# IAM Role for SSM Session Manager
resource "aws_iam_role" "ssm_role" {
  name_prefix = "${var.project_name}-nat-ssm-role-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      },
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm_policy" {
  role       = aws_iam_role.ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "nat_instance_profile" {
  name_prefix = "${var.project_name}-nat-ssm-profile-"
  role        = aws_iam_role.ssm_role.name

  lifecycle {
    create_before_destroy = true
  }
}

data "aws_ssm_parameter" "latest_amazon_linux_2" {
  name = "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2"
}

# NAT Instance in each public subnet
resource "aws_instance" "nat" {
  count = 1

  ami                         = data.aws_ssm_parameter.latest_amazon_linux_2.value
  instance_type               = lookup(var.az_instance_type_map, aws_subnet.public[count.index].availability_zone)
  subnet_id                   = aws_subnet.public[count.index].id
  vpc_security_group_ids      = [aws_security_group.nat.id]
  iam_instance_profile        = aws_iam_instance_profile.nat_instance_profile.name
  source_dest_check           = false
  associate_public_ip_address = true

  root_block_device {
    volume_size           = 8
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  user_data = templatefile("${path.module}/nat_user_data.sh.tpl", {
    private_subnet_cidrs = join(",", var.private_subnet_cidr_blocks)
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-nat-instance-${count.index + 1}"
    }
  )

  lifecycle {
    ignore_changes        = [ami]
    create_before_destroy = true
  }
}

# Create one Private Route Table per AZ.
resource "aws_route_table" "private" {
  for_each = toset([
    for subnet in aws_subnet.private : subnet.availability_zone
  ])

  vpc_id = aws_vpc.main.id

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-private-rt-${each.key}"
    }
  )
}

# Route from each private route table to the NAT instance in the same AZ.
resource "aws_route" "private_nat" {
  for_each = aws_route_table.private

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  # Fallback to the first available NAT instance if one doesn't exist in the current AZ
  network_interface_id = lookup(local.nat_instances_by_az, each.key, values(local.nat_instances_by_az)[0])

  depends_on = [aws_instance.nat]
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-public-rt"
    }
  )
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[aws_subnet.private[count.index].availability_zone].id
}

# Database Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [for s in aws_subnet.private : s.id]

  tags = merge(
    local.common_tags,
    {
      Name = "${var.project_name}-db-subnet-group"
    }
  )
}
