import User from '../models/User.js';
import TrainingData from '../models/TrainingData.js';
import Attendance from '../models/Attendance.js';

// Get student profile
export const getStudentProfile = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select('-password');
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Get student's training data
export const getTrainingData = async (req, res) => {
  try {
    const data = await TrainingData.find({ studentId: req.user.id })
      .populate('uploadedBy', 'name email');
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Get student's attendance history
export const getAttendanceHistory = async (req, res) => {
  try {
    const attendance = await Attendance.find({ studentId: req.user.id });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
