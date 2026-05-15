/**
 * PaperLens — Application Entry Point
 * Initializes router, state, admin entrance, and global event listeners.
 */
import { Router } from './router.js';
import { AppState } from './state.js';
import { AdminEntrance } from './modules/admin/entrance.js';
import { showToast } from './utils/toast.js';

// --- Initialize core modules ---
const state = new AppState();
const router = new Router(state);

// Make instances accessible globally for debugging
window.__paperlens = { state, router };

// --- Load saved state from localStorage ---
state.loadFromStorage();

// --- Set up admin entrance (keyboard chord) ---
const adminEntrance = new AdminEntrance(state);

// --- Sidebar navigation ---
document.querySelectorAll('.nav-item[data-route]').forEach(item => {
  item.addEventListener('click', () => {
    const route = item.dataset.route;
    router.navigate(route);
  });
});

// --- Brand click → home ---
document.querySelector('.brand').addEventListener('click', () => {
  router.navigate('home');
});

// --- User row click → toggle admin ---
document.getElementById('userRow').addEventListener('click', () => {
  if (state.isAdmin) {
    state.logout();
    showToast('已退出管理员模式', 'info');
  }
});

// --- Update sidebar active state on route change ---
router.onRouteChange((route) => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === route);
  });

  const titles = {
    home: '首页',
    reader: '论文阅读',
    quiz: '刷题',
    template: '题库模板',
    settings: '设置'
  };
  document.getElementById('topbarTitle').textContent = titles[route] || 'PaperLens';
});

// --- Update UI when admin state changes ---
state.onAdminChange((isAdmin) => {
  document.getElementById('userAvatar').textContent = isAdmin ? 'E' : 'U';
  document.getElementById('userNameDisplay').textContent = isAdmin ? 'Echo (管理员)' : '未登录';
  document.getElementById('userAvatar').style.background = isAdmin
    ? 'linear-gradient(135deg, #D97757, #C4643E)'
    : 'linear-gradient(135deg, var(--color-accent-soft), var(--color-accent))';

  const modelBadge = document.getElementById('modelBadge');
  modelBadge.style.display = isAdmin ? 'inline-flex' : 'none';
});

// --- Start the app ---
router.start();

console.log('PaperLens initialized');
