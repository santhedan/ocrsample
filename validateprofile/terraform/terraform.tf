provider "aws" {
  profile = var.profile
  region  = var.aws_region
}

# Bucket for uploading the profile pictures with random text
# This is the bucket that will store the result of the profile
# validation as well
resource "aws_s3_bucket" "user-profile-picture-bucket" {
  bucket = "user-profile-picture-bucket"
}

# The layer for node-tesseract-ocr nodejs library
resource "aws_lambda_layer_version" "tesseractjs_lambda_layer" {
  s3_bucket  = var.s3_bucket_name
  s3_key     = "tesseract_js_layer.zip"
  layer_name = "tesseract_js_layer"

  source_code_hash = filebase64sha256("../layer/tesseract_js_layer.zip")

  compatible_runtimes = ["nodejs12.x"]
}

# Role assigned to the lambda function
resource "aws_iam_role" "ProfileServiceLambdaRole" {
  name               = "ProfileServiceLambdaRole"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

# IAM policy of Lambda role - Allows generation of logs and 
# reaidng / writing to a specific S3 bucket
data "template_file" "policy" {
  template = "${file("${path.module}/policy.json")}"
}

resource "aws_iam_policy" "ProfileServiceLambdaPolicy" {
  name        = "ProfileServiceLambdaPolicy"
  path        = "/"
  description = "IAM policy for Profile lambda functions"
  policy      = data.template_file.policy.rendered
}

resource "aws_iam_role_policy_attachment" "ProfileServiceRolePolicy" {
  role       = aws_iam_role.ProfileServiceLambdaRole.name
  policy_arn = aws_iam_policy.ProfileServiceLambdaPolicy.arn
}

# Lambda function to generate the profile id and random
# test message.
resource "aws_lambda_function" "GetIDAndTextHandler" {

  function_name = "GetIDAndTextHandler"

  s3_bucket = var.s3_bucket_name
  s3_key    = "validateprofile_lambda.zip"

  handler = "getidandtexthandler.handler"
  runtime = "nodejs12.x"

  layers = ["${aws_lambda_layer_version.tesseractjs_lambda_layer.arn}"]

  source_code_hash = filebase64sha256("../lambda/validateprofile_lambda.zip")

  role = aws_iam_role.ProfileServiceLambdaRole.arn

  timeout     = 3
  memory_size = "128"
}

# Lambda function to get profile status.
resource "aws_lambda_function" "GetProfileStatusHandler" {

  function_name = "GetProfileStatusHandler"

  s3_bucket = var.s3_bucket_name
  s3_key    = "validateprofile_lambda.zip"

  handler = "getprofilestatushandler.handler"
  runtime = "nodejs12.x"

  layers = ["${aws_lambda_layer_version.tesseractjs_lambda_layer.arn}"]

  source_code_hash = filebase64sha256("../lambda/validateprofile_lambda.zip")

  role = aws_iam_role.ProfileServiceLambdaRole.arn

  timeout     = 30
  memory_size = "512"
}

# API gateway
resource "aws_api_gateway_rest_api" "profile_service_apigw" {
  name        = "profile_service_apigw"
  description = "Profile service API gateway"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# The /idandtext resource
resource "aws_api_gateway_resource" "idandtextroot" {
  rest_api_id = aws_api_gateway_rest_api.profile_service_apigw.id
  parent_id   = aws_api_gateway_rest_api.profile_service_apigw.root_resource_id
  path_part   = "idandtext"
}

# Handler for HTTP GET - This gets the profile Id and random text
resource "aws_api_gateway_method" "getidandtext" {
  rest_api_id   = aws_api_gateway_rest_api.profile_service_apigw.id
  resource_id   = aws_api_gateway_resource.idandtextroot.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "getidandtext-lambda" {
  rest_api_id = aws_api_gateway_rest_api.profile_service_apigw.id
  resource_id = aws_api_gateway_method.getidandtext.resource_id
  http_method = aws_api_gateway_method.getidandtext.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.GetIDAndTextHandler.invoke_arn
}

# The /profilestatus resource
resource "aws_api_gateway_resource" "profilestatusroot" {
  rest_api_id = aws_api_gateway_rest_api.profile_service_apigw.id
  parent_id   = aws_api_gateway_rest_api.profile_service_apigw.root_resource_id
  path_part   = "profilestatus"
}

# The /profilestatus/{profileId} resource
resource "aws_api_gateway_resource" "profileidroot" {
  rest_api_id = aws_api_gateway_rest_api.profile_service_apigw.id
  parent_id   = aws_api_gateway_resource.profilestatusroot.id
  path_part   = "{profileId}"
}

# Handler for HTTP GET - This gets the status of profile validation
resource "aws_api_gateway_method" "getprofilestatus" {
  rest_api_id   = aws_api_gateway_rest_api.profile_service_apigw.id
  resource_id   = aws_api_gateway_resource.profileidroot.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.profileId" = true
  }

}

resource "aws_api_gateway_integration" "getprofilestatus-lambda" {
  rest_api_id = aws_api_gateway_rest_api.profile_service_apigw.id
  resource_id = aws_api_gateway_method.getprofilestatus.resource_id
  http_method = aws_api_gateway_method.getprofilestatus.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.GetProfileStatusHandler.invoke_arn
}

resource "aws_api_gateway_deployment" "profilestageprod" {
  depends_on = [
    aws_api_gateway_integration.getidandtext-lambda,
    aws_api_gateway_integration.getprofilestatus-lambda
  ]

  rest_api_id = aws_api_gateway_rest_api.profile_service_apigw.id
  stage_name  = "prod"
}

resource "aws_lambda_permission" "apigw-getidandtext" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.GetIDAndTextHandler.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.profile_service_apigw.execution_arn}/*/GET/idandtext"
}

resource "aws_lambda_permission" "apigw-getprofilestatus" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.GetProfileStatusHandler.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.profile_service_apigw.execution_arn}/*/GET/profilestatus/*"
}