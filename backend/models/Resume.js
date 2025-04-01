import mongoose from 'mongoose';

const ResumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  personalDetails: { type: Object, required: true },
  education: { type: Array, required: true },
  skills: { type: Array, required: true },
  experience: { type: Array, required: true },
  template: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Resume', ResumeSchema);
