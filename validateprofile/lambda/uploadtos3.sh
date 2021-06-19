rm -rf ./validateprofile_lambda.zip
find . -name "*" -print | zip validateprofile_lambda -@
/usr/local/bin/aws2 --profile $1 s3 cp ./validateprofile_lambda.zip s3://validateprofile-codedezip-bucket/validateprofile_lambda.zip