/**
 * LearningTool — Hash-based SPA Router
 */
export class Router {
  constructor(state) {
    this.state = state;
    this.currentRoute = null;
    this._changeCallbacks = [];
    this._loadedModules = {};
  }

  onRouteChange(cb) { this._changeCallbacks.push(cb); }

  start() {
    window.addEventListener('hashchange', () => this._handleRoute());
    if (!window.location.hash) window.location.hash = '#/start';
    else this._handleRoute();
  }

  navigate(route) { window.location.hash = `#/${route}`; }

  async _handleRoute() {
    const route = (window.location.hash || '#/home').replace('#/', '') || 'home';
    this.currentRoute = route;

    // Load page-specific module dynamically
    await this._loadModule(route);

    // Load view HTML
    await this._loadView(route);

    this._changeCallbacks.forEach(cb => cb(route));
  }

  async _loadModule(route) {
    const modules = {
      'reader': () => import('./modules/paper-reader/reader-core.js'),
      'quiz': () => import('./modules/quiz/quiz-core.js'),
      'quiz-session': () => import('./modules/quiz/quiz-core.js'),
      'settings': () => import('./modules/settings-core.js'),
    };
    if (modules[route] && !this._loadedModules[route]) {
      try {
        await modules[route]();
        this._loadedModules[route] = true;
        console.log('Module loaded:', route);
      } catch (e) {
        console.error('Module load failed:', route, e);
        const container = document.getElementById('pageContent');
        if (container) container.innerHTML += '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--color-error-bg);color:var(--color-error);padding:8px 16px;font-size:12px;z-index:9999;text-align:center;">Module load error: ' + route + ' — ' + e.message + '</div>';
      }
    }
  }

  async _loadView(route) {
    const container = document.getElementById('pageContent');
    if (!container) return;

    // Fade out current content
    const current = container.querySelector('.page-content-inner');
    if (current) {
      current.style.opacity = '0';
      current.style.transform = 'translateY(8px)';
      current.style.transition = 'opacity 0.15s ease-out, transform 0.15s ease-out';
      await new Promise(r => setTimeout(r, 150));
    }

    try {
      const resp = await fetch(`/src/views/${route}.html`);
      if (!resp.ok) { container.innerHTML = this._notFound(route); return; }
      const html = await resp.text();
      container.innerHTML = html;

      // Execute scripts (innerHTML doesn't run <script> tags)
      container.querySelectorAll('script').forEach(s => {
        const ns = document.createElement('script');
        if (s.src) { ns.src = s.src; } else { ns.textContent = s.textContent; }
        s.replaceWith(ns);
      });

      // Fade in new content
      const inner = container.querySelector('.page-content-inner');
      if (inner) {
        inner.style.opacity = '0';
        inner.style.transform = 'translateY(8px)';
        inner.style.transition = 'none';
        requestAnimationFrame(() => {
          inner.style.transition = 'opacity 0.25s var(--ease-default), transform 0.25s var(--ease-default)';
          inner.style.opacity = '1';
          inner.style.transform = 'translateY(0)';
        });
      }

      // Delay event slightly so module listeners can register on new DOM
      setTimeout(() => document.dispatchEvent(new CustomEvent('page-loaded', { detail: { route, state: this.state } })), 50);
      container.scrollTop = 0;
    } catch (e) {
      container.innerHTML = this._notFound(route);
    }
  }

  _notFound(route) {
    return `<div class="page-content-inner"><div class="empty-state"><div class="empty-state-title">Page not found</div><div class="empty-state-desc">Route "${route}" does not exist.</div></div></div>`;
  }
}
