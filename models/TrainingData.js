import mongoose from 'mongoose';

const trainingDataSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  files: [{
    url: String,
    storageType: { type: String, enum: ['file', 'base64','s3'], default: 'file' }
  }],
  type: { type: String, enum: ['image', 'video'], default: 'image' },
  status: { type: String, enum: ['Pending', 'Processed'], default: 'Pending' }
}, { timestamps: true });

export default mongoose.model('TrainingData', trainingDataSchema);
