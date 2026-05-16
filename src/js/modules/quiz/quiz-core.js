/**
 * PaperLens — Quiz Core Controller
 * Manages quiz state, orchestrates sub-modes, handles file loading/session lifecycle.
 */
import { Sequential } from './sequential.js';
import { WeightedRandom } from './weighted-random.js';
import { ErrorBook } from './error-book.js';
import { TemplateGen } from './template-gen.js';
import { showToast } from '../../utils/toast.js';
import { decryptApiKey, getDevicePassword } from '../../utils/crypto.js';

export class QuizCore {
  constructor() {
    this.currentMode = null;
    this.questions = [];
    this.questionSets = {};       // { setId: { name, questions[] } }
    this.currentSetId = null;
    this.currentIndex = 0;
    this.currentQuestion = null;  // Track current question object (for weighted-random)
    this.answers = [];
    this.startTime = null;
    this.isSessionActive = false;
    this.timerInterval = null;
    this._roundQuestionsAnswered = 0;
    this._roundQuestionsTotal = 0;

    this.modes = {
      'sequential': new Sequential(),
      'weighted-random': null,   // instantiated on use (needs state reference)
      'error-book': new ErrorBook()
    };

    this.templateGen = new TemplateGen();

    // Bind and listen
    this._onPageLoaded = this._onPageLoaded.bind(this);
    document.addEventListener('page-loaded', this._onPageLoaded);
  }

  // ---------------------------------------------------------------------------
  // Route Handling
  // ---------------------------------------------------------------------------
  _onPageLoaded(e) {
    const { route, state } = e.detail;
    this.state = state;

    // Cleanup active session when navigating away from quiz-session
    if (route !== 'quiz-session' && this.isSessionActive) {
      this._endQuiz();
    }

    if (route === 'quiz') {
      this._setupQuizHome();
    } else if (route === 'quiz-session') {
      this._setupQuizSession();
    }
  }

  _setupQuizHome() {
    // Defer DOM queries to next microtask so the view HTML is in the document
    requestAnimationFrame(() => {
      this._bindQuizHomeEvents();
      this._renderQuestionSetList();
      this._bindAiConversion();
    });
  }

  _bindAiConversion() {
    const aiInput = document.getElementById('quizAiFileInput');
    const aiBtn = document.getElementById('quizAiConvertBtn');
    const aiStatus = document.getElementById('quizAiStatus');

    if (!aiInput || !aiBtn) return;

    aiBtn.addEventListener('click', () => aiInput.click());
    aiInput.addEventListener('change', async () => {
      const file = aiInput.files[0];
      if (!file) return;

      // Get user AI config
      var models = [];
      try { models = JSON.parse(localStorage.getItem('paperlens_models') || '[]'); } catch(e) {}
      var model = models.find(function(m) { return m.default; }) || models[0];

      if (aiStatus) aiStatus.innerHTML = '<span style=\"color:var(--color-info);\">AI analyzing document, generating quiz...</span>';
      if (aiBtn) aiBtn.disabled = true;

      try {
        var text = '';
        var ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'json') {
          // JSON: read client-side, try parsing
          text = await this._readFile(file);
          try { JSON.parse(text); } catch(e) { /* raw text is fine for AI */ }
        } else if (ext === 'pdf' || ext === 'docx') {
          var fd = new FormData(); fd.append('file', file);
          var resp = await fetch('/api/files/upload', { method: 'POST', body: fd });
          if (!resp.ok) throw new Error('File parsing failed');
          var data = await resp.json();
          text = data.text || '';
        } else {
          text = await this._readFile(file);
        }

        if (!text || !text.trim()) throw new Error('Could not extract text from file');

        // Build request with user's provider config
        var body = { text: text, filename: file.name };
        if (model && model.apiKey) {
          var key = model.apiKey;
          try { key = await decryptApiKey(key, getDevicePassword()); } catch(e) { /* plaintext fallback */ }
          body.providerConfig = { provider: model.provider, apiKey: key, baseUrl: model.baseUrl, model: model.model };
        }

        var aiResp = await fetch('/api/ai/convert-to-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!aiResp.ok) {
          var err = await aiResp.json().catch(function() { return {}; });
          throw new Error(err.error || 'AI conversion failed');
        }

        var result = await aiResp.json();
        if (result.success && result.questions) {
          var setId = this._generateSetId(file.name);
          var name = file.name.replace(/\.\w+$/, '');
          this.questionSets[setId] = { name: name, questions: result.questions };
          this._renderQuestionSetList();

          var fileNameEl = document.getElementById('quizFileName');
          var fileInfoEl = document.getElementById('quizFileInfo');
          var questionCountEl = document.getElementById('quizQuestionCount');
          if (fileNameEl) fileNameEl.textContent = name + ' (AI)';
          if (fileInfoEl) fileInfoEl.style.display = 'flex';
          if (questionCountEl) questionCountEl.textContent = result.questions.length + ' questions';
          showToast('AI generated ' + result.count + ' questions', 'success');
          var startBtn = document.getElementById('quizStartBtn');
          if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Start Quiz'; }
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (aiStatus) aiStatus.innerHTML = '';
        if (aiBtn) aiBtn.disabled = false;
        aiInput.value = '';
      }
    });
  }

  _setupQuizSession() {
    if (!this.isSessionActive) {
      // If no active session, redirect back
      if (window.__lt && window.__lt.router) {
        window.__lt.router.navigate('quiz');
      }
      return;
    }
    requestAnimationFrame(() => {
      this._renderCurrentQuestion();
      this._bindSessionEvents();
    });
  }

  // ---------------------------------------------------------------------------
  // Quiz Home — Question Set Management
  // ---------------------------------------------------------------------------
  _bindQuizHomeEvents() {
    const fileInput = document.getElementById('quizFileInput');
    const selectBtn = document.getElementById('quizSelectBtn');
    const startBtn = document.getElementById('quizStartBtn');
    const dropZone = document.getElementById('quizDropZone');
    const fileInfo = document.getElementById('quizFileInfo');
    const fileName = document.getElementById('quizFileName');
    const questionCount = document.getElementById('quizQuestionCount');
    const clearBtn = document.getElementById('quizClearFile');
    const modeHint = document.getElementById('quizModeHint');

    // Default mode
    this.currentMode = 'weighted-random';

    // Mode card clicks
    document.querySelectorAll('.quiz-mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.quiz-mode-card').forEach(c => c.style.borderColor = '');
        card.style.borderColor = 'var(--color-accent)';
        const rawMode = card.dataset.mode;
        this.currentMode = rawMode === 'wrongbook' ? 'error-book' : rawMode === 'weighted' ? 'weighted-random' : rawMode;
        if (modeHint) modeHint.innerHTML = 'Current mode: <strong style="color:var(--color-accent);">' + card.querySelector('.card-header').textContent + '</strong>';
      });
    });

    // Select file button → trigger hidden input
    if (selectBtn && fileInput) {
      selectBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
      dropZone?.addEventListener('click', (e) => {
        // Skip if the click came from the file input itself (programmatic click bubbles)
        if (e.target === fileInput) return;
        fileInput.click();
      });
    }

    // File selected → load
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
          this.loadQuestions(file);
          if (fileName) fileName.textContent = file.name;
          if (fileInfo) fileInfo.style.display = 'flex';
        }
      });
    }

    // Drag and drop
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) {
          if (fileInput) fileInput.files = e.dataTransfer.files;
          this.loadQuestions(file);
          if (fileName) fileName.textContent = file.name;
          if (fileInfo) fileInfo.style.display = 'flex';
        }
      });
    }

    // Clear file
    clearBtn?.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      if (fileInfo) fileInfo.style.display = 'none';
      this.questionSets = {};
      if (questionCount) questionCount.textContent = '0 questions';
      updateStartBtn();
    });

    // Start quiz
    const updateStartBtn = () => {
      const ids = Object.keys(this.questionSets || {});
      if (startBtn) {
        startBtn.disabled = ids.length === 0;
        startBtn.textContent = ids.length ? 'Start Quiz (' + Object.values(this.questionSets).reduce((s, qs) => s + qs.questions.length, 0) + ' questions)' : 'Import questions to start';
      }
    };

    startBtn?.addEventListener('click', () => {
      const ids = Object.keys(this.questionSets || {});
      if (!ids.length) { showToast('Please import questions first', 'warning'); return; }
      // Use the first (or only) question set
      const setId = ids[0];
      this.startQuiz(setId, this.currentMode || 'sequential');
    });

    // --- Quiz Settings: load from state and bind save ---
    const wrongRepeatCb = document.getElementById('quizWrongRepeat');
    const autoRemoveCb = document.getElementById('quizAutoRemove');
    const roundCountEl = document.getElementById('quizRoundCount');
    const roundDecBtn = document.getElementById('quizRoundDec');
    const roundIncBtn = document.getElementById('quizRoundInc');

    // Load saved settings from state
    if (this.state) {
      const s = this.state.settings || {};
      if (wrongRepeatCb) wrongRepeatCb.checked = s.wrongRepeat !== false;
      if (autoRemoveCb) autoRemoveCb.checked = s.autoRemoveErrorBook === true;
      if (roundCountEl) roundCountEl.textContent = s.questionsPerRound || 20;
    }

    // Save on toggle change
    wrongRepeatCb?.addEventListener('change', () => {
      if (this.state) this.state.updateSettings({ wrongRepeat: wrongRepeatCb.checked });
      showToast(wrongRepeatCb.checked ? '错题重复：开' : '错题重复：关', 'info');
    });
    autoRemoveCb?.addEventListener('change', () => {
      if (this.state) this.state.updateSettings({ autoRemoveErrorBook: autoRemoveCb.checked });
      showToast(autoRemoveCb.checked ? '自动移除已掌握：开' : '自动移除已掌握：关', 'info');
    });

    // Round count controls
    roundDecBtn?.addEventListener('click', () => {
      let n = parseInt(roundCountEl?.textContent) || 20;
      n = Math.max(5, n - 5);
      if (roundCountEl) roundCountEl.textContent = n;
      if (this.state) this.state.updateSettings({ questionsPerRound: n });
    });
    roundIncBtn?.addEventListener('click', () => {
      let n = parseInt(roundCountEl?.textContent) || 20;
      n = Math.min(100, n + 5);
      if (roundCountEl) roundCountEl.textContent = n;
      if (this.state) this.state.updateSettings({ questionsPerRound: n });
    });

    // Override loadQuestions to update UI
    const origLoad = this.loadQuestions.bind(this);
    this.loadQuestions = async (file) => {
      await origLoad(file);
      if (questionCount) {
        const ids = Object.keys(this.questionSets || {});
        questionCount.textContent = ids.length ? Object.values(this.questionSets).reduce((s, qs) => s + qs.questions.length, 0) + ' questions' : '0 questions';
      }
      updateStartBtn();
    };
  }

  _renderQuestionSetList() {
    var list = document.getElementById('quizSetList');
    if (!list) return;
    var ids = Object.keys(this.questionSets);

    if (ids.length === 0) {
      list.innerHTML = '<div style=\"font-size:var(--text-sm); color:var(--color-text-tertiary); padding:var(--space-4); text-align:center;\">No question sets loaded.</div>';
      return;
    }

    var self = this;
    list.innerHTML = ids.map(function(id) {
      var set = self.questionSets[id];
      var active = self.currentSetId === id ? ' style=\"border-color:var(--color-accent);\"' : '';
      return '<div class=\"card\"' + active + ' data-set-id=\"' + id + '\" style=\"display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4);cursor:pointer;margin-bottom:var(--space-2);\">' +
        '<div style=\"flex:1;min-width:0;\"><span style=\"font-size:var(--text-sm);font-weight:var(--weight-medium);color:var(--color-text-primary);\">' + self._escapeHtml(set.name) + '</span><span style=\"font-size:var(--text-xs);color:var(--color-text-tertiary);margin-left:var(--space-2);\">' + set.questions.length + ' questions</span></div>' +
        '<button class=\"btn btn-ghost btn-sm quiz-set-delete\" data-set-id=\"' + id + '\" style=\"color:var(--color-error);flex-shrink:0;\" title=\"Delete set\">&times;</button>' +
        '</div>';
    }).join('');

    // Click to select
    list.querySelectorAll('.card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.quiz-set-delete')) return;
        var id = card.dataset.setId;
        self.currentSetId = id;
        self._renderQuestionSetList();
        var startBtn = document.getElementById('quizStartBtn');
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Start Quiz'; }
      });
    });

    // Delete
    list.querySelectorAll('.quiz-set-delete').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.dataset.setId;
        if (confirm('Delete question set \"' + (self.questionSets[id]?.name || id) + '\"?')) {
          delete self.questionSets[id];
          if (self.currentSetId === id) self.currentSetId = null;
          self._renderQuestionSetList();
          showToast('Set deleted', 'info');
        }
      });
    });
  }

  _showTemplate() {
    const schema = this.templateGen.getTemplateSchema();
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz-template.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('题库模板已下载', 'success');
    return schema;
  }

  // ---------------------------------------------------------------------------
  // File Loading & Validation
  // ---------------------------------------------------------------------------
  async loadQuestions(file) {
    try {
      const text = await this._readFile(file);
      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        showToast('JSON 格式错误，请检查文件内容', 'error');
        return null;
      }

      // Support both raw array and wrapped format
      let questions;
      if (Array.isArray(data)) {
        questions = data;
      } else if (data.questions && Array.isArray(data.questions)) {
        questions = data.questions;
      } else {
        showToast('题库格式错误：需要包含 questions 数组', 'error');
        return null;
      }

      const result = this.templateGen.validateQuestions(questions);
      if (!result.valid) {
        this._showValidationErrors(result.errors);
        return null;
      }

      const setId = this._generateSetId(file.name);
      const name = data.name || file.name.replace(/\.\w+$/, '');
      this.questionSets[setId] = { name, questions };
      this._renderQuestionSetList();
      showToast(`题库 "${name}" 加载成功，共 ${questions.length} 题`, 'success');

      return setId;
    } catch (err) {
      showToast(`文件读取失败: ${err.message}`, 'error');
      return null;
    }
  }

  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('无法读取文件'));
      reader.readAsText(file);
    });
  }

  _showValidationErrors(errors) {
    const maxShow = 5;
    const display = errors.slice(0, maxShow);
    let msg = `题库验证失败（${errors.length} 个错误）:\n` + display.map(e => `  - ${e}`).join('\n');
    if (errors.length > maxShow) {
      msg += `\n  ... 还有 ${errors.length - maxShow} 个错误`;
    }
    const modal = document.getElementById('quizErrorModal');
    const body = document.getElementById('quizErrorBody');
    if (modal && body) {
      body.textContent = msg;
      modal.style.display = 'flex';
      // Wire close button
      const closeBtn = document.getElementById('quizErrorClose');
      if (closeBtn) {
        closeBtn.onclick = () => { modal.style.display = 'none'; };
      }
      // Close on overlay click
      modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    } else {
      showToast(msg, 'error', 5000);
    }
  }

  _generateSetId(fileName) {
    const base = fileName.replace(/\.\w+$/, '').replace(/[^a-zA-Z0-9一-鿿_-]/g, '_');
    let id = base;
    let counter = 1;
    while (this.questionSets[id]) {
      id = `${base}_${counter++}`;
    }
    return id;
  }

  // ---------------------------------------------------------------------------
  // Quiz Session
  // ---------------------------------------------------------------------------
  startQuiz(setId, mode) {
    const set = this.questionSets[setId];
    if (!set) {
      showToast('题库不存在', 'error');
      return;
    }

    this.currentSetId = setId;
    this.currentMode = mode;
    this.questions = [...set.questions];  // shallow copy — quiz modes may reorder
    this.currentIndex = 0;
    this.currentQuestion = null;
    this.answers = [];
    this.startTime = Date.now();
    this.isSessionActive = true;
    this._optionsDelegated = false;
    this._roundQuestionsAnswered = 0;
    this._roundQuestionsTotal = this.questions.length;
    this._currentNavIndex = 0;

    // Initialize sub-mode
    const progressData = this._getProgressData();

    if (mode === 'weighted-random') {
      const settings = this.state ? this.state.settings : {};
      if (!this.modes['weighted-random']) {
        this.modes['weighted-random'] = new WeightedRandom(settings);
      }
      this.modes['weighted-random'].initRound(this.questions, progressData);
      this._roundQuestionsTotal = this.modes['weighted-random'].getEligibleCount();
    } else if (mode === 'error-book') {
      const errorQuestions = this.modes['error-book'].getErrorQuestions(this.questions, progressData);
      if (errorQuestions.length === 0) {
        showToast('错题库中没有需要复习的题目', 'info');
        this.isSessionActive = false;
        return;
      }
      this.questions = errorQuestions;
      this._roundQuestionsTotal = this.questions.length;
    }

    // Set initial current question
    if (mode === 'weighted-random') {
      this.currentQuestion = this.modes['weighted-random'].getNextQuestion(this.questions, progressData);
    } else if (mode === 'sequential' || mode === 'error-book') {
      this.currentQuestion = this.questions[0];
    }

    // Navigate to session page
    if (window.__lt && window.__lt.router) {
      window.__lt.router.navigate('quiz-session');
    }

    this._startTimer();
  }

  submitAnswer(selectedOption) {
    if (!this.isSessionActive) return null;

    const question = this.currentQuestion || this._getCurrentQuestionObj();
    if (!question) return null;

    const isCorrect = (selectedOption === question.answer);
    const now = Date.now();
    const timeSpent = (now - (this._lastQuestionTime || this.startTime)) / 1000;

    this.answers.push({
      questionId: question.id,
      selectedOption,
      correctOption: question.answer,
      isCorrect,
      skipped: false,
      timeSpent,
      timestamp: now,
      _navIndex: this._currentNavIndex,
      _question: question,
      explanation: question.explanation || ''
    });

    // Update progress for all modes
    const progressData = this._getProgressData();
    const qProgress = progressData[question.id] || this._initQuestionProgress();

    // Ensure qProgress is attached to progressData (for first-time questions)
    if (!progressData[question.id]) {
      progressData[question.id] = qProgress;
    }

    if (this.currentMode === 'weighted-random') {
      this.modes['weighted-random'].updateAfterAnswer(question.id, isCorrect, progressData);
    } else {
      // Sequential and error-book: basic progress tracking
      qProgress.totalAttempts = (qProgress.totalAttempts || 0) + 1;
      if (isCorrect) {
        qProgress.streak = (qProgress.streak || 0) + 1;
      } else {
        qProgress.wrongCount = (qProgress.wrongCount || 0) + 1;
        qProgress.streak = 0;
      }
      qProgress.lastSeenAt = now;
      // Update EMA
      const result = isCorrect ? 1 : 0;
      const emaAlpha = 0.4;
      const prevEma = qProgress.ema !== undefined ? qProgress.ema : 0.5;
      qProgress.ema = emaAlpha * result + (1 - emaAlpha) * prevEma;
    }

    if (this.currentMode === 'error-book') {
      const settings = this.state ? this.state.settings : {};
      this.modes['error-book'].checkAutoRemove(question.id, progressData, settings);
    }

    this._roundQuestionsAnswered++;

    // Save progress
    this._saveProgressData(progressData);

    this._lastQuestionTime = now;

    return { isCorrect, correctOption: question.answer, explanation: question.explanation || '' };
  }

  /**
   * Advance to the next question.
   * @returns {Object|null} the next question object, or null if the session is over
   */
  getNextQuestion() {
    if (!this.isSessionActive) return null;

    if (this.currentMode === 'sequential') {
      this.currentIndex++;
      if (this.currentIndex >= this.questions.length) {
        this._endQuiz();
        return null;
      }
      this.currentQuestion = this.questions[this.currentIndex];
      return this.currentQuestion;
    }

    if (this.currentMode === 'weighted-random') {
      const progressData = this._getProgressData();
      if (this.modes['weighted-random'].isRoundComplete()) {
        this.modes['weighted-random'].initRound(this.questions, progressData);
        this._roundQuestionsTotal = this.modes['weighted-random'].getEligibleCount();
      }
      const next = this.modes['weighted-random'].getNextQuestion(this.questions, progressData);
      if (!next) {
        this._endQuiz();
        return null;
      }
      this.currentQuestion = next;
      return next;
    }

    if (this.currentMode === 'error-book') {
      this.currentIndex++;
      if (this.currentIndex >= this.questions.length) {
        this._endQuiz();
        return null;
      }
      this.currentQuestion = this.questions[this.currentIndex];
      return this.currentQuestion;
    }

    return null;
  }

  getResults() {
    const total = this.answers.length;
    const correct = this.answers.filter(a => a.isCorrect).length;
    const skipped = this.answers.filter(a => a.skipped).length;
    const wrong = total - correct - skipped;
    const attempted = total - skipped;
    const totalTime = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const avgTime = attempted > 0 ? totalTime / attempted : 0;

    const questionResults = this.answers.map(a => {
      const q = this.questions.find(q => q.id === a.questionId) || this._findInAllSets(a.questionId);
      return {
        questionId: a.questionId,
        question: q ? q.question : '(unknown)',
        selectedOption: a.selectedOption,
        correctOption: a.correctOption,
        isCorrect: a.isCorrect,
        skipped: a.skipped || false,
        explanation: a.explanation || (q ? q.explanation || '' : ''),
        timeSpent: a.timeSpent
      };
    });

    return {
      setId: this.currentSetId,
      mode: this.currentMode,
      totalQuestions: total,
      correctCount: correct,
      wrongCount: wrong,
      skippedCount: skipped,
      accuracy: attempted > 0 ? (correct / attempted * 100).toFixed(1) : '0.0',
      totalTime,
      avgTime: avgTime.toFixed(1),
      questionResults
    };
  }

  // ---------------------------------------------------------------------------
  // Session Rendering
  // ---------------------------------------------------------------------------
  _bindSessionEvents() {
    // Event delegation for options
    const optionsList = document.getElementById('quizOptionsList');
    if (optionsList && !this._optionsDelegated) {
      this._optionsDelegated = true;
      optionsList.addEventListener('click', (e) => {
        const btn = e.target.closest('.quiz-option');
        if (!btn || btn.disabled) return;
        this._handleAnswer(parseInt(btn.dataset.option, 10));
      });
    }
    // Keyboard 1-4
    if (!this._keyHandler) {
      this._keyHandler = (e) => {
        if (!this.isSessionActive) return;
        var k = parseInt(e.key, 10);
        if (k >= 1 && k <= 4) this._handleAnswer(k - 1);
      };
      document.addEventListener('keydown', this._keyHandler);
    }
    // Navigation
    document.getElementById('quizPrevBtn')?.addEventListener('click', () => this._navigateTo(this._currentNavIndex - 1));
    document.getElementById('quizNextBtn')?.addEventListener('click', () => this._goNext());
    document.getElementById('quizJumpBtn')?.addEventListener('click', () => {
      var n = parseInt(document.getElementById('quizJumpInput')?.value) - 1;
      if (!isNaN(n)) this._navigateTo(n);
    });
    document.getElementById('quizJumpInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('quizJumpBtn')?.click();
    });
    // Skip
    document.getElementById('quizSkipBtn')?.addEventListener('click', () => this._skipCurrent());
    // Redo
    document.getElementById('quizRedoBtn')?.addEventListener('click', () => {
      if (confirm('Restart this quiz? All current session answers will be lost.')) this._redoQuiz();
    });
    // Reset data
    document.getElementById('quizResetBtn')?.addEventListener('click', () => {
      if (confirm('Delete ALL progress data for this question set? This cannot be undone.')) this._resetData();
    });
  }

  _goNext() {
    if (!this._answerSubmitted && this._currentNavIndex >= this._roundQuestionsAnswered) {
      showToast('请先回答当前题目或点击跳过', 'warning');
      return;
    }
    var next = this._currentNavIndex + 1;
    if (next >= this._getTotalQuestions()) {
      this._renderResults();
      return;
    }
    this._navigateTo(next);
  }

  _navigateTo(index) {
    var total = this._getTotalQuestions();
    if (index < 0 || index >= total) return;
    this._currentNavIndex = index;

    // Hide result area, reset answer state
    var resultArea = document.getElementById('quizResultArea');
    var reviewBanner = document.getElementById('quizReviewBanner');
    var skipArea = document.getElementById('quizSkipArea');
    if (resultArea) resultArea.style.display = 'none';
    if (reviewBanner) reviewBanner.style.display = 'none';
    document.querySelectorAll('.quiz-option').forEach(b => {
      b.classList.remove('correct', 'incorrect', 'selected');
      b.disabled = false;
    });

    // Check if already answered
    var existing = this.answers.find(a => a._navIndex === index);
    if (existing) {
      // Show previous answer (read-only)
      this._answerSubmitted = true;
      this._renderQuestionAtIndex(index);
      if (reviewBanner) {
        reviewBanner.style.display = 'block';
        if (existing.skipped) {
          reviewBanner.style.background = 'var(--color-bg-elevated)';
          reviewBanner.style.color = 'var(--color-text-tertiary)';
          reviewBanner.textContent = 'Skipped';
        } else {
          reviewBanner.style.background = existing.isCorrect ? 'var(--color-success-bg)' : 'var(--color-error-bg)';
          reviewBanner.style.color = existing.isCorrect ? 'var(--color-success)' : 'var(--color-error)';
          reviewBanner.textContent = existing.isCorrect ? 'You got this correct' : 'You got this incorrect — correct answer: ' + String.fromCharCode(65 + existing.correctOption);
        }
      }
      // Show the selected/correct highlights
      document.querySelectorAll('.quiz-option').forEach(b => {
        var oi = parseInt(b.dataset.option, 10);
        b.disabled = true;
        if (oi === existing.correctOption) b.classList.add('correct');
        if (oi === existing.selectedOption && !existing.isCorrect && !existing.skipped) b.classList.add('incorrect');
        if (oi === existing.selectedOption && existing.isCorrect) b.classList.add('correct');
      });
      if (existing.explanation) {
        var explDiv = document.getElementById('quizExplanation');
        var explText = document.getElementById('quizExplanationText');
        if (explDiv && explText) { explText.textContent = existing.explanation; explDiv.style.display = 'block'; }
      }
    } else {
      // New question
      this._answerSubmitted = false;
      this._renderQuestionAtIndex(index);
      if (skipArea) skipArea.style.display = '';
    }

    // Update jump input
    var jumpInput = document.getElementById('quizJumpInput');
    if (jumpInput) { jumpInput.value = index + 1; jumpInput.max = total; }

    // Update progress
    var progressFill = document.getElementById('quizSessionProgress');
    var counterEl = document.getElementById('quizSessionCounter');
    if (progressFill) progressFill.style.width = ((index + 1) / total * 100).toFixed(0) + '%';
    if (counterEl) counterEl.textContent = 'Q ' + (index + 1) + '/' + total;
  }

  _renderQuestionAtIndex(index) {
    var total = this._getTotalQuestions();
    if (index < 0 || index >= total) return;
    this.currentIndex = index;

    // For sequential/errorbook, get question directly
    var q;
    if (this.currentMode === 'weighted-random') {
      // For weighted-random that uses sampling, we need the question from the answers record
      var existing = this.answers.find(a => a._navIndex === index);
      if (existing && existing._question) {
        q = existing._question;
      } else {
        q = this.questions[index] || this.currentQuestion;
      }
    } else {
      q = this.questions[index];
    }
    if (!q) return;
    this.currentQuestion = q;

    var questionEl = document.getElementById('quizQuestionText');
    var optionsContainer = document.getElementById('quizOptionsList');
    if (questionEl) questionEl.textContent = 'Q' + (index + 1) + '. ' + q.question;
    if (optionsContainer && q.options) {
      var labels = ['A', 'B', 'C', 'D'];
      optionsContainer.innerHTML = q.options.map((opt, i) =>
        '<button class="quiz-option" data-option="' + i + '"><span class="quiz-option-marker">' + labels[i] + '</span><span>' + this._escapeHtml(opt) + '</span></button>'
      ).join('');
    }
  }

  _skipCurrent() {
    if (this._answerSubmitted) return;
    var q = this.currentQuestion || this._getCurrentQuestionObj();
    if (!q) return;
    var idx = this._currentNavIndex;
    // Record as skipped
    this.answers.push({
      questionId: q.id,
      selectedOption: -1,
      correctOption: q.answer,
      isCorrect: false,
      skipped: true,
      timeSpent: 0,
      timestamp: Date.now(),
      _navIndex: idx,
      _question: q,
      explanation: q.explanation || ''
    });
    this._roundQuestionsAnswered++;
    // Move to next
    var next = idx + 1;
    if (next >= this._getTotalQuestions()) {
      this._renderResults();
    } else {
      this._navigateTo(next);
    }
  }

  _redoQuiz() {
    this.answers = [];
    this._roundQuestionsAnswered = 0;
    this._currentNavIndex = 0;
    this.currentIndex = 0;
    this.currentQuestion = null;
    this._answerSubmitted = false;
    this.isSessionActive = true;
    var progressData = this._getProgressData();
    if (this.currentMode === 'weighted-random') {
      this.modes['weighted-random'].reset();
      this.modes['weighted-random'].initRound(this.questions, progressData);
      this._roundQuestionsTotal = this.modes['weighted-random'].getEligibleCount();
      this.currentQuestion = this.modes['weighted-random'].getNextQuestion(this.questions, progressData);
    } else if (this.currentMode === 'error-book') {
      this.currentQuestion = this.questions[0];
    } else {
      this.currentQuestion = this.questions[0];
    }
    document.getElementById('quizResultArea') && (document.getElementById('quizResultArea').style.display = 'none');
    document.getElementById('quizReviewBanner') && (document.getElementById('quizReviewBanner').style.display = 'none');
    document.getElementById('quizSessionStats') && (document.getElementById('quizSessionStats').style.display = 'none');
    document.getElementById('quizSessionEndMsg') && (document.getElementById('quizSessionEndMsg').style.display = 'none');
    this._renderCurrentQuestion();
  }

  _resetData() {
    if (this.state && this.state.quizProgress && this.currentSetId) {
      delete this.state.quizProgress[this.currentSetId];
      this.state.saveToStorage();
    }
    showToast('Progress data reset', 'info');
    this._redoQuiz();
  }

  async _handleAnswer(optionIndex) {
    if (this._answerSubmitted) return;
    this._answerSubmitted = true;
    document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);

    var result = this.submitAnswer(optionIndex);
    var options = document.querySelectorAll('.quiz-option');
    options.forEach(btn => {
      var idx = parseInt(btn.dataset.option, 10);
      if (idx === result.correctOption) btn.classList.add('correct');
      if (idx === optionIndex && !result.isCorrect) btn.classList.add('incorrect');
    });

    var resultArea = document.getElementById('quizResultArea');
    var resultCorrect = document.getElementById('quizResultCorrect');
    var resultIncorrect = document.getElementById('quizResultIncorrect');
    var correctAnswerLabel = document.getElementById('quizCorrectAnswerLabel');
    var explanationEl = document.getElementById('quizExplanationText');
    var explanationDiv = document.getElementById('quizExplanation');
    var skipArea = document.getElementById('quizSkipArea');

    if (resultArea) resultArea.style.display = 'block';
    if (skipArea) skipArea.style.display = 'none';
    if (resultCorrect) resultCorrect.style.display = result.isCorrect ? 'block' : 'none';
    if (resultIncorrect) {
      resultIncorrect.style.display = result.isCorrect ? 'none' : 'block';
      if (!result.isCorrect && correctAnswerLabel) correctAnswerLabel.textContent = 'Correct answer: ' + String.fromCharCode(65 + result.correctOption);
    }
    if (explanationEl && explanationDiv) {
      explanationEl.textContent = result.explanation || '(no explanation)';
      explanationDiv.style.display = 'block';
    }

    // Auto-advance after 1.5s
    setTimeout(() => {
      if (resultArea) resultArea.style.display = 'none';
      if (resultCorrect) resultCorrect.style.display = 'none';
      if (resultIncorrect) resultIncorrect.style.display = 'none';
      if (explanationDiv) explanationDiv.style.display = 'none';
      this._answerSubmitted = false;
      document.querySelectorAll('.quiz-option').forEach(b => {
        b.classList.remove('correct', 'incorrect');
        b.disabled = false;
      });
      if (skipArea) skipArea.style.display = '';
      this._currentNavIndex++;
      var nextQ = this.getNextQuestion();
      if (nextQ) {
        this._renderCurrentQuestion();
      } else {
        this._renderResults();
      }
    }, 1500);
  }

  _renderCurrentQuestion() {
    var q = this._getCurrentQuestionObj();
    if (!q) { this._renderResults(); return; }
    this.currentQuestion = q;

    var idx = this._currentNavIndex;
    var total = this._getTotalQuestions();
    var questionEl = document.getElementById('quizQuestionText');
    var optionsContainer = document.getElementById('quizOptionsList');
    var progressFill = document.getElementById('quizSessionProgress');
    var counterEl = document.getElementById('quizSessionCounter');
    var modeEl = document.getElementById('quizSessionMode');
    var skipArea = document.getElementById('quizSkipArea');
    var reviewBanner = document.getElementById('quizReviewBanner');

    if (questionEl) questionEl.textContent = 'Q' + (idx + 1) + '. ' + q.question;
    if (optionsContainer && q.options) {
      var labels = ['A', 'B', 'C', 'D'];
      optionsContainer.innerHTML = q.options.map((opt, i) =>
        '<button class="quiz-option" data-option="' + i + '"><span class="quiz-option-marker">' + labels[i] + '</span><span>' + this._escapeHtml(opt) + '</span></button>'
      ).join('');
    }
    if (progressFill) progressFill.style.width = total > 0 ? ((idx + 1) / total * 100).toFixed(0) + '%' : '0%';
    if (counterEl) counterEl.textContent = 'Q ' + (idx + 1) + '/' + total;
    if (modeEl) {
      var modeNames = { 'sequential': 'Sequential', 'weighted-random': 'Weighted', 'error-book': 'Error Book' };
      modeEl.textContent = modeNames[this.currentMode] || this.currentMode;
    }
    if (skipArea) skipArea.style.display = '';
    if (reviewBanner) reviewBanner.style.display = 'none';
    if (document.getElementById('quizResultArea')) document.getElementById('quizResultArea').style.display = 'none';

    // Update jump input
    var jumpInput = document.getElementById('quizJumpInput');
    if (jumpInput) { jumpInput.value = idx + 1; jumpInput.max = total; }
  }

  _renderResults() {
    this._stopTimer();
    this.isSessionActive = false;

    // Remove keyboard listener
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }

    const results = this.getResults();

    // Hide question area, result area, skip, review banner
    var questionArea = document.getElementById('quizQuestionArea');
    var resultArea = document.getElementById('quizResultArea');
    var skipArea = document.getElementById('quizSkipArea');
    var reviewBanner = document.getElementById('quizReviewBanner');
    if (questionArea) questionArea.style.display = 'none';
    if (resultArea) resultArea.style.display = 'none';
    if (skipArea) skipArea.style.display = 'none';
    if (reviewBanner) reviewBanner.style.display = 'none';

    // Show stats
    const statsDiv = document.getElementById('quizSessionStats');
    const statCorrect = document.getElementById('quizStatCorrect');
    const statIncorrect = document.getElementById('quizStatIncorrect');
    const statAccuracy = document.getElementById('quizStatAccuracy');

    if (statsDiv) statsDiv.style.display = 'block';
    if (statCorrect) statCorrect.textContent = results.correctCount;
    if (statIncorrect) statIncorrect.textContent = results.wrongCount;
    var statSkipped = document.getElementById('quizStatSkipped');
    if (statSkipped) statSkipped.textContent = results.skippedCount || 0;
    if (statAccuracy) statAccuracy.textContent = results.accuracy + '%';

    // Show end message
    const endMsg = document.getElementById('quizSessionEndMsg');
    if (endMsg) endMsg.style.display = 'block';

    // Auto-redirect after 5 seconds (only if still on quiz-session page)
    const setId = this.currentSetId;
    setTimeout(() => {
      if (this.currentSetId !== setId) return; // Session was replaced or user navigated away
      this._endQuiz();
      if (window.__lt && window.__lt.router) {
        window.__lt.router.navigate('quiz');
      }
    }, 5000);
  }

  // ---------------------------------------------------------------------------
  // Progress Data
  // ---------------------------------------------------------------------------
  _getProgressData() {
    if (this.state && this.state.quizProgress) {
      return this.state.quizProgress[this.currentSetId] || {};
    }
    return {};
  }

  _saveProgressData(data) {
    if (this.state && this.state.quizProgress) {
      this.state.quizProgress[this.currentSetId] = data;
      this.state.saveToStorage();
    }
  }

  _initQuestionProgress() {
    return {
      totalAttempts: 0,
      wrongCount: 0,
      streak: 0,
      ema: 0.5,
      lastSeenAt: null
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  _getCurrentQuestionObj() {
    // Use tracked question object when available (set by getNextQuestion / render)
    if (this.currentQuestion) return this.currentQuestion;

    // Fallback for sequential/error-book mode
    if (this.currentIndex >= 0 && this.currentIndex < this.questions.length) {
      return this.questions[this.currentIndex];
    }
    return null;
  }

  _getTotalQuestions() {
    if (this._roundQuestionsTotal > 0) return this._roundQuestionsTotal;
    return this.questions.length;
  }

  _findInAllSets(questionId) {
    for (const setId of Object.keys(this.questionSets)) {
      const found = this.questionSets[setId].questions.find(q => q.id === questionId);
      if (found) return found;
    }
    return null;
  }

  _startTimer() {
    this._stopTimer();
    this._lastQuestionTime = Date.now();
    this.timerInterval = setInterval(() => {
      const timerEl = document.getElementById('quizTimer');
      if (timerEl) this._updateTimerDisplay(timerEl);
    }, 1000);
  }

  _stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  _updateTimerDisplay(el) {
    if (!this.startTime) return;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    el.textContent = this._formatTime(elapsed);
  }

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _endQuiz() {
    this._stopTimer();
    this.isSessionActive = false;
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }

  _escapeHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }
}

// Auto-initialize on import
const quizCore = new QuizCore();
export default quizCore;
