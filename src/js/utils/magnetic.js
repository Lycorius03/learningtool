/**
 * LearningTool — Magnetic Hover Effect
 *
 * When the cursor approaches a .magnetic element, the element subtly
 * moves toward the cursor position, creating a "magnetic pull" illusion.
 *
 * Uses spring physics for buttery-smooth return to rest position.
 */
class MagneticEffect {
  constructor(el, strength = 0.3) {
    this.el = el;
    this.strength = strength;
    this.boundMousemove = this._onMouseMove.bind(this);
    this.boundMouseleave = this._onMouseLeave.bind(this);
    this._rafId = null;
    this._current = { x: 0, y: 0 };
    this._target = { x: 0, y: 0 };
    this._active = false;
    this._bound = false;
  }

  bind() {
    if (this._bound) return;
    this.el.addEventListener('mousemove', this.boundMousemove);
    this.el.addEventListener('mouseleave', this.boundMouseleave);
    this._bound = true;
  }

  unbind() {
    if (!this._bound) return;
    this.el.removeEventListener('mousemove', this.boundMousemove);
    this.el.removeEventListener('mouseleave', this.boundMouseleave);
    this._active = false;
    this._bound = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _onMouseMove(e) {
    const rect = this.el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // Offset from center, normalized
    this._target.x = (e.clientX - centerX) * this.strength;
    this._target.y = (e.clientY - centerY) * this.strength;
    if (!this._active) {
      this._active = true;
      this._tick();
    }
  }

  _onMouseLeave() {
    this._target.x = 0;
    this._target.y = 0;
    // Let spring settle, then stop RAF
    setTimeout(() => {
      if (this._target.x === 0 && this._target.y === 0) {
        this._active = false;
      }
    }, 200);
  }

  _tick() {
    // Spring physics for smooth return
    const stiffness = 0.12;
    const damping = 0.7;
    const dx = this._target.x - this._current.x;
    const dy = this._target.y - this._current.y;
    this._current.x += dx * stiffness;
    this._current.y += dy * stiffness;
    this._current.x *= damping;
    this._current.y *= damping;

    this.el.style.transform = `translate3d(${this._current.x}px, ${this._current.y}px, 0)`;

    if (this._active) {
      this._rafId = requestAnimationFrame(() => this._tick());
    }
  }
}

/**
 * Scan the DOM and bind magnetic effect to all .magnetic elements.
 */
function initMagneticEffects(root = document) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return [];

  const instances = [];
  root.querySelectorAll('.magnetic').forEach(el => {
    if (el.dataset.magneticBound === 'true') return;
    el.dataset.magneticBound = 'true';
    const strength = parseFloat(el.dataset.magneticStrength) || 0.3;
    const inst = new MagneticEffect(el, strength);
    inst.bind();
    instances.push(inst);
  });
  return instances;
}

export { MagneticEffect, initMagneticEffects };
