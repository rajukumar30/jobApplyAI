require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const resumeRoutes = require('./routes/resumeRoutes');
const jobRoutes = require('./routes/jobRoutes');
const emailRoutes = require('./routes/emailRoutes');
const gmailRoutes = require('./routes/gmailRoutes');
const linkedinRoutes = require('./routes/linkedinRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const dmRoutes = require('./routes/dmRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the reverse proxy (e.g. load balancer) so secure cookies and protocol
// detection work correctly in production deployments behind HTTPS terminators.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── Ensure required directories exist ───────────────────────────────────────
// Per-user storage (data/users/{uid}/...) is created on demand by userStorage.
// We only ensure the top-level parent directories used as the local fallback.
const dirs = [
  path.join(__dirname, 'resumes'),
  path.join(__dirname, 'data'),
];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'jobapply-ai-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS-only cookies in production
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// ── Request logger ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/resumes', resumeRoutes);
app.use('/api/job', jobRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/linkedin', linkedinRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/dm', dmRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'JobApply AI Backend',
    version: '1.0.0',
  });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        JobApply AI Backend v1.0.0        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`✅ Server running at http://localhost:${PORT}`);
  
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'claude') {
    console.log(`🤖 AI Provider:   Claude Sonnet 4.6 ✓ (${process.env.GEMINI_API_KEY ? 'Google API key configured' : '⚠️ NOT SET'})`);
  } else {
    console.log(`🔑 AI Provider:   Google Gemini 1.5 Flash ✓ (${process.env.GEMINI_API_KEY ? 'API key configured' : '⚠️ NOT SET'})`);
  }
  
  console.log('Gmail: Per-user OAuth enabled');
  console.log(`🔗 LinkedIn OAuth: ${process.env.LINKEDIN_CLIENT_ID ? 'Configured ✓' : 'Not set (optional)'}`);
  console.log('');
});
