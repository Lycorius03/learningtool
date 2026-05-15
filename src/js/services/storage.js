/**
 * PaperLens — Storage Service
 * Wrapper around localStorage for persisting quiz progress, papers, and settings.
 * All reads/writes go through this service for consistent error handling.
 */

const STORAGE_KEYS = {
  QUIZ_PROGRESS: 'paperlens_quiz_progress',
  PAPERS: 'paperlens_papers',
  SETTINGS: 'paperlens_settings',
  STATE: 'paperlens_state'
};

class StorageService {
  constructor() {
    this._memoryFallback = {};  // In-memory fallback if localStorage is unavailable
    this._available = this._checkAvailability();
  }

  // ---------------------------------------------------------------------------
  // Quiz Progress
  // ---------------------------------------------------------------------------

  /**
   * Save quiz progress for a specific question set.
   * Merges with existing progress data rather than overwriting.
   *
   * @param {string} questionSetId — identifier for the question set
   * @param {Object} progressData — { [questionId]: { totalAttempts, wrongCount, streak, ema, lastSeenAt } }
   */
  saveQuizProgress(questionSetId, progressData) {
    if (!questionSetId) {
      console.warn('saveQuizProgress: questionSetId is required');
      return;
    }

    const allProgress = this._load(STORAGE_KEYS.QUIZ_PROGRESS, {});
    allProgress[questionSetId] = progressData;
    this._save(STORAGE_KEYS.QUIZ_PROGRESS, allProgress);
  }

  /**
   * Load quiz progress for a specific question set.
   * @param {string} questionSetId
   * @returns {Object} progress data for that set, or empty object
   */
  loadQuizProgress(questionSetId) {
    if (!questionSetId) return {};

    const allProgress = this._load(STORAGE_KEYS.QUIZ_PROGRESS, {});
    return allProgress[questionSetId] || {};
  }

  /**
   * Load all quiz progress across all question sets.
   * @returns {Object} { [questionSetId]: { [questionId]: stats } }
   */
  loadAllQuizProgress() {
    return this._load(STORAGE_KEYS.QUIZ_PROGRESS, {});
  }

  /**
   * Delete quiz progress for a specific question set.
   * @param {string} questionSetId
   */
  deleteQuizProgress(questionSetId) {
    if (!questionSetId) return;

    const allProgress = this._load(STORAGE_KEYS.QUIZ_PROGRESS, {});
    delete allProgress[questionSetId];
    this._save(STORAGE_KEYS.QUIZ_PROGRESS, allProgress);
  }

  // ---------------------------------------------------------------------------
  // Papers
  // ---------------------------------------------------------------------------

  /**
   * Save the papers array to storage.
   * @param {Array} papers
   */
  savePapers(papers) {
    if (!Array.isArray(papers)) {
      console.warn('savePapers: expected an array');
      return;
    }
    this._save(STORAGE_KEYS.PAPERS, papers);
  }

  /**
   * Load the papers array from storage.
   * @returns {Array}
   */
  loadPapers() {
    return this._load(STORAGE_KEYS.PAPERS, []);
  }

  /**
   * Add a single paper to the stored list.
   * @param {Object} paper
   */
  addPaper(paper) {
    if (!paper) return;
    const papers = this.loadPapers();
    papers.push({
      id: paper.id || Date.now().toString(36),
      ...paper,
      addedAt: paper.addedAt || new Date().toISOString()
    });
    this.savePapers(papers);
  }

  /**
   * Remove a paper by ID.
   * @param {string} paperId
   */
  removePaper(paperId) {
    if (!paperId) return;
    const papers = this.loadPapers();
    this.savePapers(papers.filter(p => p.id !== paperId));
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  /**
   * Save app settings.
   * @param {Object} settings
   */
  saveSettings(settings) {
    this._save(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Load app settings.
   * @returns {Object}
   */
  loadSettings() {
    return this._load(STORAGE_KEYS.SETTINGS, {
      quizMode: 'weighted-random',
      questionsPerRound: 20,
      autoRemoveErrorBook: true,
      wrongRepeat: true
    });
  }

  // ---------------------------------------------------------------------------
  // Bulk Operations
  // ---------------------------------------------------------------------------

  /**
   * Clear all PaperLens data from localStorage.
   * Deletes all keys managed by this service.
   */
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore
      }
    });
    this._memoryFallback = {};
  }

  /**
   * Export all stored data as a JSON object (for backup/migration).
   * @returns {Object}
   */
  exportAll() {
    return {
      quizProgress: this.loadAllQuizProgress(),
      papers: this.loadPapers(),
      settings: this.loadSettings(),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import all data from a previously exported JSON object.
   * @param {Object} data — the result of exportAll()
   */
  importAll(data) {
    if (!data) return;
    if (data.quizProgress) this._save(STORAGE_KEYS.QUIZ_PROGRESS, data.quizProgress);
    if (data.papers) this.savePapers(data.papers);
    if (data.settings) this.saveSettings(data.settings);
  }

  /**
   * Check whether localStorage is available.
   * @returns {boolean}
   */
  isAvailable() {
    return this._available;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _checkAvailability() {
    try {
      const testKey = '__paperlens_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  _save(key, value) {
    if (this._available) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        // Quota exceeded or other error — fall back to memory
        console.warn(`StorageService: localStorage write failed for "${key}"`, e.message);
        this._memoryFallback[key] = value;
      }
    } else {
      this._memoryFallback[key] = value;
    }
  }

  _load(key, defaultValue) {
    if (this._available) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) {
          return defaultValue;
        }
        return JSON.parse(raw);
      } catch (e) {
        console.warn(`StorageService: localStorage read failed for "${key}"`, e.message);
      }
    }

    // Fallback to memory
    return key in this._memoryFallback ? this._memoryFallback[key] : defaultValue;
  }
}

// Singleton export
export const storage = new StorageService();
export default storage;
