variable "aws_region" {
  description = "AWS region — af-south-1 (Cape Town) per ADR-012"
  type        = string
  default     = "af-south-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "project_name" {
  description = "Short project slug used in resource names"
  type        = string
  default     = "siteforge"
}

variable "product_domain" {
  description = "Real domain supplied by the owner (e.g. app.example.co.ke). Used for ACM cert + Route 53 + ALB."
  type        = string
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for product_domain"
  type        = string
}

variable "alert_email" {
  description = "Email endpoint for CloudWatch alarm notifications"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class — pilot single-AZ trade-off per ADR-012"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS storage in GB"
  type        = number
  default     = 20
}

variable "github_repo" {
  description = "GitHub repo slug (owner/name) allowed to assume the deploy role via OIDC"
  type        = string
  default     = "parrot-y/Construction"
}
