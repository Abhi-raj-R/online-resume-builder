import mongoose from 'mongoose';

const ResumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  personalDetails: { type: Object, required: true },
  education: { type: Array, required: true },
  skills: { type: Array, required: true },
  experience: { type: Array, required: true },
  projects: { type: Array, required: true },
  certifications: { type: Array, required: true },
  template: { type: String, required: true },
  lastModified: { type: Date, default: Date.now },
  name: { type: String, required: true }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Convert dates to ISO strings for consistent handling
      if (ret.lastModified) {
        ret.lastModified = ret.lastModified.toISOString();
      }
      return ret;
    }
  }
});

export default mongoose.model('Resume', ResumeSchema);
