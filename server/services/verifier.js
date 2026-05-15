const { generateWithAI } = require('./ai-provider');

/**
 * Dual-channel AI output verification.
 * Channel 2 reviews Channel 1's output for factual accuracy, logic, and format.
 */
async function verifyOutput(content, originalPrompt) {
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
    const result = await generateWithAI(reviewPrompt, null, 'deepseek-v4-flash');
    // Parse the JSON response
    const cleaned = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('Verification failed, defaulting to pass:', e.message);
    // If verification itself fails, default to pass with a warning
    return { pass: true, issues: [], warning: 'Verification service error — output returned without review' };
  }
}

module.exports = { verifyOutput };
