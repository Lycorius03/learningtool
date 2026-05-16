/**
 * LearningTool — Express Server
 * Full verbose logging. No log suppression.
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const aiRoutes = require('./server/routes/ai');
const adminRoutes = require('./server/routes/admin');
const filesRoutes = require('./server/routes/files');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// Startup diagnostics
// ============================================================
console.log('══════════════════════════════════════════════');
console.log('  LearningTool Server Starting');
console.log('══════════════════════════════════════════════');
console.log(`  Time     : ${new Date().toISOString()}`);
console.log(`  Node.js  : ${process.version}`);
console.log(`  Platform : ${process.platform} / ${process.arch}`);
console.log(`  CWD      : ${process.cwd()}`);
console.log(`  Port     : ${PORT}`);
console.log(`  Env      : ${process.env.NODE_ENV || 'development'}`);
console.log(`  PID      : ${process.pid}`);
console.log('');

// Check critical files
['package.json', 'index.html', '.env'].forEach(f => {
  const exists = fs.existsSync(path.join(__dirname, f));
  console.log(`  [${exists ? 'OK' : 'MISSING'}] ${f}`);
});
console.log('');

// Check dependencies
try {
  require.resolve('express');
  console.log('  [OK] express');
} catch (e) { console.log('  [MISSING] express'); }

try {
  require.resolve('multer');
  console.log('  [OK] multer');
} catch (e) { console.log('  [MISSING] multer'); }

try {
  require.resolve('dotenv');
  console.log('  [OK] dotenv');
} catch (e) { console.log('  [MISSING] dotenv'); }

// Check API keys
const envKeys = Object.keys(process.env).filter(k => k.endsWith('_API_KEY'));
if (envKeys.length === 0) {
  console.warn('  [WARN] No *_API_KEY found in environment — AI features will not work');
} else {
  envKeys.forEach(k => {
    const val = process.env[k] || '';
    const masked = val.slice(0, 8) + '...' + (val.length > 12 ? val.slice(-4) : '');
    console.log(`  [ENV] ${k} = ${masked}`);
  });
}
console.log('');

// Ensure data directories
['data/ai-logs', 'data/uploads', 'data/logs'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
    console.log(`  [INIT] Created directory: ${dir}`);
  }
});

console.log('══════════════════════════════════════════════');
console.log('');

// --- Middleware ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.warn('  [WARN] SESSION_SECRET not set — using random secret for this session');
  console.warn('  [WARN] Set SESSION_SECRET in .env for persistent sessions across restarts');
}
app.use(session({
  secret: SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// --- Full request logger (verbose, no filtering) ---
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).slice(2, 8);

  console.log(`→ [${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} ${req.ip}`);

  // Log request body for API calls (sanitized)
  if (req.path.startsWith('/api/') && req.body && Object.keys(req.body).length > 0) {
    const sanitized = { ...req.body };
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.apiKey) sanitized.apiKey = '***';
    console.log(`  [${requestId}] Body: ${JSON.stringify(sanitized).slice(0, 200)}`);
  }

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERR' : res.statusCode >= 400 ? 'WARN' : 'OK';
    console.log(`← [${requestId}] ${res.statusCode} ${req.method} ${req.path} → ${res.get('Content-Type') || 'none'} (${ms}ms) [${level}]`);
  });

  next();
});

// --- Static files — whitelist: only serve public assets, never source/config/data ---
const srcDir = path.join(__dirname, 'src');
app.use('/src', express.static(srcDir));
console.log(`  [SERVE] Static assets: ${srcDir}`);

// --- API Routes ---
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', filesRoutes);
console.log('  [ROUTE] /api/ai/*');
console.log('  [ROUTE] /api/admin/*');
console.log('  [ROUTE] /api/files/*');
console.log('');

// --- SPA fallback ---
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    console.warn(`  [404] API route not found: ${req.path}`);
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Error handling ---
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  console.error(err.stack);
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: 'Internal server error',
    message: isDev ? err.message : 'An unexpected error occurred'
  });
});

// --- Graceful shutdown ---
process.on('SIGINT', () => {
  console.log('\n  [SHUTDOWN] SIGINT received, closing server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n  [SHUTDOWN] SIGTERM received, closing server...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

// --- PID file for scripts/start.bat to track this process ---
const PID_FILE = path.join(__dirname, 'data', 'server.pid');
fs.writeFileSync(PID_FILE, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(PID_FILE); } catch (e) {} });

// --- Start server ---
app.listen(PORT, () => {
  console.log('══════════════════════════════════════════════');
  console.log(`  LearningTool ready at http://localhost:${PORT}`);
  console.log(`  Open browser to start using the application`);
  console.log('══════════════════════════════════════════════');
  console.log('');
});
