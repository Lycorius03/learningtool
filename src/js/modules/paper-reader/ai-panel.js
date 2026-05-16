/**
 * LearningTool — AI Panel
 * Renders chat messages and AI explanations.
 * Works with pre-built DOM from reader.html.
 */
export class AIPanel {
  constructor(chatMessagesContainer, aiEngine) {
    this.container = chatMessagesContainer;
    this.aiEngine = aiEngine;
    this.messages = [];
    this._explanationVisible = false;
    this._docContext = '';
    this._paperId = null; // for persisting chat history
  }

  /** Set the full document text as context for all AI conversations */
  setDocumentContext(fullText) {
    this._docContext = fullText || '';
  }

  /** Set paper ID for saving/loading chat history */
  setPaperId(id) { this._paperId = id; }

  /** Save chat history to localStorage */
  _saveHistory() {
    if (!this._paperId || !this.messages.length) return;
    try {
      var all = JSON.parse(localStorage.getItem('paperlens_chats') || '{}');
      all[this._paperId] = { messages: this.messages, savedAt: new Date().toISOString() };
      // Keep max 20 paper histories
      var keys = Object.keys(all);
      if (keys.length > 20) { delete all[keys[0]]; }
      localStorage.setItem('paperlens_chats', JSON.stringify(all));
    } catch(e) {}
  }

  /** Load chat history from localStorage, returns true if found */
  loadHistory() {
    if (!this._paperId) return false;
    try {
      var all = JSON.parse(localStorage.getItem('paperlens_chats') || '{}');
      var entry = all[this._paperId];
      if (entry && entry.messages && entry.messages.length) {
        this.messages = entry.messages;
        // Re-render all messages
        if (this.container) {
          var welcome = this.container.querySelector('.chat-welcome');
          if (welcome) welcome.remove();
          this.container.innerHTML = '';
          for (var i = 0; i < this.messages.length; i++) {
            var m = this.messages[i];
            var el = document.createElement('div');
            el.className = 'chat-message chat-message-' + m.role;
            el.innerHTML = '<div class=\"chat-message-avatar\">' + (m.role === 'user' ? 'U' : 'AI') + '</div><div class=\"chat-message-content\">' + this._renderMarkdown(m.content) + '</div>';
            this.container.appendChild(el);
          }
          this._scrollToBottom();
        }
        return true;
      }
    } catch(e) {}
    return false;
  }

  showExplanation(text) {
    // Insert explanation at top of chat as a special message
    if (!this.container) return;

    // Remove previous explanation if any
    const prev = this.container.querySelector('.chat-explanation');
    if (prev) prev.remove();

    const el = document.createElement('div');
    el.className = 'chat-message chat-message-assistant chat-explanation';
    el.innerHTML = `
      <div class="chat-message-avatar" style="background:var(--color-accent);">AI</div>
      <div class="chat-message-content" style="background:var(--color-accent-subtle); border-left:3px solid var(--color-accent);">${this._renderMarkdown(text)}</div>
    `;

    // Insert after welcome if present
    const welcome = this.container.querySelector('.chat-welcome');
    if (welcome) {
      welcome.after(el);
    } else {
      this.container.prepend(el);
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this._explanationVisible = true;
  }

  async explainSelectedText(selectedText) {
    if (!selectedText || !this.aiEngine) return;

    this._showLoading();

    try {
      const result = await this.aiEngine.generate(
        `请解释以下学术文本的含义，用中文回答，简洁清晰：\n\n${selectedText}`
      );

      this._hideLoading();
      const explanation = result.content || result.explanation || '无法获取解释。';
      this.showExplanation(explanation);
    } catch (err) {
      this._hideLoading();
      this.showExplanation(`**解释失败**：${err.message}`);
    }
  }

  addChatMessage(role, content) {
    if (!this.container) return;

    const welcome = this.container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const el = document.createElement('div');
    el.className = `chat-message chat-message-${role}`;
    el.innerHTML = `
      <div class="chat-message-avatar">${role === 'user' ? 'U' : 'AI'}</div>
      <div class="chat-message-content">${this._renderMarkdown(content)}</div>
    `;

    this.container.appendChild(el);
    this._scrollToBottom();
    this.messages.push({ role, content });
    this._saveHistory();
  }

  async sendChatMessage(content) {
    if (!this.aiEngine) return;

    // If content is provided, add it as a user message to history first
    if (content && content.trim()) {
      this.messages.push({ role: 'user', content: content.trim() });
    }

    this._showLoading();

    const assistantEl = document.createElement('div');
    assistantEl.className = 'chat-message chat-message-assistant';
    assistantEl.innerHTML = `
      <div class="chat-message-avatar">AI</div>
      <div class="chat-message-content"></div>
    `;

    if (this.container) this.container.appendChild(assistantEl);

    const contentEl = assistantEl.querySelector('.chat-message-content');
    let fullContent = '';

    try {
      var systemPrompt = '你是一个学术论文辅助阅读AI。用中文回答，语言清晰准确，使用Markdown格式。';
      if (this._docContext) {
        // Include paper as context (clipped to avoid blowing tokens on very long docs)
        var ctx = this._docContext.length > 40000 ? this._docContext.slice(0, 40000) + '\n\n[... 论文剩余部分已省略 ...]' : this._docContext;
        systemPrompt += '\n\n以下是用户正在阅读的论文全文，请基于此回答所有问题：\n\n---\n' + ctx + '\n---';
      }
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...this.messages.slice(-20)
      ];

      const generator = this.aiEngine.chat(chatMessages);

      for await (const chunk of generator) {
        fullContent += chunk.content || '';
        if (contentEl) contentEl.innerHTML = this._renderMarkdown(fullContent);
        this._scrollToBottom();
      }

      this.messages.push({ role: 'assistant', content: fullContent });
      this._saveHistory();
    } catch (err) {
      if (contentEl) {
        contentEl.innerHTML = `<span class="chat-error" style="color:var(--color-error);">请求失败：${this._escHtml(err.message)}</span>`;
      }
    } finally {
      this._hideLoading();
    }
  }

  _showLoading() {
    const loading = document.getElementById('aiLoading');
    if (loading) loading.style.display = 'flex';
  }

  _hideLoading() {
    const loading = document.getElementById('aiLoading');
    if (loading) loading.style.display = 'none';
  }

  clear() {
    this.messages = [];
    this._saveHistory();
    if (this.container) {
      this.container.innerHTML = `
        <div class="chat-welcome" style="text-align:center; padding:var(--space-8) var(--space-4); color:var(--color-text-tertiary); font-size:var(--text-sm);">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;margin-bottom:var(--space-3);"><circle cx="8" cy="8" r="7"/><path d="M8 5v3M8 11.5v.5" stroke-linecap="round"/></svg>
          <p>在左侧论文中选中文本即可触发 AI 解析</p>
          <p style="font-size:var(--text-xs); margin-top:var(--space-1);">或输入问题开始对话</p>
        </div>`;
    }
    this._hideLoading();
  }

  _renderMarkdown(text) {
    if (!text) return '';
    let html = this._escHtml(text);

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
    );
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
  }

  _escHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _scrollToBottom() {
    if (this.container) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }
}
