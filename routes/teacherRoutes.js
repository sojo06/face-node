import express from 'express';
import multer from 'multer';
import protect from '../middleware/protect.js';
import {
  getClassSummary,
  uploadStudentImages,
  triggerFullTraining,
  markAttendance,
  getAttendanceHistory
} from '../controllers/teacherController.js';

const router = express.Router();

// ⬇️ Use in-memory upload
const upload = multer({ storage: multer.memoryStorage() });

router.get('/class-summary', protect,getClassSummary);
router.post('/upload-images', upload.array('files'),protect, uploadStudentImages);
router.post('/train-all',protect, triggerFullTraining);
router.post('/mark-attendance',protect, upload.single('image'), markAttendance);
router.get('/attendance-history', protect, getAttendanceHistory);

export default router;
