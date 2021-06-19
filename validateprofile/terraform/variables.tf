variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "profile" {
  type    = string
  default = "default"
}

variable "s3_bucket_name" {
  type    = string
  default = "validateprofile-codedezip-bucket"
}
