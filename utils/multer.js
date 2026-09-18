const multer = require("multer");
const fs = require("fs");
const path = require("path");
const randomString = (length) => {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};
function createUploader(destFolder) {
  fs.mkdirSync(destFolder, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destFolder);
    },
    filename: (req, file, cb) => {
      cb(null, randomString(10) + '-' + file.originalname);
    }
  });

  return multer({ storage, fileFilter });
}
module.exports = {
  uploadHome: createUploader("uploads/"),
  uploadProfile: createUploader("uploads/profile/")
};