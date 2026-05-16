const { generateWithAI } = require('./ai-provider');

/**
 * Dual-channel AI output verification.
 * Channel 2 reviews Channel 1's output for factual accuracy, logic, and format.
 * @param {string} content — AI-generated content to review
 * @param {string} originalPrompt — the prompt that produced the content
 * @param {object} [providerConfig] — optional provider config; falls back to env DEEPSEEK_API_KEY
 */
async function verifyOutput(content, originalPrompt, providerConfig) {
  const reviewPrompt = `你是一个严格的审阅者。请检查以下AI生成的内容是否存在问题。

## 原始请求
${originalPrompt}

## AI生成的内容
${content}

## 检查维度
1. 事实准确性：是否有明显的事实错误？
2. 逻辑一致性：推理链条是否完整、无矛盾？
3. 格式完整性：输出格式是否符合要求？
4. 安全合规性：是否包含违规或不当内容？

请以JSON格式回复：
{
  "pass": true/false,
  "issues": ["问题描述1", "问题描述2"],
  "corrections": "修正建议（如有）"
}

只输出JSON，不要其他内容。`;

  try {
    const config = providerConfig || 'deepseek-v4-flash'; // legacy string fallback → ai-provider maps it
    const result = await generateWithAI(reviewPrompt, null, config);
    // Parse the JSON response
    const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Verification failed:', e.message);
    // Verification service is unavailable — caller should treat content as unverified
    return { pass: false, issues: ['Verification service unavailable'], warning: '输出已返回但未经审阅——验证服务异常' };
  }
}

module.exports = { verifyOutput };
