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
    
     
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Get student's attendance history
export const getAttendanceHistory = async (req, res) => {
  try {
    console.log("wdhwhjd")
    const student = await User.findById(req.user.id);
    console.log(student)
    const label = `${student.rollno}_${student.name}`;
    console.log(label)
    const attendance = await Attendance.find({ label:label });
    console.log(attendance)
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
