/**
 * PaperLens — Sequential Quiz Mode
 * Questions appear in array order with no shuffling or weighting.
 */
export class Sequential {
  constructor() {
    this.currentIndex = 0;
    this.totalQuestions = 0;
  }

  /**
   * Get the next question in sequence.
   * @param {Array} questions — full question array
   * @param {number} currentIndex — current position
   * @returns {Object} the next question, or null if at end
   */
  getNextQuestion(questions, currentIndex) {
    if (!questions || questions.length === 0) return null;
    if (currentIndex >= questions.length) return null;
    return questions[currentIndex];
  }

  /**
   * Get progress info.
   * @param {number} current — current question number (1-based)
   * @param {number} total — total questions
   * @returns {{ current: number, total: number, percent: string }}
   */
  getProgress(current, total) {
    const percent = total > 0 ? ((current / total) * 100).toFixed(0) : '0';
    return {
      current,
      total,
      percent
    };
  }

  /**
   * No-op for sequential — no state to reset.
   */
  reset() {
    this.currentIndex = 0;
    this.totalQuestions = 0;
  }
}
