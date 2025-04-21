import mongoose from 'mongoose';

const modelMetaSchema = new mongoose.Schema({
  modelName: String, // e.g., "CS-A"
  department: String,
  division: String,
  filePath: String, // where the model file is stored
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('ModelMeta', modelMetaSchema);
