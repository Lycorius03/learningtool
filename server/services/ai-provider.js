const { requireAdmin } = require('../middleware/auth');

/**
 * DeepSeek API provider wrapper.
 * Supports deepseek-v4-flash and deepseek-v4-pro models via OpenAI-compatible API.
 */
const DEEPSEEK_BASE = 'https://api.deepseek.com';

async function generateWithAI(prompt, context, model = 'deepseek-v4-flash') {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DeepSeek API Key 未配置。请联系管理员。');

  const messages = [];
  if (context) {
    messages.push({ role: 'system', content: context });
  }
  messages.push({ role: 'user', content: prompt });

  const resp = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: getModelId(model),
      messages,
      max_tokens: 4096,
      temperature: 0.7
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API error: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return {
    content: data.choices[0].message.content,
    model: data.model,
    usage: data.usage
  };
}

async function* chatWithAI(messages, model = 'deepseek-v4-flash') {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DeepSeek API Key 未配置。请联系管理员。');

  const resp = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: getModelId(model),
      messages,
      max_tokens: 4096,
      temperature: 0.7,
      stream: true
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API error: ${resp.status} ${err}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield { content: delta };
        } catch (e) {
          // Skip unparseable chunks
        }
      }
    }
  }
}

function getModelId(model) {
  const map = {
    'deepseek-v4-flash': 'deepseek-chat',
    'deepseek-v4-pro': 'deepseek-chat', // DeepSeek V4 pro via chat endpoint
    'deepseek-reasoner': 'deepseek-reasoner'
  };
  return map[model] || model;
}

module.exports = { generateWithAI, chatWithAI };
