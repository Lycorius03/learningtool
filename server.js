require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const aiRoutes = require('./server/routes/ai');
const adminRoutes = require('./server/routes/admin');
const filesRoutes = require('./server/routes/files');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'paperlens-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// --- Static files (frontend) ---
app.use(express.static(path.join(__dirname)));

// --- API Routes ---
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', filesRoutes);

// --- SPA fallback — serve index.html for all non-API routes ---
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`\n  LearningTool server running at http://localhost:${PORT}\n`);
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('  [WARN] DEEPSEEK_API_KEY not set in .env — AI features will not work\n');
  }
});
