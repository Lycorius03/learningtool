/**
 * PaperLens — Alias Method for O(1) weighted random sampling.
 * Build time: O(n). Sample time: O(1).
 */
export class AliasMethod {
  constructor(weights) {
    this.n = weights.length;
    this.prob = new Array(this.n);
    this.alias = new Array(this.n);
    this._build(weights);
  }

  _build(weights) {
    const n = this.n;
    const total = weights.reduce((a, b) => a + b, 0);
    const scaled = weights.map(w => (w / total) * n);

    const small = [];
    const large = [];

    for (let i = 0; i < n; i++) {
      if (scaled[i] < 1) small.push(i);
      else large.push(i);
    }

    while (small.length && large.length) {
      const s = small.pop();
      const l = large.pop();
      this.prob[s] = scaled[s];
      this.alias[s] = l;
      scaled[l] = (scaled[l] + scaled[s]) - 1;
      if (scaled[l] < 1) small.push(l);
      else large.push(l);
    }

    while (large.length) {
      this.prob[large.pop()] = 1;
    }
    while (small.length) {
      this.prob[small.pop()] = 1;
    }
  }

  /** Returns an index sampled according to the weights */
  sample() {
    const i = Math.floor(Math.random() * this.n);
    return Math.random() < this.prob[i] ? i : this.alias[i];
  }
}
