import express from 'express';
import {
  getStudentProfile,
  getTrainingData,
  getAttendanceHistory
} from '../controllers/StudentController.js';
import protect from '../middleware/protect.js';
const router = express.Router();

// GET /api/students/:id/profile
router.get('/profile',protect, getStudentProfile);

// GET /api/students/:id/training-data
router.get('/training-data',protect, getTrainingData);

// GET /api/students/:id/attendance
router.get('/attendance',protect, getAttendanceHistory);

export default router;
