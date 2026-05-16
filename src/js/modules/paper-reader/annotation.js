/**
 * PaperLens — Annotation Engine
 * In-memory store for document highlights and notes.
 * Annotations are rendered by DocViewer via `<mark class="annotation-highlight">` wrappers.
 */
export class AnnotationEngine {
  constructor() {
    /** @type {Array<{id: string, type: 'highlight'|'note', text: string, note?: string, position: {start: number, end: number}, timestamp: string}>} */
    this.annotations = [];
    this._active = false;
  }

  /** Toggle annotation mode on/off. Returns the new state. */
  toggle() {
    this._active = !this._active;
    return this._active;
  }

  /** Whether annotation mode is currently active. */
  isActive() {
    return this._active;
  }

  // --- Public API ---

  /**
   * Add a highlight annotation.
   * @param {string} text       - The highlighted text
   * @param {{start: number, end: number}} position - Character offsets in full document
   * @returns {object} The created annotation
   */
  addHighlight(text, position) {
    const annotation = {
      id: this._generateId(),
      type: 'highlight',
      text,
      position,
      timestamp: new Date().toISOString()
    };

    this.annotations.push(annotation);
    return annotation;
  }

  /**
   * Add a note annotation (highlight + attached note).
   * @param {string} text       - The annotated text
   * @param {string} note       - The note content
   * @param {{start: number, end: number}} position - Character offsets
   * @returns {object} The created annotation
   */
  addNote(text, note, position) {
    const annotation = {
      id: this._generateId(),
      type: 'note',
      text,
      note,
      position,
      timestamp: new Date().toISOString()
    };

    this.annotations.push(annotation);
    return annotation;
  }

  /**
   * Remove an annotation by its ID.
   * @param {string} id
   * @returns {boolean} Whether the annotation was found and removed
   */
  removeAnnotation(id) {
    const index = this.annotations.findIndex(a => a.id === id);
    if (index !== -1) {
      this.annotations.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get a shallow copy of all annotations.
   * @returns {Array}
   */
  getAll() {
    return [...this.annotations];
  }

  /**
   * Get annotations whose position range overlaps the given range.
   * @param {number} start
   * @param {number} end
   * @returns {Array}
   */
  getByRange(start, end) {
    return this.annotations.filter(a =>
      a.position && a.position.start < end && a.position.end > start
    );
  }

  /**
   * Look up a single annotation by ID.
   * @param {string} id
   * @returns {object | undefined}
   */
  getById(id) {
    return this.annotations.find(a => a.id === id);
  }

  /**
   * Update the note text of an existing annotation.
   * @param {string} id
   * @param {string} note
   * @returns {boolean} Whether the update succeeded
   */
  updateNote(id, note) {
    const annotation = this.annotations.find(a => a.id === id);
    if (annotation) {
      annotation.note = note;
      annotation.timestamp = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Return the total number of stored annotations.
   * @returns {number}
   */
  getCount() {
    return this.annotations.length;
  }

  /**
   * Remove all annotations.
   */
  clear() {
    this.annotations = [];
  }

  // --- Internal ---

  /**
   * Generate a unique annotation ID.
   * @returns {string}
   */
  _generateId() {
    return 'ann_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
}
