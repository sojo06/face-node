import TrainingData from "../models/TrainingData.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import { trainModel, verifyFace } from "../utils/flaskApi.js";
import ModelMeta from "../models/ModelMeta.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { v4 as uuidv4 } from "uuid";
import axios from "axios"; // Import axios for making HTTP requests to Flask API
import FormData from 'form-data';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const s3 = new S3Client({
  region: process.env.AWS_REGION, // e.g., 'ap-south-1'
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
export const getClassSummary = async (req, res) => {
  const { department, division } = req.query;
  console.log("Department: ", department);
  console.log("Division: ", division);

  try {
    const students = await User.find({ department, division, role: "student" });
    const summary = [];

    for (const student of students) {
      const data = await TrainingData.findOne({ studentId: student._id });
      const files = data?.files || [];
      if (!data) {
        data;
      }
      summary.push({
        student,
        totalUploads: files.length,
        lastUpload: data?.updatedAt || "No uploads yet",
        images: files.map((file) => file.url),
        status: data?.status || "Pending",
      });
    }

    res.json({ students: summary });
  } catch (error) {
    console.error("Error fetching class summary:", error);
    res
      .status(500)
      .json({ error: "Something went wrong while fetching class summary." });
  }
};

export const uploadStudentImages = async (req, res) => {
  try {
    const { studentId, uploadedBy } = req.body;

    const s3UploadedFiles = [];

    for (const file of req.files) {
      const fileContent = file.buffer;
      const fileExtension = path.extname(file.originalname);
      const mimeType = mime.lookup(fileExtension) || "application/octet-stream";
      const s3Key = `student-images/${studentId}/${uuidv4()}${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET, // should be defined in your .env
        Key: s3Key,
        Body: fileContent,
        ContentType: mimeType,
        ACL: "public-read", // Make the object publicly readable
      });

      await s3.send(command);

      s3UploadedFiles.push({
        url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
        storageType: "s3",
      });

      // Optionally delete the local file after upload
      // fs.unlinkSync(file.path);
    }

    // Save metadata to MongoDB
    let trainingData = await TrainingData.findOne({ studentId });

    if (trainingData) {
      trainingData.files.push(...s3UploadedFiles);
      await trainingData.save();
    } else {
      trainingData = await TrainingData.create({
        studentId,
        files: s3UploadedFiles,
      });
    }

    res.json({ message: "Upload successful", trainingData });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload files" });
  }
};

export const triggerFullTraining = async (req, res) => {
  const { department, division } = req.user;
  console.log("Department: ", department);
  console.log("Division: ", division);

  const students = await User.find({ department, division, role: "student" });
  const allData = [];

  for (const student of students) {
    const data = await TrainingData.find({ studentId: student._id });
    for (const d of data) {
      for (const file of d.files) {
        if (file.storageType === "s3") {
          allData.push({
            studentId: student._id,
            imageUrl: file.url,
          });
        }
      }
    }
  }

  const modelName = `${department}-${division}`.replace(/\s/g, "_");
  console.log("Training model name: ", modelName);

  try {
    const response = await axios.post(`${process.env.FLASK_API_URL}/train`, {
      modelName,
      data: allData,
    });

    if (response?.data?.success && response?.data?.modelPath) {
      await ModelMeta.create({
        modelName,
        department,
        division,
        filePath: response.data.modelPath,
      });

      // ✅ Set all related training data as "Processed"
      const studentIds = students.map((s) => s._id);
      await TrainingData.updateMany(
        { studentId: { $in: studentIds } },
        { $set: { status: "Processed" } }
      );

      return res.json({ message: "Training complete", result: response.data });
    } else {
      return res
        .status(500)
        .json({ message: "Training failed", result: response?.data });
    }
  } catch (error) {
    console.error("Error during training: ", error);
    return res
      .status(500)
      .json({ message: "Error during training", error: error.message });
  }
};



// export const markAttendance = async (req, res) => {
//   try {
//     const { department, division } = req.user;
//     const modelName = `${department}-${division}`;
//     const modelMeta = await ModelMeta.findOne({ modelName });

//     if (!modelMeta) {
//       return res.status(404).json({ error: "Model not found" });
//     }

//     const normalizedPath = modelMeta.filePath.replace(/\\/g, "/");

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No images provided" });
//     }

//     const verifiedAll = [];

//     // Loop through each uploaded file
//     for (const file of req.files) {
//       const base64Image = file.buffer.toString("base64");

//       const flaskResponse = await axios.post(
//         `${process.env.FLASK_API_URL}/verify`,
//         {
//           base64Image,
//           modelPath: normalizedPath,
//         }
//       );

//       const verifiedStudents = flaskResponse.data?.verifiedStudents || [];
//       verifiedAll.push(...verifiedStudents);
//     }

//     const uniqueVerified = [...new Set(verifiedAll)];
//     const date = new Date().toISOString().split("T")[0];
//     const now = new Date();
//     const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
//     const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

//     for (const label of uniqueVerified) {
//       if (label === "Unknown") continue;

//       const existing = await Attendance.findOne({
//         label: label,
//         createdAt: {
//           $gte: oneHourAgo,
//           $lte: oneHourLater,
//         },
//       });

//       if (!existing) {
//         await Attendance.create({ label });
//       } else {
//         console.log(`Attendance already marked for ${label} within 1 hour.`);
//       }
//     }

//     res.json({
//       message: "Attendance marked",
//       verified: uniqueVerified.filter((v) => v !== "Unknown"),
//     });
//   } catch (error) {
//     console.error(
//       "Error marking attendance:",
//       error.response?.data || error.message
//     );
//     res
//       .status(500)
//       .json({ error: "Something went wrong while marking attendance" });
//   }
// };

export const markAttendance = async (req, res) => {
  try {
    const { department, division ,subject } = req.body;
    console.log(department," ",division);
    if (!department || !division || !subject) {
  return res.status(400).json({ error: "Missing department, division, or subject" });
}

    const modelName = `${department}-${division}`;
    const modelMeta = await ModelMeta.findOne({ modelName });
    console.log(modelMeta);
    if (!modelMeta) {
      return res.status(404).json({ error: "Model not found" });
    }

    const normalizedPath = modelMeta.filePath.replace(/\\/g, "/");

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    const verifiedAll = [];
    console.log(req.files)
    for (const file of req.files) {
        const filePath = path.join(__dirname, "..", file.path); // or adjust '..' if needed
  const fileData = fs.readFileSync(filePath); // read from disk
  const base64Image = fileData.toString("base64");
      console.log(normalizedPath);
      const flaskResponse = await axios.post(
        `${process.env.FLASK_API_URL}/verify`,
        {
          base64Image,
          modelPath: normalizedPath,
        }
      );

      const verifiedStudents = flaskResponse.data?.verifiedStudents || [];
      verifiedAll.push(...verifiedStudents);
        fs.unlinkSync(filePath);

    }

    const uniqueVerified = [...new Set(verifiedAll)];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const today = now.toISOString().split("T")[0];

    const finalVerified = [];

    for (const label of uniqueVerified) {
      if (label === "Unknown") continue;

      // Split label into rollno and name (assuming "rollno_name" format)
      const [rollnoPart, ...nameParts] = label.split("_");
      const rollno = Number(rollnoPart);
      const name = nameParts.join("_");

      if (!rollno || !name) continue;
      console.log(rollno," ",name)
      const student = await User.findOne({
        name,
        rollno,
        role: "student",
       
      });

      if (!student) {
        console.log(`No matching student found for label: ${label}`);
        continue;
      }

      const existing = await Attendance.findOne({
        studentId: student._id,
        createdAt: { $gte: oneHourAgo, $lte: oneHourLater }
      });

      if (!existing) {
        await Attendance.create({
          studentId: student._id,
          label,
          department,
          division,
            subject, 

          date: today
        });
        finalVerified.push(label);
      } else {
        console.log(`Attendance already marked for ${label} within 1 hour.`);
      }
    }

    res.json({
      message: "Attendance marked",
      verified: finalVerified
    });
  } catch (error) {
    console.error(
      "Error marking attendance:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "Something went wrong while marking attendance"
    });
  }
};

export const getAttendanceHistory = async (req, res) => {
  try {
    const { date, fromTime, toTime } = req.query;

    if (!date || !fromTime || !toTime) {
      return res
        .status(400)
        .json({ message: "Date, fromTime and toTime are required" });
    }

    const fromDateTime = new Date(`${date}T${fromTime}`);
    const toDateTime = new Date(`${date}T${toTime}`);

    // const records = await Attendance.find({
    //   createdAt: { $gte: fromDateTime, $lte: toDateTime },
    // }).populate('studentId', 'name email ');
    const records = await Attendance.find({
      createdAt: { $gte: fromDateTime, $lte: toDateTime },
    });
    console.log(records);
    const formatted = records.map((record) => ({
      name: record?.label,
      email: record.studentId?.email,
      uid: record.studentId?._id,
      time: record.createdAt.toLocaleString(),
    }));

    res.status(200).json({ records: formatted });
  } catch (err) {
    console.error("Error fetching attendance history:", err);
    res.status(500).json({ message: "Server error" });
  }
};



export const uploadTrainedModel = async (req, res) => {
  try {
    const { department, division } = req.body;
    const file = req.file;

    if (!file || !department || !division) {
      return res.status(400).json({ error: "Missing model file or metadata" });
    }

    const modelName = `${department}-${division}`;

    // Prepare form-data payload
    const form = new FormData();
    form.append('model', fs.createReadStream(file.path), file.originalname);
    form.append('department', department);
    form.append('division', division);

    // Send to FastAPI
    const fastApiRes = await axios.post(
      `${process.env.FASTAPI_URL}/upload-model`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          maxBodyLength: Infinity, // <-- ensure large file support
          maxContentLength: Infinity
        }
      }
    );

    // Clean up temp file
    fs.unlink(file.path, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    // Save metadata in MongoDB
    const modelDoc = new ModelMeta({
      modelName,
      department,
      division,
      filePath: fastApiRes.data.model_path // match FastAPI response
    });

    await modelDoc.save();

    return res.status(200).json({
      message: 'Model uploaded successfully',
      path: fastApiRes.data.model_path
    });

  } catch (error) {
    console.error('Upload model error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Error uploading model' });
  }
};
export const getUploadedModels = async (req, res) => {
  try {
    console.log("wd")
    const models = await ModelMeta.find().sort({ createdAt: -1 });
    console.log(models) // newest first
    return res.status(200).json(models);
  } catch (error) {
    console.error('Error fetching model list:', error);
    return res.status(500).json({ error: 'Failed to fetch model list' });
  }
};