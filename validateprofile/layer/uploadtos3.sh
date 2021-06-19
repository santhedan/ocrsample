# Create bucket - Change the name of the bucket according to
# your environment
/usr/local/bin/aws2 --profile $1 s3api create-bucket --bucket=validateprofile-codedezip-bucket --region=ap-south-1 --create-bucket-configuration LocationConstraint=ap-south-1

rm -rf ./tesseract_js_layer.zip
zip -r9 ./tesseract_js_layer.zip ./nodejs
/usr/local/bin/aws2 --profile $1 s3 cp ./tesseract_js_layer.zip s3://validateprofile-codedezip-bucket/tesseract_js_layer.zip
