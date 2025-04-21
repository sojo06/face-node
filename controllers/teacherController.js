import TrainingData from '../models/TrainingData.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import { trainModel, verifyFace } from '../utils/flaskApi.js';
import ModelMeta from '../models/ModelMeta.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios'; // Import axios for making HTTP requests to Flask API
import { log } from 'console';

const s3 = new S3Client({
  region: process.env.AWS_REGION, // e.g., 'ap-south-1'
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
export const getClassSummary = async (req, res) => {
  const { department, division } = req.user;
  console.log("Department: ", department);
  console.log("Division: ", division);

  try {
    const students = await User.find({ department, division, role: 'student' });
    const summary = [];

    for (const student of students) {
      const data = await TrainingData.findOne({ studentId: student._id });
      const files = data?.files || [];
      if(!data){
        data
      }
      summary.push({
        student,
        totalUploads: files.length,
        lastUpload: data?.updatedAt || 'No uploads yet',
        images: files.map(file => file.url),
        status: data?.status || 'Pending',
      });
    }

    res.json({ students: summary });

  } catch (error) {
    console.error('Error fetching class summary:', error);
    res.status(500).json({ error: 'Something went wrong while fetching class summary.' });
  }
};



export const uploadStudentImages = async (req, res) => {
  try {
    const { studentId, uploadedBy } = req.body;

    const s3UploadedFiles = [];

    for (const file of req.files) {
      const fileContent = file.buffer;
      const fileExtension = path.extname(file.originalname);
      const mimeType = mime.lookup(fileExtension) || 'application/octet-stream';
      const s3Key = `student-images/${studentId}/${uuidv4()}${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET, // should be defined in your .env
        Key: s3Key,
        Body: fileContent,
        ContentType: mimeType,
        ACL: 'public-read'                 // Make the object publicly readable

      });

      await s3.send(command);

      s3UploadedFiles.push({
        url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
        storageType: 's3'
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
        files: s3UploadedFiles
      });
    }

    res.json({ message: 'Upload successful', trainingData });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload files' });
  }
};



export const triggerFullTraining = async (req, res) => {
  const { department, division } = req.user;
  console.log("Department: ", department);
  console.log("Division: ", division);

  const students = await User.find({ department, division, role: 'student' });
  const allData = [];

  for (const student of students) {
    const data = await TrainingData.find({ studentId: student._id });
    for (const d of data) {
      for (const file of d.files) {
        if (file.storageType === 's3') {
          allData.push({
            studentId: student._id,
            imageUrl: file.url
          });
        }
      }
    }
  }

  const modelName = `${department}-${division}`.replace(/\s/g, '_');
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
      const studentIds = students.map(s => s._id);
      await TrainingData.updateMany(
        { studentId: { $in: studentIds } },
        { $set: { status: 'Processed' } }
      );

      return res.json({ message: 'Training complete', result: response.data });
    } else {
      return res.status(500).json({ message: 'Training failed', result: response?.data });
    }
  } catch (error) {
    console.error('Error during training: ', error);
    return res.status(500).json({ message: 'Error during training', error: error.message });
  }
};




export const markAttendance = async (req, res) => {
  try {
    const { department, division } = req.body;

   
    let modelName=`${department}-${division}`
    const modelMeta = await ModelMeta.findOne({ modelName });
    if (!modelMeta) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // ✅ Convert image to base64 from memory buffer
    const base64Image = req.file.buffer.toString('base64');
    // console.log('Base64 Image:', base64Image);
    console.log('Model Path:', modelMeta.filePath);
    // ✅ Send to Flask directly
    const normalizedPath = modelMeta.filePath.replace(/\\/g, '/');

    const flaskResponse = await axios.post(`${process.env.FLASK_API_URL}/verify`, {
      base64Image,
      modelPath: normalizedPath
    });

    const verifiedStudents = flaskResponse.data?.verifiedStudents || [];

    const date = new Date().toISOString().split('T')[0];
    const saved = [];
    console.log('Verified Students:', verifiedStudents);
    for (const studentId of verifiedStudents) {
      const attendance = await Attendance.create({
        studentId,
        department,
        division,
        date
      });

      const user = await User.findById(studentId);

      saved.push({
        studentId,
        name: user?.name || 'Unknown',
        email: user?.email || 'Unknown'
      });
    }

    res.json({ message: 'Attendance marked', count: saved.length, students: saved });
  } catch (error) {
    console.error('Error marking attendance:', error.response?.data || error.message);
    res.status(500).json({ error: 'Something went wrong while marking attendance' });
  }
};