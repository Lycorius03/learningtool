/**
 * LearningTool — AI Provider
 * Supports any OpenAI-compatible API endpoint.
 * Users configure provider/model/key/endpoint in settings.
 */

/**
 * Test connection to an AI provider.
 * @param {object} config - { apiKey, baseUrl, model, provider }
 * @returns {object} - { success, models, error }
 */
async function testConnection(config) {
  const { apiKey, baseUrl, model } = config;
  const endpoint = `${baseUrl}/v1/chat/completions`;
  console.log(`[AI-PROVIDER] Testing connection to ${endpoint} (model: ${model})`);

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Hello, respond with just "OK".' }],
      max_tokens: 10,
      temperature: 0
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error(`[AI-PROVIDER] Connection test failed: ${resp.status} ${errBody}`);
    throw new Error(`连接失败 (${resp.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await resp.json();
  console.log(`[AI-PROVIDER] Connection test OK — model: ${data.model || model}`);

  // Try to get available models list
  let models = [];
  try {
    const modelsResp = await fetch(`${baseUrl}/v1/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000)
    });
    if (modelsResp.ok) {
      const modelsData = await modelsResp.json();
      models = (modelsData.data || []).map(m => m.id).filter(id =>
        !id.includes('embedding') && !id.includes('moderation') && !id.includes('audio')
      );
      console.log(`[AI-PROVIDER] Available models: ${models.length} (${models.slice(0, 10).join(', ')}${models.length > 10 ? '...' : ''})`);
    }
  } catch (e) {
    console.warn(`[AI-PROVIDER] Could not fetch models list: ${e.message}`);
    models = [model]; // At minimum, the tested model works
  }

  return {
    success: true,
    model: data.model || model,
    models: models.length > 0 ? models : [model],
    usage: data.usage
  };
}

/**
 * Generate text (non-streaming).
 * @param {string} prompt
 * @param {string} context - system prompt
 * @param {object} providerConfig - { apiKey, baseUrl, model }
 */
async function generateWithAI(prompt, context, providerConfig) {
  // Backward compatibility: verifier.js passes model name string as third arg
  if (typeof providerConfig === 'string') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('未配置 AI 服务商。请在设置中添加模型或在 .env 中配置 DEEPSEEK_API_KEY。');
    const modelMap = { 'deepseek-v4-flash': 'deepseek-chat', 'deepseek-v4-pro': 'deepseek-chat', 'deepseek-reasoner': 'deepseek-reasoner' };
    const mappedModel = modelMap[providerConfig] || providerConfig;
    console.log(`[AI-PROVIDER] Legacy call detected — model "${providerConfig}" → "${mappedModel}"`);
    providerConfig = {
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: mappedModel,
      provider: 'deepseek'
    };
  }
  if (!providerConfig || typeof providerConfig !== 'object') {
    throw new Error('providerConfig 必须是一个包含 apiKey, baseUrl, model 的对象');
  }
  const { apiKey, baseUrl, model } = providerConfig;
  if (!apiKey) throw new Error('API Key 未配置');

  const messages = [];
  if (context) messages.push({ role: 'system', content: context });
  messages.push({ role: 'user', content: prompt });

  console.log(`[AI-PROVIDER] generate → ${baseUrl}/v1/chat/completions (model: ${model}, prompt: ${prompt.slice(0, 80)}...)`);

  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.7
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[AI-PROVIDER] generate error: ${resp.status} ${err}`);
    throw new Error(`AI API error: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  const content = data.choices[0].message.content;
  console.log(`[AI-PROVIDER] generate OK — ${content.length} chars, tokens: ${data.usage?.total_tokens || 'N/A'}`);

  return {
    content,
    model: data.model,
    usage: data.usage
  };
}

/**
 * Stream chat (async generator).
 * @param {array} messages
 * @param {object} providerConfig - { apiKey, baseUrl, model }
 */
async function* chatWithAI(messages, providerConfig) {
  const { apiKey, baseUrl, model } = providerConfig;
  if (!apiKey) throw new Error('API Key 未配置');

  console.log(`[AI-PROVIDER] chat stream → ${baseUrl}/v1/chat/completions (model: ${model}, messages: ${messages.length})`);

  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
      stream: true
    }),
    signal: AbortSignal.timeout(300000)
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[AI-PROVIDER] chat stream error: ${resp.status} ${err}`);
    throw new Error(`AI API error: ${resp.status} ${err}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          console.log(`[AI-PROVIDER] chat stream complete — ${chunkCount} chunks`);
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            chunkCount++;
            yield { content: delta };
          }
        } catch (e) {
          // Skip unparseable chunks
        }
      }
    }
  }
}

module.exports = { generateWithAI, chatWithAI, testConnection };
