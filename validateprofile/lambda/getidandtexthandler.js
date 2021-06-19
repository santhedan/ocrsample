const { v4: uuidv4 } = require('uuid');

var AWS = require('aws-sdk');

var s3 = new AWS.S3();

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
  }

exports.handler = async (event, context, callback) => {

    // Generate random 6 digit number
    var randomText = getRandomIntInclusive(100000, 999999).toString();

    // Generate a random id
    var profileId = uuidv4();

    // Key of the JSN file
    var jsonFileKey = profileId + ".json";

    // Generate the response body to be sent back
    var responseBody = {
        'id': profileId,
        'randomText': randomText
    }

    // Store this in the s3 bucket so we remember the random text
    // to the profile id mapping
    var putObjectParam = {
        Body: JSON.stringify(responseBody),
        Bucket: "user-profile-picture-bucket",
        Key: jsonFileKey,
        ContentType: "application/json"
    }

    var putResult = await s3.putObject(putObjectParam).promise();
    console.log("putResult: ", putResult);

    // return the profile id and random text to the client
    return {
        statusCode: 200,
        body: JSON.stringify(responseBody)
    };

}