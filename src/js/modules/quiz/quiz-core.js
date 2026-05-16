/**
 * PaperLens — Quiz Core Controller
 * Manages quiz state, orchestrates sub-modes, handles file loading/session lifecycle.
 */
import { Sequential } from './sequential.js';
import { WeightedRandom } from './weighted-random.js';
import { ErrorBook } from './error-book.js';
import { TemplateGen } from './template-gen.js';
import { showToast } from '../../utils/toast.js';

export class QuizCore {
  constructor() {
    this.currentMode = null;
    this.questions = [];
    this.questionSets = {};       // { setId: { name, questions[] } }
    this.currentSetId = null;
    this.currentIndex = 0;
    this.answers = [];
    this.startTime = null;
    this.isSessionActive = false;
    this.timerInterval = null;

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
    const list = document.getElementById('quizSetList');
    const select = document.getElementById('quizSetSelect');
    if (!list && !select) return;

    const ids = Object.keys(this.questionSets);

    if (list) {
      if (ids.length === 0) {
        list.innerHTML = `<div class="empty-hint">暂无题库，请上传题库文件</div>`;
      } else {
        list.innerHTML = ids.map(id => {
          const set = this.questionSets[id];
          return `<div class="quiz-set-item" data-set-id="${id}">
            <span class="quiz-set-name">${this._escapeHtml(set.name)}</span>
            <span class="quiz-set-count">${set.questions.length} 题</span>
          </div>`;
        }).join('');
      }
    }

    if (select) {
      if (ids.length === 0) {
        select.innerHTML = `<option value="">-- 请先加载题库 --</option>`;
      } else {
        select.innerHTML = ids.map(id => {
          const set = this.questionSets[id];
          return `<option value="${id}">${this._escapeHtml(set.name)} (${set.questions.length}题)</option>`;
        }).join('');
      }
    }
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
    this.answers = [];
    this.startTime = Date.now();
    this.isSessionActive = true;

    // Initialize sub-mode
    const progressData = this._getProgressData();

    if (mode === 'weighted-random') {
      const settings = this.state ? this.state.settings : {};
      if (!this.modes['weighted-random']) {
        this.modes['weighted-random'] = new WeightedRandom(settings);
      }
      this.modes['weighted-random'].initRound(this.questions, progressData);
    } else if (mode === 'error-book') {
      const errorQuestions = this.modes['error-book'].getErrorQuestions(this.questions, progressData);
      if (errorQuestions.length === 0) {
        showToast('错题库中没有需要复习的题目', 'info');
        this.isSessionActive = false;
        return;
      }
      this.questions = errorQuestions;
    }
    // sequential mode needs no special init

    // Navigate to session page
    if (window.__lt && window.__lt.router) {
      window.__lt.router.navigate('quiz-session');
    }

    this._startTimer();
  }

  submitAnswer(selectedOption) {
    if (!this.isSessionActive) return null;

    const question = this._getCurrentQuestionObj();
    if (!question) return null;

    const isCorrect = (selectedOption === question.answer);
    const now = Date.now();
    const timeSpent = (now - (this._lastQuestionTime || this.startTime)) / 1000;

    this.answers.push({
      questionId: question.id,
      selectedOption,
      correctOption: question.answer,
      isCorrect,
      timeSpent,
      timestamp: now
    });

    // Update progress for weighted-random and error-book modes
    const progressData = this._getProgressData();
    const qProgress = progressData[question.id] || this._initQuestionProgress();

    if (this.currentMode === 'weighted-random') {
      this.modes['weighted-random'].updateAfterAnswer(question.id, isCorrect, progressData);
    }

    if (this.currentMode === 'error-book') {
      const settings = this.state ? this.state.settings : {};
      this.modes['error-book'].checkAutoRemove(question.id, progressData, settings);
    }

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
      return this.questions[this.currentIndex];
    }

    if (this.currentMode === 'weighted-random') {
      const progressData = this._getProgressData();
      if (this.modes['weighted-random'].isRoundComplete()) {
        this.modes['weighted-random'].initRound(this.questions, progressData);
      }
      const next = this.modes['weighted-random'].getNextQuestion(this.questions, progressData);
      if (!next) {
        this._endQuiz();
        return null;
      }
      return next;
    }

    if (this.currentMode === 'error-book') {
      this.currentIndex++;
      if (this.currentIndex >= this.questions.length) {
        this._endQuiz();
        return null;
      }
      return this.questions[this.currentIndex];
    }

    return null;
  }

  getResults() {
    const total = this.answers.length;
    const correct = this.answers.filter(a => a.isCorrect).length;
    const totalTime = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const avgTime = total > 0 ? totalTime / total : 0;

    // Per-question breakdown
    const questionResults = this.answers.map(a => {
      const q = this.questions.find(q => q.id === a.questionId) || this._findInAllSets(a.questionId);
      return {
        questionId: a.questionId,
        question: q ? q.question : '(未知题目)',
        selectedOption: a.selectedOption,
        correctOption: a.correctOption,
        isCorrect: a.isCorrect,
        explanation: q ? q.explanation || '' : '',
        timeSpent: a.timeSpent
      };
    });

    return {
      setId: this.currentSetId,
      mode: this.currentMode,
      totalQuestions: total,
      correctCount: correct,
      wrongCount: total - correct,
      accuracy: total > 0 ? (correct / total * 100).toFixed(1) : '0.0',
      totalTime,
      avgTime: avgTime.toFixed(1),
      questionResults
    };
  }

  // ---------------------------------------------------------------------------
  // Session Rendering
  // ---------------------------------------------------------------------------
  _bindSessionEvents() {
    const optionBtns = document.querySelectorAll('.quiz-option');
    optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const optionIndex = parseInt(btn.dataset.option, 10);
        this._handleAnswer(optionIndex);
      });
    });

    // Keyboard support (1-4 for options)
    this._keyHandler = (e) => {
      if (!this.isSessionActive) return;
      const key = parseInt(e.key, 10);
      if (key >= 1 && key <= 4) {
        this._handleAnswer(key - 1);
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  async _handleAnswer(optionIndex) {
    if (this._answerSubmitted) return;
    this._answerSubmitted = true;

    // Disable options
    document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);

    const result = this.submitAnswer(optionIndex);

    // Highlight correct/incorrect
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(btn => {
      const idx = parseInt(btn.dataset.option, 10);
      if (idx === result.correctOption) btn.classList.add('correct');
      if (idx === optionIndex && !result.isCorrect) btn.classList.add('incorrect');
    });

    // Show result feedback
    const resultArea = document.getElementById('quizResultArea');
    const resultCorrect = document.getElementById('quizResultCorrect');
    const resultIncorrect = document.getElementById('quizResultIncorrect');
    const correctAnswerLabel = document.getElementById('quizCorrectAnswerLabel');
    const explanationEl = document.getElementById('quizExplanationText');
    const explanationDiv = document.getElementById('quizExplanation');

    if (resultArea) resultArea.style.display = 'block';
    if (resultCorrect) resultCorrect.style.display = result.isCorrect ? 'block' : 'none';
    if (resultIncorrect) {
      resultIncorrect.style.display = result.isCorrect ? 'none' : 'block';
      if (!result.isCorrect && correctAnswerLabel) {
        correctAnswerLabel.textContent = '正确答案: ' + String.fromCharCode(65 + result.correctOption);
      }
    }
    if (explanationEl && explanationDiv) {
      explanationEl.textContent = result.explanation || '（无解析）';
      explanationDiv.style.display = 'block';
    }

    // Show next button
    const nextBtn = document.getElementById('quizNextBtn');
    if (nextBtn) {
      nextBtn.style.display = 'inline-flex';
      nextBtn.disabled = false;
      nextBtn.onclick = () => {
        // Hide result area
        if (resultArea) resultArea.style.display = 'none';
        if (resultCorrect) resultCorrect.style.display = 'none';
        if (resultIncorrect) resultIncorrect.style.display = 'none';
        if (explanationDiv) explanationDiv.style.display = 'none';
        if (nextBtn) { nextBtn.style.display = 'none'; nextBtn.disabled = true; }

        this._answerSubmitted = false;
        document.querySelectorAll('.quiz-option').forEach(b => {
          b.classList.remove('correct', 'incorrect');
          b.disabled = false;
        });

        const next = this.getNextQuestion();
        if (next) {
          this._renderCurrentQuestion();
        } else {
          this._renderResults();
        }
      };
    }
  }

  _renderCurrentQuestion() {
    const q = this._getCurrentQuestionObj();
    if (!q) {
      this._renderResults();
      return;
    }

    const questionEl = document.getElementById('quizQuestionText');
    const optionsContainer = document.getElementById('quizOptionsList');
    const progressFill = document.getElementById('quizSessionProgress');
    const counterEl = document.getElementById('quizSessionCounter');
    const modeEl = document.getElementById('quizSessionMode');

    if (questionEl) {
      questionEl.textContent = `Q${this.currentIndex + 1}. ${q.question}`;
    }

    if (optionsContainer && q.options) {
      const labels = ['A', 'B', 'C', 'D'];
      optionsContainer.innerHTML = q.options.map((opt, i) => `
        <button class="quiz-option" data-option="${i}">
          <span class="quiz-option-marker">${labels[i]}</span>
          <span>${this._escapeHtml(opt)}</span>
        </button>
      `).join('');
    }

    const total = this._getTotalQuestions();
    if (progressFill) {
      const percent = ((this.currentIndex + 1) / total * 100).toFixed(0);
      progressFill.style.width = percent + '%';
    }
    if (counterEl) {
      counterEl.textContent = `第 ${this.currentIndex + 1}/${total} 题`;
    }
    if (modeEl) {
      const modeNames = { 'sequential': '顺序刷题', 'weighted-random': '加权乱序', 'error-book': '错题本' };
      modeEl.textContent = modeNames[this.currentMode] || this.currentMode;
    }
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

    // Hide question area and result area
    const questionArea = document.getElementById('quizQuestionArea');
    const resultArea = document.getElementById('quizResultArea');
    const nextBtn = document.getElementById('quizNextBtn');
    if (questionArea) questionArea.style.display = 'none';
    if (resultArea) resultArea.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';

    // Show stats
    const statsDiv = document.getElementById('quizSessionStats');
    const statCorrect = document.getElementById('quizStatCorrect');
    const statIncorrect = document.getElementById('quizStatIncorrect');
    const statAccuracy = document.getElementById('quizStatAccuracy');

    if (statsDiv) statsDiv.style.display = 'block';
    if (statCorrect) statCorrect.textContent = results.correctCount;
    if (statIncorrect) statIncorrect.textContent = results.wrongCount;
    if (statAccuracy) statAccuracy.textContent = results.accuracy + '%';

    // Show end message
    const endMsg = document.getElementById('quizSessionEndMsg');
    if (endMsg) endMsg.style.display = 'block';

    // Auto-redirect after 5 seconds
    setTimeout(() => {
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
    if (this.currentMode === 'weighted-random') {
      // In weighted-random, the questions array IS the round pool
      // getNextQuestion already returns the question, but here we just return
      // whatever weighted-random's internal tracking points to
      // For simplicity, fallback: the object directly from the pool
      if (this.currentIndex < this.questions.length) {
        return this.questions[this.currentIndex];
      }
      return null;
    }
    if (this.currentIndex >= 0 && this.currentIndex < this.questions.length) {
      return this.questions[this.currentIndex];
    }
    return null;
  }

  _getTotalQuestions() {
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
