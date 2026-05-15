const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parsePDF } = require('../services/doc-parser');
const { requireAdmin } = require('../middleware/auth');

// File upload config
const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = Date.now() + '-' + encodeURIComponent(file.originalname.replace(/[<>:"/\\|?*]/g, '_'));
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
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

// POST /api/files/upload — Upload a document
router.post('/upload', upload.single('file'), async (req, res) => {
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
      path: req.file.path,
      text,
      size: req.file.size,
      type: ext
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/export-annotations — Export annotations
router.post('/export-annotations', (req, res) => {
  try {
    const { annotations, format, title } = req.body;

    if (format === 'json') {
      return res.json({ success: true, data: annotations });
    }

    // Markdown format
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
