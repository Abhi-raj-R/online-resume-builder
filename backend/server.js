import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

import resumeRoutes from './routes/resume.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure correct directory for .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug environment variables
console.log('Environment Variables Check:');
console.log('- MONGO_URI:', process.env.MONGO_URI ? '✅ Found' : '❌ Missing');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ Found' : '❌ Missing');
console.log('- PORT:', process.env.PORT || '5000 (default)');

const app = express();
const PORT = process.env.PORT || 5000;

// Check if MongoDB URI is loaded correctly
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is missing in .env file');
  process.exit(1);
}
console.log('MongoDB URI:', process.env.MONGO_URI);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure CORS - More permissive for development
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173'], // Allow specific origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers'],
  exposedHeaders: ['Authorization']
}));

// Add headers middleware for additional CORS support
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:8080', 'http://localhost:5173'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Add response logging middleware
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    console.log('Response being sent:', {
      path: req.path,
      method: req.method,
      responseData: data
    });
    return originalJson.call(this, data);
  };
  next();
});

// Routes
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);


// Database Connection with better error handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000 // 5 second timeout
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  // Only start the server after successful database connection
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 API Documentation available at http://localhost:${PORT}`);
  });
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', {
    message: err.message,
    code: err.code,
    name: err.name
  });
  console.log('⚠️ Please make sure MongoDB is installed and running on your system');
  console.log('💡 Installation guide: https://docs.mongodb.com/manual/installation/');
  process.exit(1);
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Resume Builder API',
    status: 'Server is running',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});
