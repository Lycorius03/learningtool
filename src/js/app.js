/**
 * LearningTool — Entry Point
 * No navbar. Custom cursor. Router. Admin entrance.
 */
import { Router } from './router.js';
import { AppState } from './state.js';
import { AdminEntrance } from './modules/admin/entrance.js';
import { showToast } from './utils/toast.js';

const state = new AppState();
const router = new Router(state);
window.__lt = { state, router };

state.loadFromStorage();

// --- Custom cursor (gemini-code V12 style) ---
(function() {
  const dot = document.getElementById('cursorDot');
  if (!dot || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) { if (dot) dot.remove(); return; }
  const mouse = { x: -100, y: -100 };
  const pos = { x: 0, y: 0 };
  let active = false;

  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  function tick() {
    pos.x += (mouse.x - pos.x) * 0.25;
    pos.y += (mouse.y - pos.y) * 0.25;
    dot.style.transform = `translate3d(${pos.x - (active ? 20 : 3)}px, ${pos.y - (active ? 20 : 3)}px, 0)`;
    requestAnimationFrame(tick);
  }
  tick();

  const hoverSel = 'a, button, .btn, .card, .bento-card, .tool-item, [data-route], .quiz-option, .drop-zone, .topnav-link, .nav-item, [data-hover]';
  document.addEventListener('mouseover', e => {
    const el = e.target.closest(hoverSel);
    if (el) { active = true; dot.classList.add('hover'); }
    else { active = false; dot.classList.remove('hover'); }
  });

  document.addEventListener('mousedown', () => { dot.style.transform += ' scale(0.6)'; });
  document.addEventListener('mouseup', () => { dot.style.transform = dot.style.transform.replace(' scale(0.6)', ' scale(1)'); });
})();

// --- Admin ---
new AdminEntrance(state);

state.onAdminChange(isAdmin => {
  document.getElementById('modelBadge') && (document.getElementById('modelBadge').style.display = isAdmin ? 'inline-flex' : 'none');
});

// --- Linear spotlight: track mouse on all cards ---
document.addEventListener('mousemove', e => {
  document.querySelectorAll('.card, .bento-card, .tool-item').forEach(card => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
}, { passive: true });

// --- IntersectionObserver: scroll reveal ---
(function() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, { threshold: 0.15 });

  // Observe stagger-children on each page load
  document.addEventListener('page-loaded', () => {
    document.querySelectorAll('.stagger-children > *, .reveal').forEach(el => {
      el.style.opacity = '0';
      observer.observe(el);
    });
  });

  // CSS for revealed state
  const style = document.createElement('style');
  style.textContent = `
    .revealed { animation: revealIn 0.7s var(--ease-default) forwards; }
    @keyframes revealIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  `;
  document.head.appendChild(style);
})();

// --- Start ---
try {
  router.start();
  console.log('LearningTool started');
} catch (e) {
  console.error('Startup failed:', e);
  document.body.innerHTML += '<div style="position:fixed;top:0;left:0;right:0;background:#A64040;color:#fff;padding:12px 20px;z-index:99999;text-align:center;font-family:monospace;">Startup Error: ' + e.message + '</div>';
}
