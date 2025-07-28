import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  label:String,
  department: String,
  division: String,
  date: String
}, { timestamps: true });

export default mongoose.model('Attendance', attendanceSchema);
