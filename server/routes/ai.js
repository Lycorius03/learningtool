const express = require('express');
const router = express.Router();
const { generateWithAI, chatWithAI } = require('../services/ai-provider');
const { verifyOutput } = require('../services/verifier');
const { requireAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// POST /api/ai/generate — Generate paper explanation / quiz answer
router.post('/generate', requireAdmin, async (req, res) => {
  try {
    const { prompt, context, model } = req.body;
    const selectedModel = model || 'deepseek-v4-flash';

    // Channel 1: Generate
    const generation = await generateWithAI(prompt, context, selectedModel);

    // Write to background log
    const sessionId = req.session.id || 'anon';
    const logDir = path.join(__dirname, '..', '..', 'data', 'ai-logs', `session_${sessionId}`);
    fs.mkdirSync(logDir, { recursive: true });
    const genId = Date.now().toString(36);
    fs.writeFileSync(path.join(logDir, `gen-${genId}.md`), generation.content);
    fs.writeFileSync(path.join(logDir, `gen-${genId}_metadata.json`), JSON.stringify({
      source: 'generate', prompt, model: selectedModel, timestamp: new Date().toISOString()
    }, null, 2));

    // Channel 2: Verify (strict mode)
    const verification = await verifyOutput(generation.content, prompt);
    fs.writeFileSync(path.join(logDir, `gen-${genId}_verification.json`), JSON.stringify(verification, null, 2));

    if (verification.pass) {
      return res.json({ content: generation.content, verified: true });
    }

    // Retry with corrections (max 2 attempts)
    let retryContent = generation.content;
    for (let i = 0; i < 2; i++) {
      const retryPrompt = `${prompt}\n\n[审阅意见]: ${verification.issues.join('; ')}\n请修正以上问题后重新生成。`;
      const retry = await generateWithAI(retryPrompt, context, selectedModel);
      retryContent = retry.content;

      const recheck = await verifyOutput(retryContent, prompt);
      if (recheck.pass) {
        return res.json({ content: retryContent, verified: true, retries: i + 1 });
      }
    }

    // Still not passing after retries — return with warning
    res.json({
      content: retryContent,
      verified: false,
      warning: 'AI已验证但可能仍有误，请人工核对',
      issues: verification.issues
    });

  } catch (err) {
    console.error('AI generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chat — Free-form chat
router.post('/chat', requireAdmin, async (req, res) => {
  try {
    const { messages, model } = req.body;
    const selectedModel = model || 'deepseek-v4-flash';

    // SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await chatWithAI(messages, selectedModel, true);
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('AI chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
