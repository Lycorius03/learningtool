/**
 * PaperLens — AI Engine Service (Frontend)
 * Handles communication with backend AI proxy.
 */
export class AIEngine {
  constructor(state) {
    this.state = state;
  }

  /**
   * Generate explanation for selected text.
   */
  async generate(prompt, context = '你是一个学术论文辅助阅读AI。请用中文回答，语言清晰、准确。') {
    const resp = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        context,
        model: 'deepseek-v4-pro'
      })
    });

    if (resp.status === 403) {
      throw new Error('需要管理员权限才能使用AI功能。请先登录。');
    }
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'AI请求失败');
    }

    return resp.json();
  }

  /**
   * Stream chat messages via SSE.
   */
  async *chat(messages) {
    const resp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model: 'deepseek-v4-flash' })
    });

    if (resp.status === 403) {
      throw new Error('需要管理员权限才能使用AI功能。请先登录。');
    }
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'AI请求失败');
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
            if (parsed.content) yield parsed;
          } catch (e) {
            // skip
          }
        }
      }
    }
  }
}
