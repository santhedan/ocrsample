const textToImage = require('text-to-image');
const fs = require("fs");
const sharp = require("sharp");
const axios = require('axios').default;

// Import entire SDK - Initialize as per your local configuration
var AWS = require('aws-sdk');
var credentials = new AWS.SharedIniFileCredentials({profile: 'default'});
AWS.config.credentials = credentials;
AWS.config.update({region: 'ap-south-1'});

// Create the s3 object
var s3 = new AWS.S3();

// Change this as per your deployment
const GET_RANDOM_CODE_URL = "https://ua4136y1ej.execute-api.ap-south-1.amazonaws.com/prod/idandtext";
const GET_PROFILE_STATUS_URL = "https://ua4136y1ej.execute-api.ap-south-1.amazonaws.com/prod/profilestatus/"

const getRandomCodeAndProfileId = async() => {
    // Do an HTTP GET request to the GET_RANDOM_CODE_URL
    let response = await axios.get(GET_RANDOM_CODE_URL);
    console.log(response.data);
    return response.data;
}

const getProfileStatus = async(profileId) => {
    // Do an HTTP GET request to the GET_PROFILE_STATUS_URL
    let url = GET_PROFILE_STATUS_URL + profileId;
    let response = await axios.get(url);
    return response.data;
}

const generateCompositeImage = async (randomText) => {

    // Generate the image from text
    const dataUri = textToImage.generateSync(
                    randomText, 
                    {   maxWidth: 1500,
                        fontSize: 200,
                        textAlign: 'center',
                        verticalAlign: 'center',
                        fontFamily: 'Arial',
                        lineHeight: 30,
                        bgColor: "white",
                        textColor: "black"
                    });

    // Get the base 64 part
    const uri = dataUri.split(';base64,').pop()

    // Get the image buffer
    let imgBuffer = Buffer.from(uri, 'base64');

    // Load the profile image from buffer
    let profilePicBuffer = fs.readFileSync("./avatar.jpg");

    // Compose the images and write the resultant composite image
    let outputBuffer = await sharp(profilePicBuffer)
                        .composite([{input: imgBuffer, gravity: 'south' }])
                        .toFormat('jpeg')
                        .jpeg({quality: 100})
                        .withMetadata()
                        .toBuffer();

    // Write the composite image to local file
    fs.writeFileSync("./modifiedAvatar.jpg", outputBuffer);
}

const uploadAvatarFileToS3 = async(profileId) => {
    // Read the modifiedAvatar.jpg file
    let profilePicBuffer = fs.readFileSync("./modifiedAvatar.jpg");
    // We have to upload the modifiedAvatar.jpg file to s3 and its
    // key should be the <<profileId>>.jpg
    let s3Key = profileId + ".jpg";
    var putObjectParam = {
        Body: profilePicBuffer,
        Bucket: "user-profile-picture-bucket",
        Key: s3Key,
        ContentType: "image/jpeg"
    }
    var putResult = await s3.putObject(putObjectParam).promise();
    console.log(putResult);
}

const performProfileVerificationWorkflow = async() => {
    // first get the profile id and random code
    let randomCodeAndProfileId = await getRandomCodeAndProfileId();
    // generate composite image from avatar.jpeg and the random code
    await generateCompositeImage(randomCodeAndProfileId.randomText);
    // upload the composite image to s3
    await uploadAvatarFileToS3(randomCodeAndProfileId.id);
    // get the profile status
    let profileStatus = await getProfileStatus(randomCodeAndProfileId.id);
    console.log("profileStatus: ", profileStatus);
}

performProfileVerificationWorkflow();