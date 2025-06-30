const express = require("express");
const mongoose = require("mongoose");
const moment = require("moment");
const bcrypt = require("bcrypt");
const studentModel = require("./models/studentSchema");
const dotenv = require("dotenv");
const hodSchema = require("./models/hodSchema");
const adminSchema = require("./models/adminSchema");
const cors = require("cors");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const app = express();
const os = require("os");
dotenv.config();
const secretKeyHod = process.env.ACCESS_TOKEN_SECRET_HOD;
const secretKeyStudent = process.env.ACCESS_TOKEN_SECRET_STUDENT;
const jwt = require("jsonwebtoken");
const { sendEmail } = require("./node_mailer");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
// app.use(function (req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "X-Requested-With");
//   res.header("Access-Control-Allow-Headers", "Content-Type");
//   res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
//   next();
// });

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // ✅ Prevents duplicate responses
  }
  next();
});

const FACEPP_API_KEY = process.env.FACE_API_KEY;
const FACEPP_API_SECRET = process.env.FACE_API_SECRET;
const FACEPP_COMPARE_URL = "https://api-us.faceplusplus.com/facepp/v3/compare";

app.post("/compare", async (req, res) => {
  const { storedImageUrl, liveImageUrl } = req.body; // URLs from the frontend

  try {
    // Send request to Face++ API
    const response = await fetch(FACEPP_COMPARE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        api_key: FACEPP_API_KEY,
        api_secret: FACEPP_API_SECRET,
        image_url1: storedImageUrl,
        image_url2: liveImageUrl,
      }),
    });

    const result = await response.json();

    // Check for successful response
    if (result.confidence) {
      const threshold = 80; // Confidence threshold
      if (result.confidence >= threshold) {
        return res.json({
          success: true,
          message: "Face Match!",
          confidence: result.confidence,
        });
      } else {
        return res.json({
          success: false,
          message: "Face does not match!",
          confidence: result.confidence,
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Face comparison failed.",
        error: result,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "An error occurred.",
      error: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/", (req, res) => {
  res.send("Hello World");
});
process.env.TZ = "Asia/Kolkata"; // Set timezone to Indian Standard Time (IST)

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, "public")));

const tempDir = path.join(os.tmpdir(), "proxied-images");
app.use("/proxied-images", express.static(tempDir));

app.get("/proxy", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    // Fetch the image from the external URL
    // const decodedUrl = decodeURIComponent(url);
    // console.log("decodedUrl", decodedUrl);
    const fetch = (await import("node-fetch")).default;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch the image");
    }

    // Use arrayBuffer() instead of buffer()
    const buffer = await response.arrayBuffer();

    // Convert the arrayBuffer to a Buffer object
    const nodeBuffer = Buffer.from(buffer);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Sanitize the file name by encoding the URL and removing unwanted characters
    const sanitizedFileName = encodeURIComponent(url)
      .replace(/%2F/g, "_") // Replace URL-encoded slashes with underscores
      .replace(/%3F/g, "") // Remove URL-encoded '?' characters
      .replace(/%3D/g, "") // Remove URL-encoded '=' characters
      .replace(/%26/g, "") // Remove URL-encoded '&' characters
      .replace(/[^a-zA-Z0-9-_\.]/g, ""); // Remove any other non-alphanumeric characters

    const filePath = path.join(tempDir, `${Date.now()}-${sanitizedFileName}`);

    // Save the image buffer to a file
    fs.writeFileSync(filePath, nodeBuffer);
    res.setHeader("Content-Type", "image/jpeg");

    // Construct the URL for the stored image
    const proxiedImageUrl = `/proxied-images/${path.basename(filePath)}`;

    res.json({ url: proxiedImageUrl });
  } catch (error) {
    console.error("Error fetching the resource:", error);
    res.status(500).json({ error: `${error}` });
  }
});

app.get("/proxy-face", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    const response = await fetch(url);
    console.log(response);
    if (!response.ok) {
      throw new Error("Failed to fetch the image");
    }

    // Convert the image to Base64
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const contentType = response.headers.get("Content-Type");

    // Create a Base64 URI
    const base64Uri = `data:${contentType};base64,${base64Image}`;

    // Send the Base64 URI in the response
    res.json({ image: base64Uri });
  } catch (error) {
    console.error("Error fetching the resource:", error);
    res.status(500).json({ error: `${error}` });
  }
});

app.post("/send-email", async (req, res) => {
  try {
    const { to, subject, text } = req.body;

    const mailOptions = {
      subject,
      to,
      text,
    };

    sendEmail(null, null, mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/students", async (req, res) => {
  try {
    const students = await studentModel.find({});
    return res.status(200).json({ students }); // ✅ Ensures only one response
  } catch (error) {
    console.error("Error fetching students:", error);
  }
});


app.post("/register/students", async (req, res) => {
  try {
    const existingStudent = await studentModel.findOne({
      pinno: req.body.pinno,
    });
    if (existingStudent) {
      return res
        .status(400)
        .json({ message: "Student with this roll number already exists" });
    }

    const salt = await bcrypt.genSalt();
    let password = req.body.password;
    const hashedPassword = await bcrypt.hash(password, salt);
    req.body.password = hashedPassword;

    // Create the student record
    const student = await studentModel.create(req.body);

    // Generate QR code for the student ID
    const qrCodeUrl = await QRCode.toDataURL(student._id.toString());

    // Update the student record with the QR code URL
    student.qrCodeUrl = qrCodeUrl;
    await student.save();

    res
      .status(200)
      .json({ student, message: "Student registered successfully" });
  } catch (error) {
    console.log("error");
    res.status(500).json({ message: error.message });
  }
});

app.post("/register/hod", async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10);
    let password = req.body.password;
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log("salt", salt, hashedPassword);
    req.body.password = hashedPassword;
    const hod = await hodSchema.create(req.body);
    res.status(200).json(hod);
  } catch (error) {
    console.log("error");
    res.status(500).json({ message: error.message });
  }
});

app.get("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const specificStudent = await studentModel.findById(id);
    // console.log("this",specificStudent);
    res.status(200).json({ student: specificStudent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (req.body.password) {
      const salt = await bcrypt.genSalt();
      let password = req.body.password;
      const hashedPassword = await bcrypt.hash(password, salt);
      console.log("salt", salt, hashedPassword);
      req.body.password = hashedPassword;
      const updateStudent = await studentModel.findByIdAndUpdate(id, req.body);
      if (!updateStudent) {
        return res.status(404).json({ message: "not found" });
      }
    } else {
      const updateStudent = await studentModel.findByIdAndUpdate(id, req.body);
      if (!updateStudent) {
        return res.status(404).json({ message: "not found" });
      }
    }

    const updatedStudent = await studentModel.findById(id);
    res.status(200).json(updatedStudent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.delete("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleteStudent = await studentModel.findByIdAndDelete(id);
    if (!deleteStudent) {
      return res.status(404).json({ message: "not found" });
    }
    res.status(200).json({ message: "deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/// LOGIN

app.post("/students/login", async (req, res) => {
  try {
    const student = await studentModel.findOne({ pinno: req.body.pinno });

    if (!student) {
      return res.status(400).json({ message: "no student found" });
    }

    const isPasswordValid = await bcrypt.compare(
      req.body.password,
      student.password
    );

    if (isPasswordValid) {
      const token = jwt.sign({ username: student.pinno }, secretKeyStudent, {
        expiresIn: "7d",
      });

      // Update last logged in time
      student.lastlogged = new Date();
      await student.save();

      res.status(200).json({ token, student, message: "Login Successful!" });
    } else {
      res.status(400).json({ message: "invalid Username or Password" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
});
// HOD CRUD

app.get("/hod", async (req, res) => {
  try {
    const hods = await hodSchema.find({});
    res.status(200).json(hods);
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.log(error);
  }
});

app.get("/hod/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const specificHod = await hodSchema.findById(id);
    // console.log("this",specificStudent);
    res.status(200).json(specificHod);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.put("/hod/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (req.body.password) {
      const salt = await bcrypt.genSalt();
      let password = req.body.password;
      const hashedPassword = await bcrypt.hash(password, salt);
      console.log("salt", salt, hashedPassword);
      req.body.password = hashedPassword;
      const UpdateHOD = await hodSchema.findByIdAndUpdate(id, req.body);
      if (!UpdateHOD) {
        return res.status(404).json({ message: "not found" });
      }
    } else {
      const UpdateHOD = await hodSchema.findByIdAndUpdate(id, req.body);
      if (!UpdateHOD) {
        return res.status(404).json({ message: "not found" });
      }
    }
    const UpdatedHOD = await hodSchema.findById(id);
    res.status(200).json(UpdatedHOD);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.delete("/hod/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleteHOD = await hodSchema.findByIdAndDelete(id);
    if (!deleteHOD) {
      return res.status(404).json({ message: "not found" });
    }
    res.status(200).json({ message: "deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/admin/login", async (req, res) => {
  try {
    const admin = await adminSchema.findOne({ email: req.body.email });

    if (!admin) {
      return res.status(400).json({ message: "Cannot find admin" });
    }

    const isPasswordValid = await bcrypt.compare(
      req.body.password,
      admin.password
    );

    if (isPasswordValid) {
      // const token = jwt.sign({ username: admin.email }, secretKeyHod, {
      //   expiresIn: "7d",
      // });
      return res.status(200).json({ admin, message: "Login Successful!" });
    }

    return res.status(400).json({ message: "invalid Username or Password" });
  } catch (error) {
   return res.status(500).send({ error: error.message });
  }
});

app.post("/send-email", async (req, res) => {
  try {
    const { to, subject, text } = req.body;

    const mailOptions = {
      subject,
      to,
      text,
    };

    sendEmail(null, null, mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// HOD LOGIN

function verifyTokenStudent(req, res, next) {
  const token = req.headers["authorization"];
  if (typeof token !== "undefined") {
    jwt.verify(token, secretKeyStudent, (err, authData) => {
      if (err) {
        res.sendStatus(403); // Forbidden
      } else {
        req.hod = authData;
        next();
      }
    });
  } else {
    res.sendStatus(403); // Forbidden
  }
}
function verifyTokenHod(req, res, next) {
  const token = req.headers["authorization"];
  if (typeof token !== "undefined") {
    jwt.verify(token, secretKeyHod, (err, authData) => {
      if (err) {
        res.sendStatus(403); // Forbidden
      } else {
        req.hod = authData;
        next();
      }
    });
  } else {
    res.sendStatus(403); // Forbidden
  }
}

app.post("/hod/login", async (req, res) => {
  try {
    const hod = await hodSchema.findOne({ email: req.body.email });

    if (!hod) {
      return res.status(400).json({ message: "Cannot find staff" });
    }

    const isPasswordValid = await bcrypt.compare(
      req.body.password,
      hod.password
    );

    if (isPasswordValid) {
      const token = jwt.sign({ username: hod.idno }, secretKeyHod, {
        expiresIn: "7d",
      });
      res.status(200).json({ token, hod, message: "Login Successful!" });
    } else {
      res.status(400).json({ message: "invalid Username or Password" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
});

const otpSchema = new mongoose.Schema({
  pinno: String,
  otp: String,
  createdAt: { type: Date, expires: 300, default: Date.now }, // Set expiry for OTP
});

const OTP = mongoose.model("OTP", otpSchema);

function generateOTP() {
  const min = 100000; // Minimum value (100000)
  const max = 999999; // Maximum value (999999)

  // Generate a random number between min and max
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

  return randomNumber;
}

async function saveOTPToDB(otp, pinno) {
  try {
    const newOTP = new OTP({
      pinno: pinno,
      otp: otp,
    });
    await newOTP.save();
    console.log("OTP saved successfully");
  } catch (error) {
    console.error("Error saving OTP:", error);
  }
}

app.post("/forgotPasswordStudent", async (req, res) => {
  try {
    const rollNumber = req.body.pinno;
    const specificStudent = await studentModel.findOne({
      pinno: rollNumber,
    });
    if (specificStudent) {
      const otp = generateOTP();
      const mailOptions = {
        subject: "Forgot Password Reset",
        to: specificStudent.email,
        text: `This is your OTP ${otp}`,
        html: `
                <div class="background">
                    <div class="innerDive">
                        <p class="header">Your OTP to Reset Password</p>
                        <p class="otp">OTP: <strong>${otp}</strong></p>
                        <p class="message">
                            This is an auto-generated email. Please do not reply to this mail.<br />
                            You have requested an OTP to reset your password. If this was not you, please ignore this email.<br />
                            If you believe this request was made in error, contact our support team immediately.<br />
                            For any questions or assistance, feel free to reach out to our friendly support team.
                        </p>
                        <p class="footer">With Regards,<br />GVPCE</p>
                    </div>
                </div>
                <style>
                    .background {
                        background-color: #f5f5f5;
                        width: 100%;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .innerDive {
                        background-color: #ffffff;
                        width: 100%;
                        max-width: 600px;
                        padding: 30px;
                        border-radius: 12px;
                        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
                        text-align: center;
                        font-family: Arial, sans-serif;
                    }
                    .logo {
                        width: 120px;
                        margin-bottom: 20px;
                    }
                    .header {
                        font-size: 24px;
                        font-weight: bold;
                        color: #333333;
                        margin-bottom: 20px;
                    }
                    .otp {
                        font-size: 20px;
                        color: #d9534f;
                        margin-bottom: 20px;
                    }
                    .message {
                        font-size: 16px;
                        color: #555555;
                        line-height: 1.6;
                        margin-bottom: 20px;
                    }
                    .footer {
                        font-size: 14px;
                        color: #777777;
                        margin-top: 20px;
                    }
                </style>
                `,
      };

      sendEmail(null, null, mailOptions);
      console.log(rollNumber)
      saveOTPToDB(otp, rollNumber);
      res.status(200).json({
        message: "OTP sent successfully",
        studentId: specificStudent._id,
      });
    } else {
      res.status(404).json({ message: "student not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/verifyOTP", async (req, res) => {
  try {
    const { pinno, otp } = req.body;

    const result = await OTP.findOneAndDelete({ pinno: pinno, otp: otp });

    if (!result) {
      console.log(result);
      res.status(404).json({ message: "Invalid OTP" });
    } else {
      res.status(200).json({ message: "OTP verified successfully" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

app.post("/forgotPasswordStaff", async (req, res) => {
  try {
    const emailId = req.body.email;
    const specificStudent = await hodSchema.findOne({
      email: emailId,
    });

    if (specificStudent) {
      const otp = generateOTP();
      const mailOptions = {
        subject: "Forgot Password Reset",
        to: emailId,
        text: `This is your OTP ${otp}`,
        html: `
                <div>
                <p>OTP to reset your password is ${otp}</p>
                
                <p>This is an auto generated mail. Please do not reply to this mail.</p>
                <p>You have requested to reset the password. If you haven't requested that please Ignore this mail.</p>
            
                <p>Regards,</p>
                <p>GPT Pendurthi</p>
            `,
      };
      sendEmail(null, null, mailOptions);
      saveOTPToDB(otp, emailId);
      res.status(200).json({
        message: "OTP sent successfully",
        staffId: specificStudent.id,
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// posting attendance

app.post("/attendance", async (req, res) => {
  try {
    const { studentId, date, status, remarks, pic } = req.body;

    // Validate input
    if (!studentId || !date || !status) {
      return res
        .status(400)
        .json({ message: "Student ID, date, and status are required" });
    }

    // Validate status
    const validStatuses = ["Present", "Absent", "Leave"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Valid statuses are: Present, Absent, Leave",
      });
    }

    // // Validate date format
    // if (!moment(date, "YYYY-MM-DD", true).isValid()) {
    //   return res
    //     .status(400)
    //     .json({ message: "Invalid date format. Use YYYY-MM-DD" });
    // }

    // Find the student by ID
    const student = await studentModel.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check for duplicate attendance record with status "Present"
    const existingRecord = student.attendance.find((record) =>
      moment(record.date).isSame(date, "day")
    );
    if (existingRecord) {
      return res.status(400).json({
        message: "Attendance for this date is already recorded",
        status: 400,
      });
    }

    student.attendance.push({ date, status, remarks, pic });
    await student.save();

    res.status(200).json({
      message: `HI ${student.name}, Your attendance for today has been recorded successfully`,
      student,
      status: 200,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/attendance/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Please provide both startDate and endDate in the query.",
      });
    }

    const student = await studentModel.findById(studentId).select("attendance");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Parse dates
    const start = moment(startDate).startOf("day");
    const end = moment(endDate).endOf("day");

    // Generate a date range array
    const dateRange = [];
    let currentDate = start.clone();
    while (currentDate.isBefore(end) || currentDate.isSame(end, "day")) {
      dateRange.push(currentDate.toISOString());
      currentDate = currentDate.add(1, "day");
    }

    // Map attendance records
    const attendanceMap = {};
    student.attendance.forEach((record) => {
      attendanceMap[moment(record.date).startOf("day").toISOString()] = {
        status: record.status,
        remarks: record.remarks || "",
      };
    });

    let presentCount = 0;
    const response = dateRange.map((date) => {
      const record = attendanceMap[moment(date).startOf("day").toISOString()];
      if (record) {
        if (record.status === "Present") presentCount++;
        return {
          date,
          status: record.status,
          remarks: record.remarks,
          message: "Attendance already registered",
        };
      } else {
        return {
          date,
          status: "Absent",
          remarks: "",
          message: "Marked as Absent (no record found)",
        };
      }
    });

    const attendancePercentage = (presentCount / dateRange.length) * 100;

    res.status(200).json({
      response,
      attendancePercentage,
      attendedClasses: presentCount,
      totalClasses: dateRange.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/get-attendance/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await studentModel.findById(studentId).select("attendance");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ attendance: student.attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/attendance", async (req, res) => {
  try {
    const students = await studentModel
      .find({})
      .select("name department attendance");

    if (!students.length) {
      return res.status(404).json({ message: "No students found" });
    }

    res.status(200).json({ students });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// sending mail of the attendance of the student in the .csv format
app.post("/sendAttendance", async (req, res) => {
  try {
    const { studentId, startDate, endDate, staffEmail } = req.body;

    if (!studentId || !startDate || !endDate) {
      return res.status(400).json({
        message: "Student ID, startDate, and endDate are required",
      });
    }

    const student = await studentModel
      .findById(studentId)
      .select("name attendance pinno");
    console.log(student);
    // get student name and pinno
    const { name, pinno } = student;

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Parse dates
    const start = moment(startDate).startOf("day");
    const end = moment(endDate).endOf("day");

    // Generate a date range array
    const dateRange = [];
    let currentDate = start.clone();
    while (currentDate.isBefore(end) || currentDate.isSame(end, "day")) {
      dateRange.push(currentDate.toISOString());
      currentDate = currentDate.add(1, "day");
    }

    // Map attendance records
    const attendanceMap = {};
    student.attendance.forEach((record) => {
      attendanceMap[moment(record.date).startOf("day").toISOString()] = {
        status: record.status,
        remarks: record.remarks || "",
      };
    });

    let csv = "\nDate,Status,Remarks\n";
    let presentCount = 0;
    dateRange.forEach((date) => {
      const record = attendanceMap[moment(date).startOf("day").toISOString()];
      if (record && record.status === "Present") presentCount++;
      csv += `${moment(date).format("YYYY-MM-DD")},${
        record ? record.status : "Absent"
      },${record ? record.remarks : ""}\n`;
    });

    // Calculate attendance percentage
    const attendancePercentage = (presentCount / dateRange.length) * 100;

    // add the student name, pinno, attendance percentage, attended classes, and total classes to the csv
    csv = `Student Name,${name}\nStudent Roll Number,${pinno}\nAttendance Percentage,${attendancePercentage.toFixed(
      2
    )}%\nAttended Classes:,${presentCount}/${
      dateRange.length
    }\n${csv}`;

    const mailOptions = {
      subject: "Attendance Report",
      to: staffEmail,
      text: "Please find the attached attendance report.",
      attachments: [
        {
          filename: "attendance.csv",
          content: csv,
        },
      ],
    };
    res.status(200).json({ message: "Attendance report sent successfully" });
    await sendEmail(null, null, mailOptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//make a get api to get the attendance of a particular branch with start and end date
app.get("/get-attendance-branch", async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;

    if (!department || !startDate || !endDate) {
      return res.status(400).json({
        message: "Branch, startDate, and endDate are required",
      });
    }

    // Parse and validate dates
    const start = moment(startDate, "YYYY-MM-DD").startOf("day");
    const end = moment(endDate, "YYYY-MM-DD").endOf("day");

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Fetch students in the selected department
    const students = await studentModel
      .find({ department })
      .select("name pinno attendance");

    if (!students.length) {
      return res.status(404).json({ message: "No students found" });
    }

    // Generate date range
    const dateRange = [];
    let currentDate = start.clone();
    while (currentDate.isSameOrBefore(end, "day")) {
      dateRange.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }

    // Create attendance response
    const response = dateRange.map((date) => {
      const records = students.map(({ name, pinno, attendance }) => {
        const record = attendance.find(
          (att) => moment(att.date).format("YYYY-MM-DD") === date
        );

        if (record) {
          return {
            name,
            pinno,
            date,
            status: record.status,
            remarks: record.remarks || "",
            message: "Attendance already registered",
          };
        } else {
          return {
            name,
            pinno,
            date,
            status: "Absent",
            remarks: "",
            message: "Marked as Absent (no record found)",
          };
        }
      });

      return { date, records };
    });

    res.status(200).json({ response });
  } catch (error) {
    console.error("Error fetching branch attendance:", error);
    res.status(500).json({ message: "Server error, please try again later" });
  }
});

// sending mail of the attendance of a branch in the .csv format
app.post("/sendAttendanceBranch", async (req, res) => {
  try {
    const { department, startDate, endDate, staffEmail } = req.body;

    if (!department || !startDate || !endDate) {
      return res.status(400).json({
        message: "Branch, startDate, and endDate are required",
      });
    }

    const students = await studentModel
      .find({ department })
      .select("name pinno attendance");

    if (!students.length) {
      return res.status(404).json({ message: "No students found" });
    }

    // Parse dates
    const start = moment(startDate).startOf("day");
    const end = moment(endDate).endOf("day");

    // Generate a date range array
    const dateRange = [];
    let currentDate = start.clone();
    while (currentDate.isBefore(end) || currentDate.isSame(end, "day")) {
      dateRange.push(currentDate.toISOString());
      currentDate = currentDate.add(1, "day");
    }

    // Build the CSV
    let csv = ` ${department} Attendance \nStudent Name,Student Roll Number,Date,Status,Remarks\n`;
    students.forEach((student) => {
      const { name, pinno, attendance } = student;

      // Map attendance records
      const attendanceMap = {};
      attendance.forEach((record) => {
        attendanceMap[moment(record.date).startOf("day").toISOString()] = {
          status: record.status,
          remarks: record.remarks || "",
        };
      });

      dateRange.forEach((date) => {
        const record = attendanceMap[moment(date).startOf("day").toISOString()];
        csv += `${name},${pinno},${moment(date).format("YYYY-MM-DD")},${
          record ? record.status : "Absent"
        },${record ? record.remarks : ""}\n`;
      });
    });

    const mailOptions = {
      subject: "Attendance Report",
      to: staffEmail,
      text: "Please find the attached attendance report.",
      attachments: [
        {
          filename: "attendance.csv",
          content: csv,
        },
      ],
    };

    res.status(200).json({ message: "Attendance report sent successfully" });

    await sendEmail(null, null, mailOptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not defined in your .env file.");
} else {
  // Attempt to connect to MongoDB using process.env.MONGODB_URI
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      app.listen(process.env.PORT || 3000, () => {
        console.log(
          `Node.js server is running on port ${process.env.PORT || 3000}`
        );
      });
      console.log("MongoDB connected");
    })
    .catch((err) => {
      console.log(err);
    });
}
