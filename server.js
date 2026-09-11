const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initSupabase, isLiveSupabase, getDb } = require('./config/supabase');
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// API Routes
// =========================
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/admin', adminRoutes);

// =========================
// Health Check
// =========================
app.get('/api/health', async (req, res) => {
  const isLive = isLiveSupabase();
  const db = getDb();
  let dbStatus = 'healthy';
  let stats = { hasData: false, subjectsCount: 0 };

  try {
    const subjectsSnap = await db.collection('subjects').limit(1).get();
    stats.hasData = !subjectsSnap.empty;
    stats.subjectsCount = subjectsSnap.size || 0;
  } catch (e) {
    dbStatus = 'error: ' + e.message;
  }

  res.json({
    status: dbStatus,
    engine: isLive ? 'Supabase Cloud PostgreSQL' : 'Local Pure-JS Storage Layer',
    supabase_live: isLive,
    timestamp: new Date().toISOString(),
    stats
  });
});

// =========================
// Supabase Config (Safe Client Metadata)
// =========================
app.get('/api/config/supabase', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  });
});

// Backward-compatible endpoint for legacy frontend checks
app.get('/api/config/firebase', (req, res) => {
  res.json({
    configured: true,
    engine: isLiveSupabase() ? 'supabase' : 'local'
  });
});

// =========================
// SPA Fallback (Express 4 & 5 Compatible)
// =========================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================
// Error Handler
// =========================
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack || err);
  res.status(500).json({
    success: false,
    message: 'Internal server error: ' + (err.message || 'Unknown error')
  });
});

// =========================
// Local Server Initialization
// =========================
function startServer(portToTry) {
  const server = app.listen(portToTry, async () => {
    const isLive = isLiveSupabase();
    console.log(`\n=================================================`);
    console.log(`🚀 MCQ Test Portal running at http://localhost:${portToTry}`);
    console.log(`📡 Database Engine: ${isLive ? 'Supabase Cloud PostgreSQL' : 'Local Development Store'}`);
    console.log(`=================================================\n`);

    try {
      await initDatabase();
    } catch (err) {
      console.warn('Database auto-init note:', err.message);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${portToTry} busy. Trying ${portToTry + 1}`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

// Start server locally (Vercel serverless functions will export app)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startServer(parseInt(PORT, 10));
}

module.exports = app;
