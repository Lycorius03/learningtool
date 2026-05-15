const express = require('express');
const router = express.Router();

// Rate limiting state
const loginAttempts = new Map(); // IP → { count, lockedUntil }

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

  // Verify credentials
  const ADMIN_USERNAME = 'Echo';
  const ADMIN_PASSWORD = '0x2A.p4';

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    loginAttempts.delete(ip);
    req.session.isAdmin = true;
    req.session.adminUser = username;
    req.session.sessionId = req.session.id;
    return res.json({ success: true, sessionId: req.session.id });
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
