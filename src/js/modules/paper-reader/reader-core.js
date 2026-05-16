/**
 * LearningTool — Reader Core
 * Original document display · Tab focus toggle · AI or imported explanation
 */
import { DocViewer } from './doc-viewer.js';
import { AIPanel } from './ai-panel.js';
import { AnnotationEngine } from './annotation.js';
import { Exporter } from './exporter.js';
import { AIEngine } from '../../services/ai-engine.js';
import { showToast } from '../../utils/toast.js';

export class ReaderCore {
  constructor() {
    this.state = null;
    this.focus = 'left';
    this.currentFile = null;
    this.docViewer = new DocViewer();
    this.annotationEngine = new AnnotationEngine();
    this.exporter = new Exporter();
    this.aiPanel = null;
    this.aiEngine = null;
    this.explanationSource = 'ai'; // 'ai' or 'file'
    this.importedExplanation = null;

    document.addEventListener('page-loaded', (e) => {
      if (e.detail.route === 'reader') this._init(e.detail.state);
    });
  }

  _init(state) {
    this.state = state;
    this.aiEngine = new AIEngine(state);
    this.focus = 'left';

    const chatContainer = document.getElementById('aiChatMessages');
    this.aiPanel = new AIPanel(chatContainer, this.aiEngine);

    this._setupDropZone();
    this._setupKeyboard();
    this._setupSourceSelector();
    this._setupChatInput();
    this._setupExportBtn();
    this._setupAnnotateToggle();
    this._setupClearChat();
    this._renderPaperLibrary();

    // Start with left (document) focused = full width
    this._applyFocus();
  }

  // ==================== Source Selector ====================

  _setupSourceSelector() {
    const aiBtn = document.getElementById('sourceBtnAI');
    const fileBtn = document.getElementById('sourceBtnFile');
    const fileInput = document.getElementById('readerExplanationFileInput');

    aiBtn?.addEventListener('click', () => {
      this.explanationSource = 'ai';
      aiBtn.classList.add('active');
      aiBtn.classList.replace('btn-ghost', 'btn-accent');
      fileBtn?.classList.remove('active');
      fileBtn?.classList.replace('btn-accent', 'btn-ghost');

      const aiPanel = document.getElementById('readerAiPanel');
      const imported = document.getElementById('readerImportedExplanation');
      if (aiPanel) aiPanel.style.display = '';
      if (imported) imported.style.display = 'none';
    });

    fileBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async (e) => {
      if (!e.target.files.length) return;
      await this._importExplanation(e.target.files[0]);
    });
  }

  async _importExplanation(file) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/files/upload-explanation', { method: 'POST', body: fd });
      if (!resp.ok) throw new Error('上传解释文档失败');
      const data = await resp.json();
      this.importedExplanation = data;

      const imported = document.getElementById('readerImportedExplanation');
      if (imported) {
        imported.innerHTML = `<div style="white-space:pre-wrap;font-family:var(--font-serif);">${this._escHtml(data.text)}</div>`;
        imported.style.display = '';
      }

      // Switch to file mode UI
      const aiPanel = document.getElementById('readerAiPanel');
      if (aiPanel) aiPanel.style.display = 'none';

      const aiBtn = document.getElementById('sourceBtnAI');
      const fileBtn = document.getElementById('sourceBtnFile');
      aiBtn?.classList.replace('btn-accent', 'btn-ghost');
      aiBtn?.classList.remove('active');
      fileBtn?.classList.add('active');
      fileBtn?.classList.replace('btn-ghost', 'btn-accent');
      this.explanationSource = 'file';

      showToast(`已加载解释文档: ${file.name}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==================== File Import ====================

  _setupDropZone() {
    const zone = document.getElementById('readerDropZone');
    const input = document.getElementById('readerFileInput');
    const btn = document.getElementById('readerSelectBtn');
    if (!zone) return;

    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); zone.classList.add('drag-over');
    }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); zone.classList.remove('drag-over');
    }));

    zone.addEventListener('drop', e => {
      const files = e.dataTransfer.files;
      if (files.length) this._importFile(files[0]);
    });

    zone.addEventListener('click', (e) => {
      if (e.target === input) return;
      input.click();
    });
    btn?.addEventListener('click', e => { e.stopPropagation(); input.click(); });

    input.addEventListener('change', e => {
      if (e.target.files.length) this._importFile(e.target.files[0]);
    });
  }

  async _importFile(file) {
    const zone = document.getElementById('readerDropZone');
    const badge = document.getElementById('readerFileBadge');
    if (zone) zone.classList.add('drop-zone-loading');

    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/files/upload', { method: 'POST', body: fd });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || 'Upload failed');
      }
      const data = await resp.json();
      this.currentFile = { name: file.name, ...data };
      if (badge) { badge.textContent = file.name; badge.style.display = ''; }

      // Save full text for AI context
      this.fullText = data.text || '';
      if (this.aiPanel) {
        this.aiPanel.setDocumentContext(this.fullText);
        // Use filename+size as paper ID for chat persistence
        var paperId = (data.filename || file.name) + '_' + (data.size || file.size);
        this.aiPanel.setPaperId(paperId);
        // Try to restore previous chat history
        var restored = this.aiPanel.loadHistory();
        if (restored) {
          showToast('已恢复之前的对话记录', 'info');
        }
      }

      // Save to paper library
      this._savePaper({ filename: data.filename || file.name, text: this.fullText, type: data.type, size: data.size, viewPath: data.viewPath });

      // Show document
      this._renderDocument(data);

      // Hide drop zone, show main content
      if (zone) zone.style.display = 'none';
      const main = document.getElementById('readerMainContent');
      if (main) main.style.display = 'flex';

      // Show toolbar buttons
      ['readerAnnotateToggle', 'readerExportBtn', 'readerClearChat'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
      });

      showToast('论文加载成功', 'success');

      // Auto-summary: only if no history was restored
      if (!restored && this.explanationSource === 'ai' && this.aiPanel && this.fullText) {
        setTimeout(() => {
          this.aiPanel.addChatMessage('user', '请通读以下完整论文并给出详细概要，包括：1) 核心论点 2) 研究方法 3) 主要发现 4) 关键结论。用中文回答。\n\n--- 论文全文 ---\n' + this.fullText);
          this.aiPanel.sendChatMessage();
        }, 500);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (zone) zone.classList.remove('drop-zone-loading');
    }
  }

  _renderDocument(data) {
    const viewer = document.getElementById('readerDocViewer');
    if (!viewer) return;

    const ext = data.type || '';

    if (ext === '.pdf') {
      // Show PDF via embed — no sandbox since same-origin
      viewer.innerHTML = `
        <embed src="${data.viewPath}" type="application/pdf" style="width:100%; height:100%; min-height:500px; border:none;" />
      `;
    } else {
      // TXT, MD, DOCX: render text through doc viewer
      this.docViewer.init(viewer);
      this.docViewer.render(data.text || '');
    }
  }

  // ==================== Keyboard ====================

  _setupKeyboard() {
    document.addEventListener('keydown', e => {
      // Only handle when reader is active
      const main = document.getElementById('readerMainContent');
      if (!main || main.style.display === 'none') return;

      if (e.key === 'Tab') {
        e.preventDefault();
        this.focus = this.focus === 'left' ? 'right' : 'left';
        this._applyFocus();
      }
    });
  }

  _applyFocus() {
    const left = document.getElementById('readerDocPane');
    const right = document.getElementById('readerExplanationPane');
    const split = document.getElementById('readerSplitPanel');
    const hint = document.getElementById('readerFocusHint');

    if (!left || !right || !split) return;

    left.classList.remove('focused');
    right.classList.remove('focused');
    split.classList.remove('focus-left', 'focus-right');

    if (this.focus === 'left') {
      left.classList.add('focused');
      split.classList.add('focus-left');
      if (hint) hint.textContent = 'Focus: Paper';
    } else {
      right.classList.add('focused');
      split.classList.add('focus-right');
      if (hint) hint.textContent = 'Focus: Explanation';
    }

    // Sync scroll for imported explanation mode
    this._setupSyncScroll(left, right);
  }

  // Sync scroll: when scrolling one panel, the other follows
  _setupSyncScroll(leftPane, rightPane) {
    if (this._syncScrollActive) return;
    if (this.explanationSource !== 'file') return;
    this._syncScrollActive = true;

    var syncing = false;
    function sync(source, target) {
      if (syncing) return;
      syncing = true;
      var pct = source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight);
      target.scrollTop = pct * (target.scrollHeight - target.clientHeight);
      requestAnimationFrame(function() { syncing = false; });
    }

    leftPane.addEventListener('scroll', function() { sync(leftPane, rightPane); }, { passive: true });
    rightPane.addEventListener('scroll', function() { sync(rightPane, leftPane); }, { passive: true });
  }

  // ==================== Chat Input ====================

  _setupChatInput() {
    const input = document.getElementById('aiChatInput');
    const send = document.getElementById('aiChatSend');

    send?.addEventListener('click', () => {
      const content = input?.value.trim();
      if (!content || !this.aiPanel) return;
      this.aiPanel.addChatMessage('user', content);
      input.value = '';
      this.aiPanel.sendChatMessage();
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send?.click();
      }
    });

    // Text selection → AI explain (works when docViewer is active)
    const viewer = document.getElementById('readerDocViewer');
    viewer?.addEventListener('mouseup', () => {
      if (this.explanationSource !== 'ai') return;
      const sel = this.docViewer.getSelectedText();
      if (sel && this.focus === 'left') {
        this.aiPanel?.explainSelectedText(sel);
      }
    });
  }

  // ==================== Toolbar Buttons ====================

  _setupClearChat() {
    document.getElementById('readerClearChat')?.addEventListener('click', () => {
      this.aiPanel?.clear();
    });
  }

  _setupExportBtn() {
    document.getElementById('readerExportBtn')?.addEventListener('click', () => {
      const anns = this.annotationEngine.getAll();
      if (!anns.length) { showToast('暂无标注', 'warning'); return; }
      const md = this.exporter.exportMD(anns, this.currentFile?.name || '标注');
      this.exporter.downloadAsFile(md, 'annotations.md');
      showToast('标注已导出', 'success');
    });
  }

  _setupAnnotateToggle() {
    const btn = document.getElementById('readerAnnotateToggle');
    btn?.addEventListener('click', () => {
      const on = this.annotationEngine.toggle();
      btn.style.color = on ? 'var(--color-accent)' : '';
      showToast(on ? '标注模式：开' : '标注模式：关', 'info');
    });
  }

  _escHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== Paper Library ====================

  _getSavedPapers() {
    try {
      // Use state's paper list for consistency
      const state = JSON.parse(localStorage.getItem('paperlens_state') || '{}');
      return state.papers || [];
    } catch (e) { return []; }
  }

  _savePaper(paperData) {
    try {
      const state = JSON.parse(localStorage.getItem('paperlens_state') || '{}');
      const papers = state.papers || [];
      // Avoid duplicates
      const exists = papers.find(p => p.filename === paperData.filename && p.size === paperData.size);
      if (!exists) {
        papers.unshift({ id: Date.now().toString(36), ...paperData, savedAt: new Date().toISOString() });
        if (papers.length > 50) papers.length = 50;
        state.papers = papers;
        localStorage.setItem('paperlens_state', JSON.stringify(state));
      }
    } catch (e) { /* ignore */ }
  }

  _renderPaperLibrary() {
    const papers = this._getSavedPapers();
    const container = document.getElementById('readerPaperHistory');
    if (!container) return;
    if (papers.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';
    const list = container.querySelector('.paper-history-list');
    if (!list) return;

    list.innerHTML = papers.slice(0, 10).map(p => `
      <div class="paper-history-item" data-filename="${this._escHtml(p.filename)}" style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-2) var(--space-3); border-radius:var(--radius-sm); cursor:pointer; font-size:var(--text-xs); color:var(--color-text-secondary); transition:background 0.15s;">
        <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this._escHtml(p.filename)}</span>
        <span style="flex-shrink:0; margin-left:var(--space-2); color:var(--color-text-tertiary);">${p.type || ''}</span>
      </div>
    `).join('');

    // Click handler
    list.querySelectorAll('.paper-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const filename = item.dataset.filename;
        const paper = papers.find(p => p.filename === filename);
        if (paper) this._reloadPaper(paper);
      });
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--color-bg-surface)'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
    });
  }

  async _reloadPaper(paper) {
    const zone = document.getElementById('readerDropZone');
    const badge = document.getElementById('readerFileBadge');

    try {
      if (paper.text) {
        this.currentFile = paper;
        this.fullText = paper.text || '';
        if (badge) { badge.textContent = paper.filename; badge.style.display = ''; }
        this._renderDocument(paper);
        if (zone) zone.style.display = 'none';
        const main = document.getElementById('readerMainContent');
        if (main) main.style.display = 'flex';
        ['readerAnnotateToggle', 'readerExportBtn', 'readerClearChat'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = '';
        });
        // Restore chat history
        if (this.aiPanel) {
          this.aiPanel.setDocumentContext(this.fullText);
          var paperId = (paper.filename || 'paper') + '_' + (paper.size || 0);
          this.aiPanel.setPaperId(paperId);
          var restored = this.aiPanel.loadHistory();
          if (restored) {
            showToast('已恢复之前的对话记录', 'info');
          }
        }
        showToast('已打开: ' + paper.filename, 'info');
      } else {
        showToast('该论文需要重新上传', 'warning');
      }
    } catch (err) {
      showToast('打开论文失败: ' + err.message, 'error');
    }
  }
}

new ReaderCore();
