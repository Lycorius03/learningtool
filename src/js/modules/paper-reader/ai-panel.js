/**
 * PaperLens — AI Panel
 * Renders the right panel: AI explanations and chat interface.
 * Uses AIEngine for backend communication with streaming support.
 */
export class AIPanel {
  constructor(container, aiEngine) {
    this.container = container;
    this.aiEngine = aiEngine;
    this.messages = []; // Chat history for context

    this._buildDOM();
  }

  // --- DOM Construction ---

  _buildDOM() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="ai-panel-inner">
        <div class="ai-explanation-area" id="aiExplanationArea" style="display:none;">
          <div class="ai-explanation-header">
            <span>AI 解释</span>
            <button class="ai-close-explanation" id="aiCloseExplanation">&times;</button>
          </div>
          <div class="ai-explanation-content" id="aiExplanationContent"></div>
        </div>
        <div class="ai-chat-area">
          <div class="ai-chat-messages" id="aiChatMessages">
            <div class="chat-welcome">选择文档中的文本，或输入问题开始对话。</div>
          </div>
          <div class="ai-chat-input-area">
            <textarea id="aiChatInput" placeholder="输入问题..." rows="2"></textarea>
            <button id="aiChatSend">发送</button>
          </div>
        </div>
        <div class="ai-loading" id="aiLoading" style="display:none;">
          <div class="loading-spinner"></div>
          <span>AI 正在思考...</span>
        </div>
      </div>
    `;

    // Cache DOM references
    this._explanationArea   = this.container.querySelector('#aiExplanationArea');
    this._explanationContent = this.container.querySelector('#aiExplanationContent');
    this._chatMessages      = this.container.querySelector('#aiChatMessages');
    this._chatInput         = this.container.querySelector('#aiChatInput');
    this._chatSend          = this.container.querySelector('#aiChatSend');
    this._loading           = this.container.querySelector('#aiLoading');

    // Close explanation button
    const closeBtn = this.container.querySelector('#aiCloseExplanation');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this._explanationArea) {
          this._explanationArea.style.display = 'none';
        }
      });
    }
  }

  // --- Public API ---

  /**
   * Show an AI-generated explanation in the explanation area.
   * @param {string} text - Explanation content (supports basic Markdown)
   */
  showExplanation(text) {
    if (!this._explanationArea || !this._explanationContent) return;

    this._explanationArea.style.display = 'block';
    this._explanationContent.innerHTML = this._renderMarkdown(text);
    this._explanationArea.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Send selected text to AI for explanation, show loading, then display result.
   * @param {string} selectedText
   */
  async explainSelectedText(selectedText) {
    if (!selectedText || !this.aiEngine) return;

    this.showLoading();

    try {
      const result = await this.aiEngine.generate(
        `请解释以下学术文本的含义，用中文回答，简洁清晰：\n\n${selectedText}`
      );

      this.hideLoading();
      const explanation = result.content || result.text || result.explanation || '无法获取解释。';
      this.showExplanation(explanation);
    } catch (err) {
      this.hideLoading();
      this.showExplanation(`**解释失败**：${err.message}`);
    }
  }

  /**
   * Add a chat message bubble to the chat area.
   * @param {string} role    - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  addChatMessage(role, content) {
    if (!this._chatMessages) return;

    // Remove placeholder welcome message
    const welcome = this._chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const el = document.createElement('div');
    el.className = `chat-message chat-message-${role}`;
    el.innerHTML = `
      <div class="chat-message-avatar">${role === 'user' ? 'U' : 'AI'}</div>
      <div class="chat-message-content">${this._renderMarkdown(content)}</div>
    `;

    this._chatMessages.appendChild(el);
    this._scrollToBottom();

    // Keep in history
    this.messages.push({ role, content });
  }

  /**
   * Send a user chat message to the AI and stream the response into the chat.
   * @param {string} content - User message
   */
  async sendChatMessage(content) {
    if (!this.aiEngine) return;

    this.showLoading();

    // Create a placeholder bubble for the streaming assistant response
    const assistantEl = document.createElement('div');
    assistantEl.className = 'chat-message chat-message-assistant';
    assistantEl.innerHTML = `
      <div class="chat-message-avatar">AI</div>
      <div class="chat-message-content"></div>
    `;

    if (this._chatMessages) {
      this._chatMessages.appendChild(assistantEl);
    }

    const contentEl = assistantEl.querySelector('.chat-message-content');
    let fullContent = '';

    try {
      // Build message array with system prompt and recent history
      const chatMessages = [
        {
          role: 'system',
          content: '你是一个学术论文辅助阅读AI。用中文回答，语言清晰准确，使用Markdown格式。'
        },
        ...this.messages.slice(-10) // Keep last 10 messages for context
      ];

      const generator = this.aiEngine.chat(chatMessages);

      for await (const chunk of generator) {
        fullContent += chunk.content || '';
        if (contentEl) {
          contentEl.innerHTML = this._renderMarkdown(fullContent);
        }
        this._scrollToBottom();
      }

      // Persist the assistant response
      this.messages.push({ role: 'assistant', content: fullContent });
    } catch (err) {
      if (contentEl) {
        contentEl.innerHTML = `<span class="chat-error">请求失败：${this._escapeHtml(err.message)}</span>`;
      }
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Show the loading indicator.
   */
  showLoading() {
    if (this._loading) {
      this._loading.style.display = 'flex';
    }
  }

  /**
   * Hide the loading indicator.
   */
  hideLoading() {
    if (this._loading) {
      this._loading.style.display = 'none';
    }
  }

  /**
   * Clear all content — explanation area and chat messages.
   */
  clear() {
    this.messages = [];

    if (this._explanationArea)   this._explanationArea.style.display = 'none';
    if (this._explanationContent) this._explanationContent.innerHTML = '';
    if (this._chatMessages)      this._chatMessages.innerHTML = '<div class="chat-welcome">选择文档中的文本，或输入问题开始对话。</div>';
    if (this._chatInput)         this._chatInput.value = '';

    this.hideLoading();
  }

  // --- Helpers ---

  /**
   * Minimal Markdown-to-HTML renderer.
   * Handles: code blocks, inline code, bold, italic, headings, lists, paragraphs.
   */
  _renderMarkdown(text) {
    if (!text) return '';

    let html = this._escapeHtml(text);

    // Fenced code blocks (```lang\n...\n```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
    );

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

    // Unordered list items
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    // Ordered list items
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Double newlines → paragraph break
    html = html.replace(/\n\n/g, '</p><p>');

    // Single newline → line break
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph
    return `<p>${html}</p>`;
  }

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _scrollToBottom() {
    if (this._chatMessages) {
      this._chatMessages.scrollTop = this._chatMessages.scrollHeight;
    }
  }
}
