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

const app = express();
const PORT = process.env.PORT || 5000;

// ── Ensure required directories and files exist ─────────────────────────────
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

const resumeStorePath = path.join(__dirname, 'data', 'resumeStore.json');
if (!fs.existsSync(resumeStorePath)) {
  fs.writeFileSync(resumeStorePath, JSON.stringify([], null, 2));
  console.log('📄 Initialized resumeStore.json');
}

const tokenStorePath = path.join(__dirname, 'data', 'tokenStore.json');
if (!fs.existsSync(tokenStorePath)) {
  fs.writeFileSync(tokenStorePath, JSON.stringify({}, null, 2));
  console.log('📄 Initialized tokenStore.json');
}

const sentApplicationsPath = path.join(__dirname, 'data', 'sent-applications.json');
if (!fs.existsSync(sentApplicationsPath)) {
  fs.writeFileSync(sentApplicationsPath, JSON.stringify([], null, 2));
  console.log('📄 Initialized sent-applications.json');
}

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
    secure: false, // set to true in production with HTTPS
    httpOnly: true,
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
  
  console.log(`📧 Gmail SMTP:    ${process.env.GMAIL_USER ? `Configured ✓ (${process.env.GMAIL_USER})` : '⚠️  NOT SET — add GMAIL_USER + GMAIL_APP_PASSWORD to .env'}`);
  console.log(`🔗 LinkedIn OAuth: ${process.env.LINKEDIN_CLIENT_ID ? 'Configured ✓' : 'Not set (optional)'}`);
  console.log('');
});
