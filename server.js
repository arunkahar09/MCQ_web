const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initFirebase, isLiveFirebase, getDb } = require('./config/firebase');
const initDatabase = require('./db/init');

const authRoutes = require('./routes/auth.routes');
const subjectRoutes = require('./routes/subject.routes');
const testRoutes = require('./routes/test.routes');
const questionRoutes = require('./routes/question.routes');
const examRoutes = require('./routes/exam.routes');
const resultRoutes = require('./routes/result.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Increase payload size limits to allow larger bulk import requests (Excel -> JSON)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/admin', adminRoutes);

// Database status healthcheck endpoint
app.get('/api/health', async (req, res) => {
  const isLive = isLiveFirebase();
  const db = getDb();
  let dbStatus = 'healthy';
  let stats = {};

  try {
    const subjectsSnap = await db.collection('subjects').limit(1).get();
    stats.hasData = !subjectsSnap.empty;
  } catch (e) {
    dbStatus = 'error: ' + e.message;
  }

  res.json({
    status: dbStatus,
    engine: isLive ? 'Cloud Firestore (Firebase)' : 'Firestore Local Storage',
    firebase_live: isLive,
    timestamp: new Date().toISOString()
  });
});

// Dynamic Firebase Web Client Config Endpoint (Safe from .env)
app.get('/api/config/firebase', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || 'mcqweb-e912a',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  });
});

// Single Page Application Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error: ' + err.message
  });
});

// Start Server with Port Fallback & Auto Migration Check
function startServer(portToTry) {
  const server = app.listen(portToTry, async () => {
    const isLive = isLiveFirebase();
    console.log(`\n=================================================`);
    console.log(`🚀 Online MCQ Test Website is running!`);
    console.log(`🌐 Open in Browser: http://localhost:${portToTry}`);
    console.log(`🔥 Database Engine: ${isLive ? 'Cloud Firestore (Live Firebase)' : 'Firestore Storage'}`);
    console.log(`🔑 Admin Login:     admin@mcq.com   / admin123`);
    console.log(`🎓 Student Login:   student@mcq.com / student123`);
    console.log(`=================================================\n`);

    // Ensure database and initial data are seeded/migrated
    try {
      await initDatabase();
      // Auto-populate firestore local store if empty
      const db = getDb();
      const subSnap = await db.collection('subjects').limit(1).get();
      if (subSnap.empty) {
        console.log('🔄 Initializing Firestore collections from seed data...');
        require('./scripts/migrate_to_firebase');
      }
    } catch (err) {
      console.warn('⚠️ Database auto-init note:', err.message);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${portToTry} is busy. Trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

// Do not start a listening server when running on serverless platforms like Vercel.
// Vercel sets `process.env.VERCEL` to '1' for runtime; avoid calling `listen()` there.
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startServer(parseInt(PORT, 10));
} else if (process.env.VERCEL) {
  console.log('ℹ️ Running in Vercel/serverless environment — server listens disabled.');
}

module.exports = app;
