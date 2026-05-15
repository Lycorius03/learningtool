/**
 * PaperLens — Error Book Quiz Mode
 * Shows only questions that the user has previously answered incorrectly.
 * Automatically removes questions that meet mastery criteria.
 */
import { MFAW } from '../../utils/mfaw.js';

export class ErrorBook {
  constructor() {
    this.mfaw = new MFAW();
    this.removedInSession = new Set();   // IDs removed during current session
  }

  /**
   * Filter questions to only those that need review.
   * A question is eligible if wrongCount > 0 AND it is not mastered.
   *
   * @param {Array} questions — full question array
   * @param {Object} progressData — { [questionId]: { totalAttempts, wrongCount, streak, ema, lastSeenAt } }
   * @returns {Array} filtered array of question objects that need review
   */
  getErrorQuestions(questions, progressData) {
    if (!questions || questions.length === 0) return [];
    if (!progressData || Object.keys(progressData).length === 0) return [];

    const errorQuestions = [];

    for (const q of questions) {
      const stats = progressData[q.id];
      if (!stats) continue;

      // Must have at least one wrong answer
      if ((stats.wrongCount || 0) === 0) continue;

      // Must not be mastered
      if (this.mfaw.isMastered(stats)) continue;

      // Must not have been removed in this session
      if (this.removedInSession.has(q.id)) continue;

      errorQuestions.push(q);
    }

    return errorQuestions;
  }

  /**
   * Check if a question meets criteria for automatic removal from the error book.
   * If the question is mastered, it is removed from tracking.
   *
   * @param {string} questionId — the question ID
   * @param {Object} progressData — mutable progress data object
   * @param {Object} settings — app settings (e.g., { autoRemoveErrorBook: true })
   * @returns {{ removed: boolean, reason: string }}
   */
  checkAutoRemove(questionId, progressData, settings = {}) {
    const stats = progressData[questionId];
    if (!stats) {
      return { removed: false, reason: 'no_stats' };
    }

    const autoRemove = settings.autoRemoveErrorBook !== false; // default true
    if (!autoRemove) {
      return { removed: false, reason: 'auto_remove_disabled' };
    }

    const isMastered = this.mfaw.isMastered(stats);

    if (isMastered) {
      this.removedInSession.add(questionId);
      return { removed: true, reason: 'mastered' };
    }

    // Also remove if user has gotten it right 3+ consecutive times
    if ((stats.streak || 0) >= 3) {
      this.removedInSession.add(questionId);
      return { removed: true, reason: 'streak_3' };
    }

    return { removed: false, reason: 'not_yet' };
  }

  /**
   * Get the count of questions currently in the error book.
   * @param {Array} questions — full question array
   * @param {Object} progressData — progress data map
   * @returns {number}
   */
  getErrorCount(questions, progressData) {
    const errors = this.getErrorQuestions(questions, progressData);
    return errors.length;
  }

  /**
   * Clear all session tracking. Call when starting a new error book session.
   */
  resetSession() {
    this.removedInSession.clear();
  }

  /**
   * Check if a specific question is in the error book.
   * @param {string} questionId
   * @param {Object} progressData
   * @returns {boolean}
   */
  isInErrorBook(questionId, progressData) {
    if (this.removedInSession.has(questionId)) return false;
    const stats = progressData[questionId];
    if (!stats) return false;
    if ((stats.wrongCount || 0) === 0) return false;
    if (this.mfaw.isMastered(stats)) return false;
    return true;
  }

  /**
   * Get the MFAW instance for external use.
   */
  getMfaw() {
    return this.mfaw;
  }
}
