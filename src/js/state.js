/**
 * PaperLens — Global State Management
 * Handles admin session, API keys, quiz progress, papers list.
 */
export class AppState {
  constructor() {
    this.isAdmin = false;
    this.adminSessionId = null;

    // User's own API keys (encrypted in localStorage)
    this.userApiKeys = {};

    // Papers library
    this.papers = [];

    // Quiz progress per question set
    this.quizProgress = {};

    // Settings
    this.settings = {
      quizMode: 'weighted-random',
      questionsPerRound: 20,
      autoRemoveErrorBook: true,
      wrongRepeat: true
    };

    this._adminCallbacks = [];
  }

  // --- Persistence ---
  async loadFromStorage() {
    try {
      const data = JSON.parse(localStorage.getItem('paperlens_state') || '{}');
      this.userApiKeys = data.userApiKeys || {};
      this.papers = data.papers || [];
      this.quizProgress = data.quizProgress || {};
      this.settings = { ...this.settings, ...(data.settings || {}) };
    } catch (e) {
      console.warn('Failed to load state from localStorage', e);
    }

    // Verify admin session is still valid on server
    try {
      const resp = await fetch('/api/admin/status');
      if (resp.ok) {
        const data = await resp.json();
        if (data.isAdmin) {
          this.isAdmin = true;
          this._adminCallbacks.forEach(cb => cb(true));
        }
      }
    } catch (e) {
      // Server not reachable or not logged in — stay logged out
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem('paperlens_state', JSON.stringify({
        userApiKeys: this.userApiKeys,
        papers: this.papers,
        quizProgress: this.quizProgress,
        settings: this.settings
      }));
    } catch (e) {
      console.warn('Failed to save state to localStorage', e);
    }
  }

  // --- Admin ---
  async login(username, password) {
    const resp = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '登录失败');
    this.isAdmin = true;
    this.adminSessionId = data.sessionId;
    this._adminCallbacks.forEach(cb => cb(true));
    this.saveToStorage();
  }

  async logout() {
    try { await fetch('/api/admin/logout', { method: 'POST' }); } catch (e) { /* ignore network errors */ }
    this.isAdmin = false;
    this.adminSessionId = null;
    this._adminCallbacks.forEach(cb => cb(false));
    this.saveToStorage();
  }

  onAdminChange(callback) {
    this._adminCallbacks.push(callback);
    // Immediately fire with current state if already admin
    if (this.isAdmin) callback(true);
  }

  // --- API Keys ---
  setUserApiKey(provider, key) {
    this.userApiKeys[provider] = key;
    this.saveToStorage();
  }

  getUserApiKey(provider) {
    return this.userApiKeys[provider] || null;
  }

  // --- Papers ---
  addPaper(paper) {
    this.papers.push({
      id: Date.now().toString(36),
      ...paper,
      addedAt: new Date().toISOString()
    });
    this.saveToStorage();
  }

  removePaper(paperId) {
    this.papers = this.papers.filter(p => p.id !== paperId);
    this.saveToStorage();
  }

  // --- Settings ---
  updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
    this.saveToStorage();
  }
}
