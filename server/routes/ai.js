const express = require('express');
const router = express.Router();
const { generateWithAI, chatWithAI, testConnection } = require('../services/ai-provider');
const { verifyOutput } = require('../services/verifier');
const { requireAdmin, requireAdminIfNoUserConfig } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

/**
 * Resolve provider config from request body.
 * Priority: request body > session > environment (admin default)
 */
function resolveProviderConfig(req) {
  const body = req.body || {};

  // If user sent a full provider config, use it
  if (body.providerConfig && body.providerConfig.apiKey) {
    console.log(`[AI-ROUTE] Using user-provided config: ${body.providerConfig.provider || 'custom'}/${body.providerConfig.model || 'unknown'}`);
    return body.providerConfig;
  }

  // Fallback to admin DeepSeek config in environment
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) {
    return {
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: body.model || 'deepseek-chat',
      provider: 'deepseek'
    };
  }

  throw new Error('未配置 AI 服务商。请在设置中添加模型或在 .env 中配置 DEEPSEEK_API_KEY。');
}

// POST /api/ai/test-connection — Test AI provider configuration (no auth needed)
router.post('/test-connection', async (req, res) => {
  try {
    const { providerConfig } = req.body;
    if (!providerConfig || !providerConfig.apiKey) {
      return res.status(400).json({ error: '请提供完整的服务商配置' });
    }

    console.log(`[AI-ROUTE] Testing connection: ${providerConfig.provider}/${providerConfig.model} @ ${providerConfig.baseUrl}`);
    const result = await testConnection(providerConfig);
    res.json(result);
  } catch (err) {
    console.error('[AI-ROUTE] Connection test error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/ai/generate — Generate paper explanation / quiz answer
router.post('/generate', requireAdminIfNoUserConfig, async (req, res) => {
  try {
    const { prompt, context, model } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: '请提供有效的提示词' });
    }
    const providerConfig = resolveProviderConfig(req);

    // Channel 1: Generate
    const generation = await generateWithAI(prompt, context, providerConfig);

    // Write to background log
    const sessionId = req.session.id || 'anon';
    const logDir = path.join(__dirname, '..', '..', 'data', 'ai-logs', `session_${sessionId}`);
    fs.mkdirSync(logDir, { recursive: true });
    const genId = Date.now().toString(36);
    fs.writeFileSync(path.join(logDir, `gen-${genId}.md`), generation.content);
    fs.writeFileSync(path.join(logDir, `gen-${genId}_metadata.json`), JSON.stringify({
      source: 'generate',
      prompt,
      model: providerConfig.model,
      provider: providerConfig.provider,
      timestamp: new Date().toISOString()
    }, null, 2));

    // Channel 2: Verify (strict mode)
    try {
      const verification = await verifyOutput(generation.content, prompt, providerConfig);
      fs.writeFileSync(path.join(logDir, `gen-${genId}_verification.json`), JSON.stringify(verification, null, 2));

      if (verification.pass) {
        return res.json({ content: generation.content, verified: true });
      }

      // Retry with corrections (max 2 attempts)
      let retryContent = generation.content;
      let lastVerification = verification;
      for (let i = 0; i < 2; i++) {
        const retryPrompt = `${prompt}\n\n[审阅意见]: ${lastVerification.issues.join('; ')}\n请修正以上问题后重新生成。`;
        const retry = await generateWithAI(retryPrompt, context, providerConfig);
        retryContent = retry.content;

        const recheck = await verifyOutput(retryContent, prompt, providerConfig);
        if (recheck.pass) {
          return res.json({ content: retryContent, verified: true, retries: i + 1 });
        }
        lastVerification = recheck;
      }

      // Still not passing after retries — return with last verification's issues
      res.json({
        content: retryContent,
        verified: false,
        warning: 'AI已验证但可能仍有误，请人工核对',
        issues: lastVerification.issues
      });
    } catch (verificationErr) {
      // Verification is optional — return generation if verifier fails
      console.warn('[AI-ROUTE] Verification skipped (verifier unavailable):', verificationErr.message);
      res.json({ content: generation.content, verified: false, warning: '验证服务不可用' });
    }

  } catch (err) {
    console.error('[AI-ROUTE] Generate error:', err);
    res.status(500).json({ error: 'AI 生成失败，请稍后重试' });
  }
});

// POST /api/ai/chat — Free-form chat (SSE streaming)
router.post('/chat', requireAdminIfNoUserConfig, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '请提供有效的消息列表' });
    }
    const providerConfig = resolveProviderConfig(req);

    // SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = chatWithAI(messages, providerConfig);
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('[AI-ROUTE] Chat error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI 对话失败，请稍后重试' });
    }
  }
});

// POST /api/ai/convert-to-quiz — AI converts document to quiz JSON
router.post('/convert-to-quiz', requireAdminIfNoUserConfig, async (req, res) => {
  try {
    const { text, filename } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: '请提供要转换的文本内容' });
    }

    const providerConfig = resolveProviderConfig(req);
    const prompt = `你是一个题库生成专家。请将以下文档内容转换为选择题题库的 JSON 格式。

## 要求
1. 每道题包含：id（从1开始的数字）、question（题目）、options（4个选项的数组）、answer（正确答案索引0-3）、explanation（解析）
2. 只提取适合作为选择题的知识点
3. 选项要有迷惑性但只有一个正确答案
4. 解析要准确、简洁
5. 至少生成3道题，最多20道题
6. 只输出JSON数组，不要其他内容

## 文档内容
${text.slice(0, 15000)}`;

    console.log(`[AI-ROUTE] Converting document to quiz: ${filename || 'unknown'} (${text.length} chars)`);
    const generation = await generateWithAI(prompt, null, providerConfig);

    // Parse the JSON from AI response
    let cleaned = generation.content || '';
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // Remove any text before first [ and after last ]
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.slice(startIdx, endIdx + 1);
    }

    try {
      const questions = JSON.parse(cleaned);
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('AI returned empty or invalid question array');
      }
      console.log(`[AI-ROUTE] Converted to ${questions.length} quiz questions`);
      res.json({ success: true, questions, count: questions.length });
    } catch (parseErr) {
      console.error('[AI-ROUTE] Failed to parse AI quiz output:', parseErr.message);
      console.error('[AI-ROUTE] Raw output:', generation.content?.slice(0, 500));
      res.status(422).json({ error: 'AI 生成的题库格式有误，请重试。建议：确保文档内容包含明确的知识点。' });
    }
  } catch (err) {
    console.error('[AI-ROUTE] Convert-to-quiz error:', err);
    res.status(500).json({ error: 'AI 转换失败，请检查 AI 模型配置或稍后重试' });
  }
});

module.exports = router;
