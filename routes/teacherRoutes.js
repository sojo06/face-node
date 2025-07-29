import express from 'express';
import multer from 'multer';
import protect from '../middleware/protect.js';
import {
  getClassSummary,
  uploadStudentImages,
  triggerFullTraining,
  markAttendance,
  getAttendanceHistory,
  uploadTrainedModel,
  getUploadedModels
} from '../controllers/teacherController.js';

const router = express.Router();

// Use in-memory upload
// const upload = multer({ storage: multer.memoryStorage() });
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')  // local folder on your server
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ storage: storage })
router.get('/class-summary', protect,getClassSummary);
router.post('/upload-images', upload.array('files'),protect, uploadStudentImages);
router.post('/train-all',protect, triggerFullTraining);
router.post('/mark-attendance',protect, upload.array('images'), markAttendance);
router.get('/attendance-history', protect, getAttendanceHistory);
router.post('/upload-model', protect, upload.single('model'), uploadTrainedModel);
router.get('/uploaded-models', protect, getUploadedModels);

export default router;
