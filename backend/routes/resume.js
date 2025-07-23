import express from 'express';
import Resume from '../models/Resume.js'; // Make sure this model exists
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to authenticate user
const authMiddleware = (req, res, next) => {
  try {
    console.log('🔒 Auth middleware - Headers:', req.headers);
    
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      console.error('❌ No Authorization header found');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    // Extract token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.error('❌ No token found in Authorization header');
      return res.status(401).json({ error: 'Access denied. Invalid token format.' });
    }
    
    console.log('🔑 Token extracted:', token.substring(0, 10) + '...');
    
    // Verify token
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified successfully:', { userId: verified.userId });
      req.user = verified;
      next();
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (err) {
    console.error('❌ Auth middleware error:', err);
    res.status(500).json({ error: 'Server error during authentication' });
  }
};

// Save or Update Resume
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { personalDetails, education, skills, experience, projects, certifications, template, name } = req.body;

    // Validate required fields
    if (!personalDetails || !education || !skills || !experience || !projects || !certifications || !template) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['personalDetails', 'education', 'skills', 'experience', 'projects', 'certifications', 'template'],
        received: { personalDetails, education, skills, experience, projects, certifications, template }
      });
    }

    // Check if a resume already exists for this user
    let resume = await Resume.findOne({ userId: req.user.userId });

    if (resume) {
      // Update existing resume
      resume.personalDetails = personalDetails;
      resume.education = education;
      resume.skills = skills;
      resume.experience = experience;
      resume.projects = projects;
      resume.certifications = certifications;
      resume.template = template;
      resume.lastModified = new Date();
      if (name) resume.name = name;
      
      await resume.save();
      res.json({ 
        message: 'Resume updated successfully',
        resume: resume.toJSON()
      });
    } else {
      // Create new resume
      resume = new Resume({
        userId: req.user.userId,
        personalDetails,
        education,
        skills,
        experience,
        projects,
        certifications,
        template,
        name: name || 'My Resume',
        lastModified: new Date()
      });
      await resume.save();
      res.status(201).json({ 
        message: 'Resume saved successfully',
        resume: resume.toJSON()
      });
    }
  } catch (error) {
    console.error('Save resume error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get User Resumes
router.get('/', authMiddleware, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.userId });
    res.json(resumes);
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Delete Resume
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({ 
      _id: req.params.id,
      userId: req.user.userId 
    });
    
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Test route to view resume structure (TEMPORARY)
router.get('/test', authMiddleware, async (req, res) => {
  try {
    const resume = await Resume.findOne({ userId: req.user.userId });
    if (!resume) {
      return res.status(404).json({ error: 'No resume found' });
    }
    
    // Log the full structure
    console.log('Resume structure:', JSON.stringify(resume, null, 2));
    
    // Return specific sections we want to verify
    res.json({
      hasProjects: Array.isArray(resume.projects),
      projectsCount: resume.projects?.length || 0,
      projects: resume.projects,
      hasCertifications: Array.isArray(resume.certifications),
      certificationsCount: resume.certifications?.length || 0,
      certifications: resume.certifications,
      fullResume: resume
    });
  } catch (error) {
    console.error('Test route error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Cleanup route to delete empty resumes (TEMPORARY)
router.delete('/cleanup', authMiddleware, async (req, res) => {
  try {
    // Delete resumes that have empty arrays for all required fields
    const result = await Resume.deleteMany({
      userId: req.user.userId,
      $and: [
        { education: { $size: 0 } },
        { skills: { $size: 0 } },
        { experience: { $size: 0 } },
        { projects: { $size: 0 } },
        { certifications: { $size: 0 } }
      ]
    });
    
    res.json({ 
      message: 'Cleanup completed', 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

export default router;
