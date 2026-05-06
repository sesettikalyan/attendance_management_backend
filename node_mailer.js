const nodemailer = require("nodemailer");
require("dotenv").config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "gvpcea17@gmail.com",
    pass: process.env.NODE_MAILER_PASSWORD,
  },
});

function sendEmail(req, res, mailOptionss) {
  let newMailOptions = mailOptionss;
  newMailOptions.from = "gvpcea17@gmail.com";
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