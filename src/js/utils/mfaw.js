/**
 * PaperLens — MFAW (Multi-Factor Adaptive Weight) Algorithm
 *
 * Calculates weight for each quiz question based on four scientific factors:
 *   PF — Performance Factor (EMA of recent answers)
 *   DF — Difficulty Factor (historical error rate)
 *   SF — Stability Factor (consecutive correct streak)
 *   NF — Novelty Factor (time decay since last seen)
 *
 * Weight = α·PF + β·DF + γ·(1−SF) + δ·NF
 */
export class MFAW {
  constructor(options = {}) {
    this.alpha = options.alpha || 0.35;  // Performance weight
    this.beta  = options.beta  || 0.25;  // Difficulty weight
    this.gamma = options.gamma || 0.25;  // Stability weight
    this.delta = options.delta || 0.15;  // Novelty weight
    this.emaAlpha = options.emaAlpha || 0.4;    // EMA smoothing factor
    this.lambda = options.lambda || 0.05;       // Novelty decay rate
    this.minWeight = options.minWeight || 0.05;
    this.maxWeight = options.maxWeight || 15.0;
  }

  /**
   * Calculate weight for a single question.
   * @param {Object} stats — { totalAttempts, wrongCount, streak, ema, lastSeenAt }
   * @param {number} now — current timestamp (ms)
   * @returns {number} weight
   */
  calculateWeight(stats, now = Date.now()) {
    const { totalAttempts = 0, wrongCount = 0, streak = 0, ema = 0.5, lastSeenAt } = stats;

    // PF: Performance Factor (1 - EMA, so wrong answers → higher PF)
    const pf = 1 - ema;

    // DF: Difficulty Factor
    const df = totalAttempts > 0 ? (wrongCount + 1) / (totalAttempts + 2) : 0.5;  // Laplace smoothing

    // SF: Stability Factor (based on consecutive correct streak)
    const sf = Math.min(streak / 3, 1.0);

    // NF: Novelty Factor (time decay)
    let nf = 0.5;
    if (lastSeenAt) {
      const dtMinutes = (now - lastSeenAt) / 60000;
      nf = 1 - Math.exp(-this.lambda * dtMinutes);
    }

    // Composite weight
    let weight = this.alpha * pf + this.beta * df + this.gamma * (1 - sf) + this.delta * nf;

    // Clamp
    return Math.max(this.minWeight, Math.min(this.maxWeight, weight));
  }

  /**
   * Update question stats after an answer.
   * @param {Object} stats — current stats
   * @param {boolean} correct — whether the answer was correct
   * @param {number} now — current timestamp
   * @returns {Object} updated stats
   */
  updateStats(stats, correct, now = Date.now()) {
    const updated = { ...stats };
    updated.totalAttempts = (stats.totalAttempts || 0) + 1;

    if (correct) {
      updated.wrongCount = stats.wrongCount || 0;
      updated.streak = (stats.streak || 0) + 1;
    } else {
      updated.wrongCount = (stats.wrongCount || 0) + 1;
      updated.streak = 0;
    }

    // Update EMA
    const result = correct ? 1 : 0;
    const prevEma = stats.ema !== undefined ? stats.ema : 0.5;
    updated.ema = this.emaAlpha * result + (1 - this.emaAlpha) * prevEma;

    updated.lastSeenAt = now;

    return updated;
  }

  /**
   * Check if a question is "mastered" (can be removed from error book or pool).
   * Criteria: SF ≥ 0.9, PF ≤ 0.2, DF ≤ 0.25
   */
  isMastered(stats) {
    const pf = 1 - (stats.ema || 0.5);
    const df = stats.totalAttempts > 0 ? (stats.wrongCount + 1) / (stats.totalAttempts + 2) : 0.5;
    const sf = Math.min((stats.streak || 0) / 3, 1.0);

    return sf >= 0.9 && pf <= 0.2 && df <= 0.25;
  }
}
