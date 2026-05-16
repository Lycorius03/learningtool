/**
 * LearningTool — Smooth Scroll Engine
 * Wraps @studio-freight/lenis with project-specific configuration.
 * Provides: smooth scroll, scroll-driven parallax, scroll progress.
 *
 * Lenis uses linear interpolation (lerp) to smooth native scroll behavior,
 * preserving accessibility while delivering premium scroll feel.
 */

const DEFAULT_OPTIONS = {
  lerp: 0.08,       // 线性插值因子 (越小越平滑, 推荐 0.06-0.12)
  duration: 1.2,    // 自定义滚轮事件的持续时间
  smoothWheel: true,
  smoothTouch: false, // 移动端保留原生滚动惯性
  wheelMultiplier: 0.8,
  touchMultiplier: 2,
  normalizeWheel: true,
  infinite: false
};

class SmoothScroll {
  constructor(options = {}) {
    this._opts = { ...DEFAULT_OPTIONS, ...options };
    this._lenis = null;
    this._rafId = null;
    this._scrollCallbacks = [];
    this._progress = 0;
    this._velocity = 0;
    this._direction = 0; // 1 = down, -1 = up
    this._ready = false;
  }

  /**
   * Initialize Lenis and start the render loop.
   * Must be called after DOM is ready.
   */
  init() {
    if (typeof window === 'undefined') return;
    if (!window.Lenis) {
      console.warn('[SmoothScroll] Lenis not available — falling back to native scroll');
      return;
    }

    this._lenis = new window.Lenis(this._opts);

    // Track scroll progress and velocity
    this._lenis.on('scroll', ({ scroll, limit, velocity, direction }) => {
      this._progress = limit > 0 ? scroll / limit : 0;
      this._velocity = velocity;
      this._direction = direction;
      this._scrollCallbacks.forEach(cb => cb({ scroll, limit, velocity, direction, progress: this._progress }));
    });

    // Start RAF loop
    this._startRAF();
    this._ready = true;

    // Notify GSAP ScrollTrigger to use Lenis
    if (window.gsap && window.ScrollTrigger) {
      this._lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add((time) => {
        this._lenis?.raf(time * 1000);
      });
      window.gsap.ticker.lagSmoothing(0);
    }

    console.log('[SmoothScroll] Lenis initialized — lerp:', this._opts.lerp);
  }

  /**
   * Subscribe to scroll events.
   * @param {Function} callback — receives { scroll, limit, velocity, direction, progress }
   */
  onScroll(callback) {
    this._scrollCallbacks.push(callback);
    return () => {
      this._scrollCallbacks = this._scrollCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Get current scroll state.
   */
  getState() {
    return {
      progress: this._progress,
      velocity: this._velocity,
      direction: this._direction,
      scroll: this._lenis?.scroll || 0,
      limit: this._lenis?.limit || 0,
      ready: this._ready
    };
  }

  /**
   * Scroll to a target position or element.
   * @param {number|string|HTMLElement} target
   * @param {object} [options] — Lenis scrollTo options
   */
  scrollTo(target, options = {}) {
    if (!this._lenis) return;
    this._lenis.scrollTo(target, {
      offset: 0,
      duration: options.duration || 1.2,
      easing: options.easing || (t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      ...options
    });
  }

  /**
   * Start the scroll to top.
   */
  scrollToTop(duration = 0.8) {
    this.scrollTo(0, { duration });
  }

  /**
   * Stop the smooth scroll engine.
   */
  stop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._ready = false;
    // Lenis doesn't have a direct .stop() — RAF loop handles this
  }

  /**
   * Restart the render loop.
   */
  start() {
    if (this._ready) return;
    this._startRAF();
    this._ready = true;
  }

  /**
   * Destroy the engine entirely.
   */
  destroy() {
    this.stop();
    this._lenis?.destroy();
    this._lenis = null;
    this._scrollCallbacks = [];
    this._ready = false;
  }

  // ─── Internal ──────────────────────────────────────

  _startRAF() {
    const raf = (time) => {
      this._lenis?.raf(time);
      this._rafId = requestAnimationFrame(raf);
    };
    this._rafId = requestAnimationFrame(raf);
  }
}

// Singleton
export const smoothScroll = new SmoothScroll();
export default smoothScroll;
