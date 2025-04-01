import express from 'express';
import Resume from '../models/Resume.js'; // Make sure this model exists
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to authenticate user
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

// Save or Update Resume
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { personalDetails, education, skills, experience, template } = req.body;

    const resume = new Resume({
      userId: req.user.id,
      personalDetails,
      education,
      skills,
      experience,
      template,
    });

    await resume.save();
    res.status(201).json({ message: 'Resume saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get User Resumes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.id });
    res.json(resumes);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
