/**
 * PaperLens — Weighted Random Quiz Mode
 * Uses MFAW algorithm + AliasMethod for intelligent weighted sampling.
 * Questions are selected based on their need for review.
 */
import { MFAW } from '../../utils/mfaw.js';
import { AliasMethod } from '../../utils/alias-method.js';

export class WeightedRandom {
  constructor(settings = {}) {
    // Support both nested mfawParams (from settings page) and flat keys
    const mp = settings.mfawParams || settings;
    this.mfaw = new MFAW({
      alpha: mp.alpha ?? mp.mfawAlpha ?? 0.35,
      beta: mp.beta ?? mp.mfawBeta ?? 0.25,
      gamma: mp.gamma ?? mp.mfawGamma ?? 0.25,
      delta: mp.delta ?? mp.mfawDelta ?? 0.15,
      emaAlpha: mp.emaAlpha ?? mp.mfawEmaAlpha ?? 0.4,
      lambda: mp.lambda ?? mp.mfawLambda ?? 0.05,
      minWeight: mp.minWeight ?? mp.mfawMinWeight ?? 0.05,
      maxWeight: mp.maxWeight ?? mp.mfawMaxWeight ?? 15.0
    });

    this.aliasMethod = null;       // AliasMethod instance for current round
    this.roundPool = [];           // Array of question indices eligible this round
    this._poolWeights = [];        // Parallel weights for roundPool entries
    this._seenInRound = new Set(); // Question IDs already seen in current round
    this._questionLookup = null;   // Reference to questions array for indexing
    this.questionsPerRound = settings.questionsPerRound || 20;
    this.roundStartTime = null;
  }

  /**
   * Initialize a new sampling round.
   * Builds the AliasMethod table from current MFAW weights.
   * @param {Array} questions — full question array
   * @param {Object} progressData — { [questionId]: { totalAttempts, wrongCount, streak, ema, lastSeenAt } }
   */
  initRound(questions, progressData) {
    this._questionLookup = questions;
    this._seenInRound.clear();
    this.roundPool = [];
    this._roundServed = 0;
    this.roundStartTime = Date.now();

    const eligibleQuestions = [];
    const weights = [];
    const now = Date.now();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const stats = progressData[q.id];

      // Eligibility: question must have been answered at least once AND not mastered
      if (!stats || (stats.totalAttempts || 0) === 0) continue;
      if (this.mfaw.isMastered(stats)) continue;

      const weight = this.mfaw.calculateWeight(stats, now);
      eligibleQuestions.push(i);
      weights.push(weight);
    }

    if (eligibleQuestions.length === 0) {
      // No eligible questions — create a dummy pool with all unanswered questions
      // weighted equally so the user can at least take the quiz
      for (let i = 0; i < questions.length; i++) {
        const stats = progressData[questions[i].id];
        if (!stats || (stats.totalAttempts || 0) === 0) {
          eligibleQuestions.push(i);
          weights.push(1.0);
        }
      }
    }

    // Limit pool size to questionsPerRound for meaningful rounds
    if (eligibleQuestions.length > this.questionsPerRound) {
      // Select top N by weight (descending) so highest-need questions are included
      const indexed = eligibleQuestions.map((qi, i) => ({ qi, w: weights[i], i }));
      indexed.sort((a, b) => b.w - a.w);
      const selected = indexed.slice(0, this.questionsPerRound);
      this.roundPool = selected.map(x => x.qi);
      this._poolWeights = selected.map(x => x.w);
    } else {
      this.roundPool = eligibleQuestions;
      this._poolWeights = weights;
    }

    if (this.roundPool.length > 0) {
      this.aliasMethod = new AliasMethod(this._poolWeights);
    } else {
      this.aliasMethod = null;
    }
  }

  /**
   * Get the next question via AliasMethod sampling.
   * Ensures no repeats within the current round.
   * @param {Array} questions — full question array
   * @param {Object} progressData — progress data map
   * @returns {Object|null} the next question object, or null if round is complete
   */
  getNextQuestion(questions, progressData) {
    if (this.isRoundComplete()) return null;

    // Sample until we get an unseen question (or exhaust the pool)
    let attempts = 0;
    const maxAttempts = this.roundPool.length * 3; // safety limit

    while (attempts < maxAttempts) {
      if (this.roundPool.length === 0) return null;

      const poolIndex = this.aliasMethod.sample();
      const questionIndex = this.roundPool[poolIndex];
      const question = questions[questionIndex];

      if (!this._seenInRound.has(question.id)) {
        this._seenInRound.add(question.id);
        this._roundServed++;

        // Remove from pool to prevent re-sampling
        this._removeFromPool(poolIndex);

        return question;
      }

      attempts++;
    }

    // If we've exhausted all unique questions in the pool, round is complete
    return null;
  }

  /**
   * Update MFAW statistics after a question is answered.
   * @param {string} questionId — the question that was answered
   * @param {boolean} correct — whether the answer was correct
   * @param {Object} progressData — mutable progress data object
   * @returns {Object} updated stats for the question
   */
  updateAfterAnswer(questionId, correct, progressData) {
    const now = Date.now();
    const stats = progressData[questionId] || {
      totalAttempts: 0,
      wrongCount: 0,
      streak: 0,
      ema: 0.5,
      lastSeenAt: null
    };

    const updated = this.mfaw.updateStats(stats, correct, now);
    progressData[questionId] = updated;
    return updated;
  }

  /**
   * Check if the current round is complete (all eligible questions seen).
   * @returns {boolean}
   */
  isRoundComplete() {
    return (this._roundServed >= this.questionsPerRound) ||
           (this.roundPool.length === 0 && this._seenInRound.size > 0);
  }

  /**
   * Get progress for the current round.
   * @param {number} answered — questions answered so far
   * @param {number} total — total questions in the set
   * @returns {{ current: number, total: number, percent: number }}
   */
  getProgress(answered, total) {
    const roundTotal = this.roundPool.length + this._seenInRound.size;
    const current = this._seenInRound.size;
    const percent = roundTotal > 0 ? Math.round((current / roundTotal) * 100) : 0;
    return { current, total: roundTotal, percent };
  }

  /**
   * Get the number of eligible questions for the current round.
   */
  getEligibleCount() {
    // Return the actual round size (capped by questionsPerRound)
    return Math.min(this.roundPool.length + this._seenInRound.size, this.questionsPerRound);
  }

  /**
   * Reset all round state.
   */
  reset() {
    this.aliasMethod = null;
    this.roundPool = [];
    this._poolWeights = [];
    this._seenInRound.clear();
    this._roundServed = 0;
    this._questionLookup = null;
    this.roundStartTime = null;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Remove an element from the round pool and rebuild the alias table.
   * O(n) operation but necessary to maintain correct weights after removal.
   */
  _removeFromPool(poolIndex) {
    if (poolIndex < 0 || poolIndex >= this.roundPool.length) return;

    // Remove the question index and its weight from the parallel arrays
    this.roundPool.splice(poolIndex, 1);
    this._poolWeights.splice(poolIndex, 1);

    // Rebuild alias table with remaining weights
    if (this.roundPool.length > 0) {
      this.aliasMethod = new AliasMethod(this._poolWeights);
    } else {
      this.aliasMethod = null;
    }
  }
}
