const nodemailer = require("nodemailer");
require("dotenv").config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODE_MAILER_USER_ID,
    pass: process.env.NODE_MAILER_PASSWORD,
  },
});

function sendEmail(req, res, mailOptionss) {
  let newMailOptions = mailOptionss;
  newMailOptions.from = "gvpce.edu@gmail.com";
  console.log(newMailOptions);
  transporter.sendMail(newMailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

module.exports = {
  sendEmail,
};