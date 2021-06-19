// Script to test your local installation of tesseract
// and node-tesseract-ocr

const tesseract = require("node-tesseract-ocr")

const config = {
  lang: "eng",
  "user-patterns": "/Users/sdnd/start/ocrsample/validateprofile/testscript/pattern.txt"
}

tesseract
  .recognize("./modifiedAvatar.jpg", config)
  .then((text) => {
    console.log("Result:", text)
    console.log(text.trim().match("7A1FA05A16"));
  })
  .catch((error) => {
    console.log(error.message)
  })