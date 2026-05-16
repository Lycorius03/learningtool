const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parsePDF } = require('../services/doc-parser');
const { requireAdmin } = require('../middleware/auth');

// Simple per-IP rate limiter for uploads (10 uploads per minute)
const uploadRateLimit = new Map();
function checkUploadRateLimit(ip) {
  const now = Date.now();
  const entry = uploadRateLimit.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > 60000) { entry.count = 0; entry.windowStart = now; }
  entry.count++;
  uploadRateLimit.set(ip, entry);
  if (entry.count > 10) return false;
  return true;
}
// Cleanup stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [ip, entry] of uploadRateLimit) {
    if (entry.windowStart < cutoff) uploadRateLimit.delete(ip);
  }
}, 5 * 60 * 1000);

// File upload config
const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[<>:"/\\|?*\s]/g, '_').replace(/[^\x20-\x7E一-鿿㐀-䶿]/g, '');
    const safeName = Date.now() + '-' + (sanitized || 'file');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.md', '.json', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}。支持: ${allowed.join(', ')}`));
    }
  }
});

// GET /api/files/view/:filename — Serve uploaded file for direct viewing (PDF embed etc.)
router.get('/view/:filename', (req, res) => {
  // Sanitize: only allow the filename, reject path traversal
  const filename = path.basename(req.params.filename);
  if (!filename || filename === '.' || filename === '..') {
    return res.status(400).json({ error: '无效的文件名' });
  }
  const fullPath = path.join(uploadDir, filename);
  // Verify resolved path stays within uploadDir
  if (!fullPath.startsWith(uploadDir)) {
    console.warn(`[FILES] Path traversal attempt blocked: ${req.params.filename}`);
    return res.status(403).json({ error: '禁止访问' });
  }
  console.log(`[FILES] Serving: ${fullPath}`);
  if (fs.existsSync(fullPath)) {
    res.sendFile(fullPath);
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

// Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: '文件过大，最大支持 50MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  next();
};

// POST /api/files/upload — Upload a document
router.post('/upload', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkUploadRateLimit(ip)) {
    return res.status(429).json({ error: '上传过于频繁，请稍后重试' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未提供文件' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
      text = await parsePDF(req.file.path);
    } else if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: req.file.path });
      text = result.value;
    } else {
      text = fs.readFileSync(req.file.path, 'utf-8');
    }

    // Return viewPath for direct file access
    const filename = path.basename(req.file.path);

    res.json({
      filename: req.file.originalname,
      path: req.file.path,
      viewPath: `/api/files/view/${filename}`,
      text,
      size: req.file.size,
      type: ext
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: '文件处理失败，请检查文件格式' });
  }
});

// POST /api/files/upload-explanation — Upload an explanation document
router.post('/upload-explanation', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkUploadRateLimit(ip)) {
    return res.status(429).json({ error: '上传过于频繁，请稍后重试' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未提供文件' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
      text = await parsePDF(req.file.path);
    } else if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: req.file.path });
      text = result.value;
    } else {
      text = fs.readFileSync(req.file.path, 'utf-8');
    }

    res.json({
      filename: req.file.originalname,
      text,
      size: req.file.size,
      type: ext
    });
  } catch (err) {
    console.error('Explanation file upload error:', err);
    res.status(500).json({ error: '文件处理失败，请检查文件格式' });
  }
});

// POST /api/files/export-annotations — Export annotations
router.post('/export-annotations', (req, res) => {
  try {
    const { annotations, format, title } = req.body;

    if (format === 'json') {
      return res.json({ success: true, data: annotations });
    }

    let md = `# ${title || '标注导出'}\n\n> 导出时间: ${new Date().toISOString()}\n\n`;
    for (const ann of annotations) {
      if (ann.type === 'highlight') {
        md += `> ${ann.text}\n\n`;
      } else if (ann.type === 'note') {
        md += `**笔记**: ${ann.note}\n\n> 原文: ${ann.text}\n\n`;
      }
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title || 'annotations')}.md"`);
    res.send(md);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: '标注导出失败' });
  }
});

module.exports = router;
