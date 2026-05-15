/**
 * PaperLens — Reader Core
 * Main controller for the paper reader page.
 * Coordinates DocViewer, AIPanel, AnnotationEngine, and Exporter.
 * Listens for 'page-loaded' custom event with route='reader'.
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
    this.focus = 'left'; // 'left' | 'right'
    this.currentFile = null;

    // Sub-modules (initialized on page load)
    this.docViewer = null;
    this.aiPanel = null;
    this.annotationEngine = null;
    this.exporter = null;
    this.aiEngine = null;

    // Bound handlers
    this._onPageLoaded = this._onPageLoaded.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    // Global listeners — added once
    document.addEventListener('page-loaded', this._onPageLoaded);
    document.addEventListener('keydown', this._onKeyDown);
  }

  // --- Page Lifecycle ---

  _onPageLoaded(event) {
    if (event.detail.route !== 'reader') return;
    this.state = event.detail.state;
    // Wait for the view HTML to be inserted into the DOM
    requestAnimationFrame(() => this._init());
  }

  _init() {
    const docContent = document.getElementById('readerDocContent');
    const aiContent = document.getElementById('readerAIContent');

    if (!docContent || !aiContent) {
      console.warn('Reader page elements not found');
      return;
    }

    // Initialize AI engine with the app state
    this.aiEngine = new AIEngine(this.state);

    // Initialize sub-modules
    this.docViewer = new DocViewer(docContent);
    this.aiPanel = new AIPanel(aiContent, this.aiEngine);
    this.annotationEngine = new AnnotationEngine();
    this.exporter = new Exporter();

    // Wire up UI
    this._setupDropZone();
    this._setupToolbar();
    this._setupTextSelection();
    this._setupChat();

    // Restore focus visual
    this._updateFocusVisual();
  }

  // --- File Import / Drop Zone ---

  _setupDropZone() {
    const dropZone = document.getElementById('readerDropZone');
    if (!dropZone) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    dropZone.addEventListener('dragover', () => {
      dropZone.classList.add('drop-zone-active');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drop-zone-active');
    });

    dropZone.addEventListener('drop', (e) => {
      dropZone.classList.remove('drop-zone-active');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this._importFile(files[0]);
      }
    });

    // Click to browse
    dropZone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.txt,.md,.docx';
      input.onchange = (e) => {
        if (e.target.files.length > 0) {
          this._importFile(e.target.files[0]);
        }
      };
      input.click();
    });
  }

  async _importFile(file) {
    const dropZone = document.getElementById('readerDropZone');
    if (dropZone) {
      dropZone.classList.add('drop-zone-loading');
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const resp = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || '文件上传失败');
      }

      const data = await resp.json();
      this.currentFile = { name: file.name, ...data };

      // Render document text
      const text = data.text || data.content || '';
      const annotations = this.annotationEngine.getAll();
      this.docViewer.render(text, annotations);

      // Clear AI panel for the new document
      this.aiPanel.clear();

      // Show file info
      const fileInfo = document.getElementById('readerFileInfo');
      if (fileInfo) {
        fileInfo.textContent = file.name;
        fileInfo.style.display = 'block';
      }

      // Hide drop zone, show document area
      if (dropZone) dropZone.style.display = 'none';
      const docArea = document.getElementById('readerDocArea');
      if (docArea) docArea.style.display = 'flex';

      showToast('文件加载成功', 'success');
    } catch (err) {
      showToast(err.message || '文件加载失败', 'error');
    } finally {
      if (dropZone) dropZone.classList.remove('drop-zone-loading');
    }
  }

  // --- Toolbar ---

  _setupToolbar() {
    // Highlight button
    const highlightBtn = document.getElementById('readerHighlightBtn');
    if (highlightBtn) {
      highlightBtn.addEventListener('click', () => this._addHighlight());
    }

    // Note button
    const noteBtn = document.getElementById('readerNoteBtn');
    if (noteBtn) {
      noteBtn.addEventListener('click', () => this._addNote());
    }

    // Export buttons
    const exportMDBtn = document.getElementById('readerExportMD');
    if (exportMDBtn) {
      exportMDBtn.addEventListener('click', () => this._exportMD());
    }

    const exportJSONBtn = document.getElementById('readerExportJSON');
    if (exportJSONBtn) {
      exportJSONBtn.addEventListener('click', () => this._exportJSON());
    }

    // Clear annotations button
    const clearBtn = document.getElementById('readerClearAnnotations');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this._clearAnnotations());
    }

    // Pagination controls
    document.addEventListener('doc-pagination-update', (e) => {
      const { current, total } = e.detail;
      const pageInfo = document.getElementById('readerPageInfo');
      if (pageInfo) {
        pageInfo.textContent = `${current + 1} / ${total}`;
      }
    });

    const prevBtn = document.getElementById('readerPrevPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.docViewer.currentPage > 0) {
          this.docViewer.setPage(this.docViewer.currentPage - 1);
        }
      });
    }

    const nextBtn = document.getElementById('readerNextPage');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.docViewer.currentPage < this.docViewer.getTotalPages() - 1) {
          this.docViewer.setPage(this.docViewer.currentPage + 1);
        }
      });
    }
  }

  // --- Text Selection & Actions ---

  _setupTextSelection() {
    const docContent = document.getElementById('readerDocContent');
    if (!docContent) return;

    docContent.addEventListener('mouseup', () => {
      if (this.focus !== 'left') return;
      const selectedText = this.docViewer.getSelectedText();
      if (selectedText) {
        this._showSelectionActions(selectedText);
      }
    });
  }

  _showSelectionActions(text) {
    // Remove any existing action bar
    const existing = document.querySelector('.selection-action-bar');
    if (existing) existing.remove();

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const bar = document.createElement('div');
    bar.className = 'selection-action-bar';
    bar.innerHTML = `
      <button class="sel-action-btn" data-action="explain">解释</button>
      <button class="sel-action-btn" data-action="highlight">高亮</button>
      <button class="sel-action-btn" data-action="note">笔记</button>
    `;

    // Position above the selection
    bar.style.position = 'fixed';
    bar.style.left = `${rect.left + rect.width / 2}px`;
    bar.style.top = `${rect.top - 44}px`;
    bar.style.transform = 'translateX(-50%)';
    bar.style.zIndex = '1000';

    document.body.appendChild(bar);

    // Handle action clicks
    bar.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (!action) return;
      bar.remove();

      switch (action) {
        case 'explain':
          this._explainSelected(text);
          break;
        case 'highlight':
          this._addHighlight();
          break;
        case 'note':
          this._addNote();
          break;
      }
    });

    // Remove on outside click
    const removeBar = (e) => {
      if (!bar.contains(e.target)) {
        bar.remove();
        document.removeEventListener('click', removeBar);
      }
    };
    setTimeout(() => document.addEventListener('click', removeBar), 0);
  }

  _explainSelected(text) {
    this.focus = 'right';
    this._updateFocusVisual();
    this.aiPanel.explainSelectedText(text);
  }

  _addHighlight() {
    const info = this.docViewer.getSelectionInfo();
    if (!info || !info.text) {
      showToast('请先选择文本', 'warning');
      return;
    }

    this.annotationEngine.addHighlight(info.text, { start: info.start, end: info.end });
    this._refreshDocument();
    showToast('已添加高亮', 'success');
  }

  _addNote() {
    const info = this.docViewer.getSelectionInfo();
    if (!info || !info.text) {
      showToast('请先选择文本', 'warning');
      return;
    }

    const note = prompt('请输入笔记内容：', '');
    if (note === null) return; // User cancelled

    this.annotationEngine.addNote(info.text, note.trim(), { start: info.start, end: info.end });
    this._refreshDocument();
    showToast('已添加笔记', 'success');
  }

  _refreshDocument() {
    const annotations = this.annotationEngine.getAll();
    this.docViewer.refresh(annotations);
  }

  // --- Chat ---

  _setupChat() {
    const sendBtn = document.getElementById('readerChatSend');
    const input = document.getElementById('readerChatInput');

    if (!sendBtn || !input) return;

    const sendMessage = () => {
      const content = input.value.trim();
      if (!content) return;

      this.aiPanel.addChatMessage('user', content);
      input.value = '';

      this.focus = 'right';
      this._updateFocusVisual();

      // Stream AI response
      this.aiPanel.sendChatMessage(content);
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // --- Keyboard Shortcuts ---

  _onKeyDown(e) {
    // Only handle when reader page is active
    if (!document.getElementById('readerDocContent')) return;

    // Tab — toggle focus between panels
    if (e.key === 'Tab') {
      e.preventDefault();
      this.focus = this.focus === 'left' ? 'right' : 'left';
      this._updateFocusVisual();
    }

    // Ctrl+H — highlight selection
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      this._addHighlight();
    }

    // Ctrl+E — explain selection
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      const text = this.docViewer && this.docViewer.getSelectedText();
      if (text) this._explainSelected(text);
    }
  }

  _updateFocusVisual() {
    const leftPanel = document.getElementById('readerLeftPanel');
    const rightPanel = document.getElementById('readerRightPanel');

    if (leftPanel) {
      leftPanel.classList.toggle('panel-focused', this.focus === 'left');
    }
    if (rightPanel) {
      rightPanel.classList.toggle('panel-focused', this.focus === 'right');
    }
  }

  // --- Export ---

  async _exportMD() {
    const annotations = this.annotationEngine.getAll();
    if (annotations.length === 0) {
      showToast('没有可导出的注释', 'warning');
      return;
    }

    const title = this.currentFile?.name || '未命名文档';
    const md = this.exporter.exportMD(annotations, title);

    // Download locally
    this.exporter.downloadAsFile(md, `${title}-annotations.md`, 'text/markdown');

    // Also persist to server
    try {
      await this.exporter.serverExport(annotations, title);
      showToast('注释已导出', 'success');
    } catch (err) {
      console.warn('Server export failed:', err);
      showToast('注释已导出（仅本地）', 'success');
    }
  }

  async _exportJSON() {
    const annotations = this.annotationEngine.getAll();
    if (annotations.length === 0) {
      showToast('没有可导出的注释', 'warning');
      return;
    }

    const title = this.currentFile?.name || '未命名文档';
    const json = this.exporter.exportJSON(annotations);

    this.exporter.downloadAsFile(json, `${title}-annotations.json`, 'application/json');

    try {
      await this.exporter.serverExport(annotations, title);
      showToast('注释已导出', 'success');
    } catch (err) {
      console.warn('Server export failed:', err);
      showToast('注释已导出（仅本地）', 'success');
    }
  }

  _clearAnnotations() {
    if (this.annotationEngine.getAll().length === 0) {
      showToast('没有可清除的注释', 'info');
      return;
    }

    if (confirm('确定要清除所有注释吗？此操作不可撤销。')) {
      this.annotationEngine.clear();
      this._refreshDocument();
      showToast('已清除所有注释', 'success');
    }
  }
}
