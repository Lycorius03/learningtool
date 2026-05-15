/**
 * PaperLens — Hash-based SPA Router
 * Renders pages into #pageContent based on URL hash.
 */
export class Router {
  constructor(state) {
    this.state = state;
    this.currentRoute = null;
    this._changeCallbacks = [];
  }

  onRouteChange(callback) {
    this._changeCallbacks.push(callback);
  }

  start() {
    window.addEventListener('hashchange', () => this._handleRoute());
    if (!window.location.hash) {
      window.location.hash = '#/home';
    } else {
      this._handleRoute();
    }
  }

  navigate(route) {
    window.location.hash = `#/${route}`;
  }

  _handleRoute() {
    const hash = window.location.hash || '#/home';
    const route = hash.replace('#/', '') || 'home';
    this.currentRoute = route;

    // Load view HTML
    this._loadView(route);

    // Notify listeners
    this._changeCallbacks.forEach(cb => cb(route));
  }

  async _loadView(route) {
    const container = document.getElementById('pageContent');
    if (!container) return;

    try {
      const response = await fetch(`/src/views/${route}.html`);
      if (!response.ok) {
        container.innerHTML = this._notFound(route);
        return;
      }
      const html = await response.text();
      container.innerHTML = html;
      container.querySelector('.page-content-inner')?.classList.add('page-enter');

      // Trigger page-specific init
      this._initPage(route);
    } catch (err) {
      container.innerHTML = this._notFound(route);
    }
  }

  _initPage(route) {
    // Dispatch custom event for page-specific modules to hook into
    document.dispatchEvent(new CustomEvent('page-loaded', { detail: { route, state: this.state } }));
  }

  _notFound(route) {
    return `
      <div class="page-content-inner">
        <div class="empty-state">
          <div class="empty-state-title">页面不存在</div>
          <div class="empty-state-desc">路由 "${route}" 对应的页面尚未实现。</div>
        </div>
      </div>
    `;
  }
}
