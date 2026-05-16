/**
 * LearningTool — Reader Core
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

    document.addEventListener('page-loaded', (e) => {
      if (e.detail.route === 'reader') this._init(e.detail.state);
    });
  }

  _init(state) {
    this.state = state;
    this.aiEngine = new AIEngine(state);

    const aiContent = document.getElementById('readerAiContent');
    this.aiPanel = new AIPanel(aiContent, this.aiEngine);

    this._setupDropZone();
    this._setupKeyboard();
    this._setupExportBtn();
    this._setupAnnotateToggle();
  }

  _setupDropZone() {
    const zone = document.getElementById('readerDropZone');
    const input = document.getElementById('readerFileInput');
    const btn = document.getElementById('readerSelectBtn');
    if (!zone) return;

    // Drag events
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('drag-over'); }));

    zone.addEventListener('drop', e => {
      const files = e.dataTransfer.files;
      if (files.length) this._importFile(files[0]);
    });

    // Click → trigger hidden file input (skip if from file input itself to avoid double trigger)
    zone.addEventListener('click', (e) => {
      if (e.target === input) return;
      input.click();
    });
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); input.click(); });

    // File selected
    input.addEventListener('change', e => {
      if (e.target.files.length) this._importFile(e.target.files[0]);
    });
  }

  async _importFile(file) {
    const zone = document.getElementById('readerDropZone');
    const badge = document.getElementById('readerFileBadge');
    if (zone) zone.classList.add('drop-zone-loading');

    try {
      const fd = new FormData(); fd.append('file', file);
      const resp = await fetch('/api/files/upload', { method: 'POST', body: fd });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
      const data = await resp.json();
      this.currentFile = { name: file.name, ...data };
      if (badge) badge.textContent = file.name;

      this.docViewer.init('readerDocContent');
      this.docViewer.render(data.text || '');

      if (zone) zone.style.display = 'none';
      const split = document.getElementById('readerSplitPanel');
      if (split) split.style.display = 'flex';
      const hint = document.getElementById('readerKeyHint');
      if (hint) hint.style.display = 'block';

      showToast('文件加载成功', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (zone) zone.classList.remove('drop-zone-loading');
    }
  }

  _setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (document.getElementById('readerSplitPanel')?.style.display === 'none') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        this.focus = this.focus === 'left' ? 'right' : 'left';
        const left = document.getElementById('readerDocPane');
        const right = document.getElementById('readerAiPane');
        if (left) left.classList.toggle('focused', this.focus === 'left');
        if (right) right.classList.toggle('focused', this.focus === 'right');
      }
    });

    // Text selection → AI explain
    document.getElementById('readerDocContent')?.addEventListener('mouseup', () => {
      const sel = this.docViewer.getSelectedText();
      if (sel && this.focus === 'left') this.aiPanel?.explainSelectedText(sel);
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
}

new ReaderCore();
