import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';
import mongoose from 'mongoose';
import { sendVerificationEmail } from '../utils/emailService.js';

const router = express.Router();

// ✅ USER SIGNUP ROUTE
router.post('/signup', async (req, res) => {
  try {
    console.log("\n=== SIGNUP REQUEST START ===");
    console.log("📌 Received Signup Request Body:", {
      name: req.body.name,
      email: req.body.email,
      passwordLength: req.body.password ? req.body.password.length : 0
    });

    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      console.log("❌ Missing fields:", {
        name: !!name,
        email: !!email,
        password: !!password
      });
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error("❌ MongoDB not connected. Current state:", mongoose.connection.readyState);
      return res.status(500).json({ error: 'Database connection error' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      console.log("⚠️ User already exists:", email);
      return res.status(400).json({ error: 'User already exists' });
    }

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 3600000); // 1 hour

    // Hash password and save user
    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({
      name,
      email,
      password: hashedPassword,
      verificationCode,
      verificationCodeExpires,
      isVerified: false
    });

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    try {
      await user.save();
      console.log("✅ User saved to database:", {
        id: user._id,
        email: user.email,
        name: user.name
      });
    } catch (saveError) {
      console.error("❌ Error saving user:", {
        error: saveError.message,
        code: saveError.code,
        name: saveError.name
      });
      return res.status(500).json({ error: 'Failed to save user to database' });
    }

    // Verify JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET missing!");
      return res.status(500).json({ error: 'Server configuration error' });
    }
    console.log("✅ JWT_SECRET verified");

    // Generate token
    let token;
    try {
      token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      console.log("✅ Token generated successfully");
    } catch (tokenError) {
      console.error("❌ Token generation failed:", tokenError);
      return res.status(500).json({ error: 'Failed to generate authentication token' });
    }

    // Prepare and send response
    const response = {
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    };

    console.log("📤 Sending response:", {
      ...response,
      token: token ? 'Present' : 'Missing'
    });
    console.log("=== SIGNUP REQUEST END ===\n");

    return res.status(201).json(response);

  } catch (error) {
    console.error("❌ Signup Error:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.log("=== SIGNUP REQUEST END WITH ERROR ===\n");
    return res.status(500).json({ error: 'Server error during signup' });
  }
});


// ✅ USER LOGIN ROUTE
router.post('/login', async (req, res) => {
  try {
    console.log('📌 Login Request Body:', req.body); // Debugging

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('⚠️ User not found:', email);
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      console.log('⚠️ User not verified:', email);
      return res.status(400).json({ error: 'Please verify your email before logging in' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('⚠️ Invalid password attempt for:', email);
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is missing in environment variables!');
      return res.status(500).json({ error: 'Internal server error' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log('✅ Login Successful:', { email, token });

    // Send user data along with the token
    res.status(200).json({ 
      message: 'Login successful', 
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Login Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ PROTECTED ROUTE: Get User Profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('❌ Profile Fetch Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Email Verification Route
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const user = await User.findOne({ 
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Update user verification status
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Generate token for auto-login
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Email verified successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Email Verification Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Resend Verification Code Route
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 3600000); // 1 hour

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;
    await user.save();

    // Send new verification email
    await sendVerificationEmail(email, verificationCode);

    res.status(200).json({ message: 'Verification code resent successfully' });

  } catch (error) {
    console.error('❌ Resend Verification Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ PROTECTED ROUTE: Update User Profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    console.log('📝 Update Profile Request:', {
      userId: req.user,
      updateData: {
        ...req.body,
        profileImage: req.body.profileImage ? 
          (req.body.profileImage.length > 100 ? 
            req.body.profileImage.substring(0, 100) + '...' : 
            req.body.profileImage) : 
          'not provided'
      }
    });

    const { name, email, phone, bio, location, profileImage } = req.body;
    
    // Find user and update
    const user = await User.findById(req.user);
    if (!user) {
      console.error('❌ User not found for ID:', req.user);
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (profileImage !== undefined) {
      // Check if the profile image is too large
      if (profileImage && profileImage.length > 5000000) { // 5MB limit
        console.error('❌ Profile image too large:', profileImage.length, 'bytes');
        return res.status(400).json({ error: 'Profile image is too large. Please use a smaller image.' });
      }
      user.profileImage = profileImage;
    }

    try {
      await user.save();
      console.log('✅ User saved successfully');
    } catch (saveError) {
      console.error('❌ Error saving user:', saveError);
      return res.status(500).json({ error: 'Failed to save user data', details: saveError.message });
    }

    // Return updated user without password
    const updatedUser = await User.findById(req.user).select('-password');
    console.log('✅ Profile Updated:', {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      hasProfileImage: !!updatedUser.profileImage
    });
    
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('❌ Profile Update Error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

export default router;
