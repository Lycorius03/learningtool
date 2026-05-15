/**
 * PaperLens — Document Viewer
 * Renders document text content in the left panel.
 * Supports text selection, pagination (~3000 chars per page),
 * and visual annotation highlights.
 */
export class DocViewer {
  constructor(container) {
    this.container = container;
    this.fullText = '';
    this.pages = [];
    this.currentPage = 0;
    this.annotations = [];
  }

  // --- Public API ---

  /**
   * Render full document text with optional annotation highlights.
   * @param {string} text  - Full document plain text
   * @param {Array}  [annotations=[]] - Annotations to apply
   */
  render(text, annotations = []) {
    this.fullText = text || '';
    this.annotations = annotations || [];
    this._splitPages();
    this.currentPage = 0;
    this._renderCurrentPage();
  }

  /**
   * Re-render the current page with updated annotations (e.g. after add/remove).
   * @param {Array} annotations
   */
  refresh(annotations) {
    this.annotations = annotations || [];
    this._renderCurrentPage();
  }

  /**
   * Get the currently selected text in the document viewer.
   * @returns {string}
   */
  getSelectedText() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    return selection.toString().trim();
  }

  /**
   * Get both the selected text and its approximate character-offset
   * position within the full document text.
   * @returns {{ text: string, start: number, end: number } | null}
   */
  getSelectionInfo() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const text = selection.toString();
    if (!text.trim()) return null;

    const page = this.pages[this.currentPage];
    if (!page) return null;

    // Search for the selected text within the current page's raw text first
    const pageText = this.fullText.slice(page.start, page.end);
    const idx = pageText.indexOf(text);

    if (idx !== -1) {
      return {
        text,
        start: page.start + idx,
        end: page.start + idx + text.length
      };
    }

    // Fallback: search from the page start within the full document
    const globalIdx = this.fullText.indexOf(text, page.start);
    if (globalIdx !== -1) {
      return {
        text,
        start: globalIdx,
        end: globalIdx + text.length
      };
    }

    // Last resort: assume it is at the page start
    return { text, start: page.start, end: page.start + text.length };
  }

  /**
   * Clear the document viewer.
   */
  clear() {
    this.fullText = '';
    this.pages = [];
    this.currentPage = 0;
    this.annotations = [];
    if (this.container) {
      this.container.innerHTML = '<div class="doc-empty">暂无内容，请导入文档。</div>';
    }
  }

  /**
   * Navigate to a specific page (0-indexed).
   * @param {number} n
   */
  setPage(n) {
    if (n >= 0 && n < this.pages.length) {
      this.currentPage = n;
      this._renderCurrentPage();
    }
  }

  /**
   * Get the total number of pages.
   * @returns {number}
   */
  getTotalPages() {
    return this.pages.length;
  }

  // --- Pagination ---

  /**
   * Split the full text into pages of approximately 3000 characters,
   * trying to break at natural boundaries (paragraph, line, sentence).
   */
  _splitPages() {
    const CHARS_PER_PAGE = 3000;
    this.pages = [];

    if (!this.fullText) return;

    const len = this.fullText.length;
    let offset = 0;

    while (offset < len) {
      let end = offset + CHARS_PER_PAGE;

      if (end < len) {
        // Search window: 60%–120% of target page size
        const searchStart = offset + Math.floor(CHARS_PER_PAGE * 0.6);
        const searchEnd   = Math.min(offset + Math.floor(CHARS_PER_PAGE * 1.2), len);
        const searchText  = this.fullText.slice(searchStart, searchEnd);

        // Prefer paragraph break (double newline)
        const paraBreak = searchText.indexOf('\n\n');
        if (paraBreak !== -1) {
          end = searchStart + paraBreak + 2;
        } else {
          // Prefer single newline
          const lineBreak = searchText.lastIndexOf('\n');
          if (lineBreak !== -1 && lineBreak > CHARS_PER_PAGE * 0.25) {
            end = searchStart + lineBreak + 1;
          } else {
            // Fall back to Chinese period
            const sentenceEnd = searchText.lastIndexOf('。');
            if (sentenceEnd !== -1 && sentenceEnd > CHARS_PER_PAGE * 0.25) {
              end = searchStart + sentenceEnd + 1;
            }
          }
        }
      }

      end = Math.min(end, len);
      this.pages.push({ start: offset, end });
      offset = end;
    }
  }

  // --- Rendering ---

  /**
   * Render the current page as HTML, applying annotation highlights.
   */
  _renderCurrentPage() {
    if (!this.container) return;

    const page = this.pages[this.currentPage];
    if (!page) {
      this.container.innerHTML = '<div class="doc-empty">暂无内容，请导入文档。</div>';
      this._dispatchPaginationUpdate();
      return;
    }

    const pageText = this.fullText.slice(page.start, page.end);

    // Collect annotations that overlap this page, sorted by position
    const pageAnnotations = this.annotations
      .filter(a => a.position && a.position.start < page.end && a.position.end > page.start)
      .sort((a, b) => a.position.start - b.position.start);

    // Build HTML, interleaving plain text and <mark> wrappers
    let html = '';
    let cursor = 0;

    for (const ann of pageAnnotations) {
      const localStart = Math.max(0, ann.position.start - page.start);
      const localEnd   = Math.min(pageText.length, ann.position.end - page.start);

      // Skip invalid / fully overlapping ranges
      if (localStart < cursor || localEnd <= cursor) continue;

      // Plain text before this annotation
      if (localStart > cursor) {
        html += this._formatText(pageText.slice(cursor, localStart));
      }

      // Annotated segment
      const annText = pageText.slice(localStart, localEnd);
      const typeClass = ann.type === 'note' ? 'annotation-note' : 'annotation-highlight';
      const titleAttr = ann.type === 'note' && ann.note
        ? ` title="${this._escapeAttr(ann.note)}"`
        : '';

      html += `<mark class="${typeClass}" data-annotation-id="${ann.id}"${titleAttr}>${this._formatText(annText)}</mark>`;

      cursor = localEnd;
    }

    // Remaining text after the last annotation
    if (cursor < pageText.length) {
      html += this._formatText(pageText.slice(cursor));
    }

    this.container.innerHTML = `<div class="doc-page" data-page="${this.currentPage}">${html}</div>`;
    this._dispatchPaginationUpdate();

    // Scroll to top of the document area
    this.container.scrollTop = 0;
  }

  /**
   * Escape HTML special characters and convert newlines to <br>.
   * Does NOT wrap in <p> so that annotation character-offsets remain correct.
   */
  _formatText(text) {
    return this._escapeHtml(text).replace(/\n/g, '<br>');
  }

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _escapeAttr(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // --- Events ---

  _dispatchPaginationUpdate() {
    if (!this.container) return;
    this.container.dispatchEvent(new CustomEvent('doc-pagination-update', {
      detail: { current: this.currentPage, total: this.pages.length },
      bubbles: true
    }));
  }
}
