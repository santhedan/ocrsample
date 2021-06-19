var AWS = require('aws-sdk');
const fs = require("fs");

var s3 = new AWS.S3();

const tesseract = require("node-tesseract-ocr")

// Using pre-built tesseract executable for AMZ Linux from 
// https://github.com/bweigel/aws-lambda-tesseract-layer

// Using https://github.com/zapolnoch/node-tesseract-ocr nodejs wrapper
// for tesseract

// Inspired by https://aws.amazon.com/blogs/compute/running-executables-in-aws-lambda/
// to make sure that tesseract executable and libraries are available
// in path
const lambdaPath = process.env["LAMBDA_TASK_ROOT"];
const libPath = process.env["LAMBDA_TASK_ROOT"] + "/tesseract/lib";
const binPath = process.env["LAMBDA_TASK_ROOT"] + "/tesseract/bin";
const dataPath = process.env["LAMBDA_TASK_ROOT"] + "/tesseract/tesseract/share/tessdata";

// Add the tesseract in path
process.env["PATH"] = process.env["PATH"] + ":" + lambdaPath + ":" + binPath + ":" + libPath;
// Add path to libraries required by teserract
process.env["LD_LIBRARY_PATH"] = process.env["LD_LIBRARY_PATH"] + ":" + lambdaPath + ":" + binPath + ":" + libPath;
// Path where the training data is located - "fast" training data for english is used in this sample.
process.env["TESSDATA_PREFIX"] = dataPath;
// Pattern of text to be recognized - helps if you know what you are looing for!
// Since we want to scan for 6 digits - our patern file says look for 6 digits
const patternFile = lambdaPath + "/tesseract/pattern.txt";


exports.handler = async (event, context, callback) => {

    // Log request
    console.log(JSON.stringify(event));
    console.log(process.env.PATH);
    console.log(process.env.LD_LIBRARY_PATH);
    console.log(process.env.TESSDATA_PREFIX);
    console.log(patternFile);

    // Get the profile id
    let profileId = event.pathParameters.profileId;
    let profileImageFileName = profileId + ".jpg";
    let profileJSONFileName = profileId + ".json";

    // Read the JSON file from S3
    var s3ReadFileParam = {
        Bucket: "user-profile-picture-bucket",
        Key: profileJSONFileName
    }
    
    var profileJsonObj = await s3.getObject(s3ReadFileParam).promise();

    // Do we have json file?
    if (!profileJsonObj || !profileJsonObj.Body) {
        return {
            statusCode: 500,
            body: '{"error":"Invalid request. No profile information exists."}'
        };
    }
    let profileJson = JSON.parse(profileJsonObj.Body);
    console.log("profileJson: ", profileJson);
    
    // Read the profile image file from S3
    s3ReadFileParam = {
        Bucket: "user-profile-picture-bucket",
        Key: profileImageFileName
    }

    var profileImageObj = await s3.getObject(s3ReadFileParam).promise();

    // Do we have image file?
    if (!profileImageObj || !profileImageObj.Body) {
        return {
            statusCode: 500,
            body: '{"error":"Invalid request. No profile picture exists."}'
        };
    }

    console.log(profileImageObj.Body.length);

    // Save the file to /tmp folder on the Lambda VM.
    // This improves the OCR accuracy.
    fs.writeFileSync("/tmp/modifiedAvatar.jpg", profileImageObj.Body);

    // Now read text from the image
    const promise = new Promise(function(resolve, reject) {
        tesseract.recognize("/tmp/modifiedAvatar.jpg", 
            {
                lang: "eng", // We only have english langage data
                "user-patterns": patternFile // pattern to speed up detection
            })
            .then((textFromImage) => {
                console.log("textFromImage(original): ", textFromImage)
                console.log("textFromImage(trimmed): ", textFromImage.trim())
                console.log("profileJson.randomText: ", profileJson.randomText)
                if (textFromImage.trim().match(profileJson.randomText)) {
                    let response = {
                        statusCode: 200,
                        body: '{"status":"Profile validated"}'
                    };
                    resolve(response);
                } else {
                    let response = {
                        statusCode: 200,
                        body: '{"status":"Profile invalid"}'
                    };
                    resolve(response);
                }
            })
            .catch((error) => {
                console.log(error)
                console.log(error.message)
                let response = {
                    statusCode: 200,
                    body: '{"status":"Profile invalid"}'
                };
                resolve(response);
            });
    });
    return promise;

}