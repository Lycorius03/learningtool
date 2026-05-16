const express = require('express');
const router = express.Router();

// Rate limiting state
const loginAttempts = new Map(); // IP → { count, lockedUntil }

// Periodic cleanup: remove expired rate-limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.lockedUntil) {
      loginAttempts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  // Check rate limit
  const attempts = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (Date.now() < attempts.lockedUntil) {
    const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `登录已被锁定，请在 ${remaining} 分钟后重试` });
  }

  // Verify credentials — require explicit env vars, no defaults
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('[ADMIN] ADMIN_USERNAME or ADMIN_PASSWORD not set in .env — login is disabled');
    return res.status(500).json({ error: '管理员登录未配置。请在 .env 中设置 ADMIN_USERNAME 和 ADMIN_PASSWORD。' });
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    loginAttempts.delete(ip);
    req.session.isAdmin = true;
    req.session.adminUser = username;
    req.session.save(err => {
      if (err) {
        console.error('[ADMIN] Session save failed:', err);
        return res.status(500).json({ error: '登录失败，请重试' });
      }
      res.json({ success: true, sessionId: req.session.id });
    });
    return;
  }

  // Track failed attempt
  attempts.count++;
  if (attempts.count >= 5) {
    attempts.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lockout
    loginAttempts.set(ip, attempts);
    return res.status(429).json({ error: '登录失败次数过多，已锁定 15 分钟' });
  }
  loginAttempts.set(ip, attempts);

  res.status(401).json({ error: '账号或密码错误' });
});

// GET /api/admin/status — Check admin status
router.get('/status', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

module.exports = router;
