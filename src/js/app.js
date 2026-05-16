/**
 * LearningTool — Entry Point
 * No navbar. Custom cursor. Router. Admin entrance.
 */

// Initialize theme immediately to prevent flash
(function() {
  try {
    const theme = localStorage.getItem('paperlens_theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    // Default is light — no class needed
  } catch (e) { /* ignore */ }
})();

import { Router } from './router.js';
import { AppState } from './state.js';
import { AdminEntrance } from './modules/admin/entrance.js';
import { showToast } from './utils/toast.js';
import { smoothScroll } from './services/smooth-scroll.js';
import { initMagneticEffects } from './utils/magnetic.js';

const state = new AppState();
const router = new Router(state);
window.__lt = { state, router, smoothScroll };

await state.loadFromStorage();

// --- Custom cursor (smooth lerp following) ---
(function() {
  const dot = document.getElementById('cursorDot');
  if (!dot || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) { if (dot) dot.remove(); return; }
  const mouse = { x: -100, y: -100 };
  const pos = { x: 0, y: 0 };
  let active = false;

  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  function tick() {
    pos.x += (mouse.x - pos.x) * 0.22;
    pos.y += (mouse.y - pos.y) * 0.22;
    const size = active ? 20 : 3;
    dot.style.transform = `translate3d(${pos.x - size}px, ${pos.y - size}px, 0)`;
    if (active) {
      dot.style.width = '40px'; dot.style.height = '40px';
      dot.style.backgroundColor = 'var(--color-accent)';
      dot.style.opacity = '0.15';
    } else {
      dot.style.width = '6px'; dot.style.height = '6px';
      dot.style.backgroundColor = 'var(--color-text-primary)';
      dot.style.opacity = '1';
    }
    requestAnimationFrame(tick);
  }
  tick();

  const hoverSel = 'a, button, .btn, .card, .bento-card, .tool-item, [data-route], .quiz-option, .drop-zone, .topnav-link, .nav-item, [data-hover]';
  document.addEventListener('mouseover', e => {
    const el = e.target.closest(hoverSel);
    active = !!el;
    if (el) dot.classList.add('hover'); else dot.classList.remove('hover');
  });

  document.addEventListener('mousedown', () => { dot.style.transform = dot.style.transform.replace('scale(1)', '') + ' scale(0.7)'; });
  document.addEventListener('mouseup', () => { dot.style.transform = dot.style.transform.replace(' scale(0.7)', ''); });
})();

// --- Admin ---
new AdminEntrance(state);

state.onAdminChange(isAdmin => {
  document.getElementById('modelBadge') && (document.getElementById('modelBadge').style.display = isAdmin ? 'inline-flex' : 'none');
});

// --- Linear spotlight: track mouse on all cards (RAF-throttled) ---
let _spotlightPending = false;
let _spotlightX = 0, _spotlightY = 0;
document.addEventListener('mousemove', e => {
  _spotlightX = e.clientX; _spotlightY = e.clientY;
  if (!_spotlightPending) {
    _spotlightPending = true;
    requestAnimationFrame(() => {
      _spotlightPending = false;
      document.querySelectorAll('.card, .bento-card, .tool-item').forEach(card => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (_spotlightX - r.left) + 'px');
        card.style.setProperty('--my', (_spotlightY - r.top) + 'px');
      });
    });
  }
}, { passive: true });

// --- Scroll reveal (GSAP ScrollTrigger if available, IntersectionObserver fallback) ---
(function() {
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);

  if (hasGSAP) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  // Inject reveal CSS
  var style = document.createElement('style');
  style.textContent = '.reveal { will-change: transform, opacity; } .reveal:not(.revealed) { opacity: 0; transform: translateY(28px) rotate(0.3deg); } .stagger-children > *:not(.revealed) { opacity: 0; transform: translateY(20px); }';
  document.head.appendChild(style);

  function setupGSAPScrollReveals() {
    if (!window.gsap || !window.ScrollTrigger) return;
    window.ScrollTrigger.refresh();

    document.querySelectorAll('.reveal:not(.revealed)').forEach(function(el) {
      el.classList.add('revealed');
      window.gsap.fromTo(el,
        { opacity: 0, y: 30, rotate: 0.5 },
        { opacity: 1, y: 0, rotate: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' } }
      );
    });

    document.querySelectorAll('.stagger-children').forEach(function(container) {
      if (container.dataset.staggered === 'true') return;
      container.dataset.staggered = 'true';
      var children = container.querySelectorAll(':scope > *');
      window.gsap.fromTo(children,
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 0.65, stagger: 0.08, ease: 'power2.out',
          scrollTrigger: { trigger: container, start: 'top 92%', toggleActions: 'play none none none' } }
      );
    });

    document.querySelectorAll('.hero, .docs-hero').forEach(function(hero) {
      if (hero.dataset.parallaxed === 'true') return;
      hero.dataset.parallaxed = 'true';
      window.gsap.to(hero.querySelector('.hero-title, .docs-heading') || hero.firstElementChild, {
        y: -40, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 }
      });
    });
  }

  // ─── IntersectionObserver fallback (always works, no CDN needed) ───
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  function setupIOReveals() {
    document.querySelectorAll('.reveal:not(.revealed), .stagger-children > *:not(.revealed)').forEach(function(el) {
      io.observe(el);
    });
  }

  // Page navigation
  document.addEventListener('page-loaded', function() {
    setTimeout(function() {
      if (hasGSAP) { setupGSAPScrollReveals(); } else { setupIOReveals(); }
      initMagneticEffects();
    }, 100);
  });

  // Initial run
  setTimeout(function() {
    if (hasGSAP) { setupGSAPScrollReveals(); } else { setupIOReveals(); }
  }, 300);
})();

// --- Start ---
try {
  // Initialize smooth scroll engine (Lenis)
  smoothScroll.init();

  // Scroll progress bar (Lenis if available, native scroll fallback)
  const scrollBar = document.getElementById('scrollProgressBar');
  if (scrollBar) {
    const hasLenis = smoothScroll._lenis !== null;
    if (hasLenis) {
      smoothScroll.onScroll(({ progress }) => {
        scrollBar.style.width = (progress * 100).toFixed(1) + '%';
      });
    } else {
      // Native scroll fallback
      const scrollEl = document.querySelector('.page-content');
      if (scrollEl) {
        scrollEl.addEventListener('scroll', () => {
          const h = scrollEl.scrollHeight - scrollEl.clientHeight;
          scrollBar.style.width = h > 0 ? (scrollEl.scrollTop / h * 100).toFixed(1) + '%' : '0%';
        }, { passive: true });
      }
    }
  }

  // Connect parallax orbs (GSAP if available, CSS transform fallback)
  const orbs = document.querySelectorAll('.orb');
  if (orbs.length && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var hasGsap = typeof gsap !== 'undefined';
    document.addEventListener('mousemove', function(e) {
      var x = (e.clientX / window.innerWidth - 0.5) * 20;
      var y = (e.clientY / window.innerHeight - 0.5) * 20;
      if (hasGsap) {
        gsap.to(orbs[0], { x: x * 0.6, y: y * 0.6, duration: 1.5, ease: 'power2.out' });
        gsap.to(orbs[1], { x: x * -0.4, y: y * -0.4, duration: 1.8, ease: 'power2.out' });
        gsap.to(orbs[2], { x: x * 0.3, y: y * 0.3, duration: 2.0, ease: 'power2.out', xPercent: -50, yPercent: -50 });
      } else {
        // Fallback: raw CSS transform (no GSAP)
        orbs[0].style.transform = 'translate(' + (x * 0.6) + 'px, ' + (y * 0.6) + 'px)';
        orbs[1].style.transform = 'translate(' + (x * -0.4) + 'px, ' + (y * -0.4) + 'px)';
        orbs[2].style.transform = 'translate(-50%, -50%) translate(' + (x * 0.3) + 'px, ' + (y * 0.3) + 'px)';
      }
    }, { passive: true });
  }

  router.start();
  console.log('LearningTool started');
} catch (e) {
  console.error('Startup failed:', e);
  document.body.innerHTML += '<div style="position:fixed;top:0;left:0;right:0;background:#A64040;color:#fff;padding:12px 20px;z-index:99999;text-align:center;font-family:monospace;">Startup Error: ' + e.message + '</div>';
}
