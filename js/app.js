// Bootstrap: storage init, theme, hash router, service worker update flow.

import * as store from './store.js';
import { clear, el, toast, closeAllSheets } from './ui.js';

import * as todayView from './views/today.js';
import * as foodsView from './views/foods.js';
import * as progressView from './views/progress.js';
import * as settingsView from './views/settings.js';

const ROUTES = {
  today: { title: 'Today', view: todayView },
  foods: { title: 'Foods', view: foodsView },
  progress: { title: 'Progress', view: progressView },
  settings: { title: 'Settings', view: settingsView },
};

const viewRoot = document.getElementById('view');
const titleEl = document.getElementById('viewTitle');
const actionsEl = document.getElementById('appbarActions');
let currentName = null;

/* ---------------- theme ---------------- */

export function applyTheme() {
  const theme = store.getProfile().theme || 'auto';
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const dark = theme === 'dark' || (theme === 'auto' && !window.matchMedia('(prefers-color-scheme: light)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f1115' : '#f4f5f7');
}

/* ---------------- router ---------------- */

function routeName() {
  const hash = location.hash.replace(/^#\/?/, '').split('/')[0];
  return ROUTES[hash] ? hash : 'today';
}

function render({ keepScroll = false } = {}) {
  const name = routeName();
  const route = ROUTES[name];
  const scroll = window.scrollY;
  const isSwitch = name !== currentName;
  currentName = name;

  titleEl.textContent = route.title;
  clear(actionsEl);
  clear(viewRoot);
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.fab').forEach((f) => f.remove());

  try {
    route.view.render(viewRoot, { actions: actionsEl });
  } catch (err) {
    console.error(err);
    viewRoot.appendChild(el('div.card', [
      el('h2', 'Something broke'),
      el('p.hint', String(err && err.message ? err.message : err)),
    ]));
  }

  if (isSwitch) window.scrollTo(0, 0);
  else if (keepScroll) window.scrollTo(0, scroll);
}

/** Re-render the active view in place, preserving scroll. */
export function refresh() {
  render({ keepScroll: true });
}

window.addEventListener('hashchange', () => {
  closeAllSheets();
  render();
});

store.onChange(() => refresh());

/* ---------------- service worker ---------------- */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const incoming = reg.installing;
      if (!incoming) return;
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Update ready', {
            action: () => incoming.postMessage({ type: 'SKIP_WAITING' }),
            actionLabel: 'Restart',
            duration: 0,
          });
        }
      });
    });
  }).catch((err) => console.warn('SW registration failed', err));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

/* ---------------- boot ---------------- */

function boot() {
  try {
    store.init();
  } catch (err) {
    document.body.innerHTML = '';
    document.body.appendChild(el('div.view', el('div.card', [
      el('h2', 'Cannot open your data'),
      el('p.hint', String(err.message || err)),
    ])));
    return;
  }

  applyTheme();
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

  render();
  registerServiceWorker();

  if (navigator.storage && navigator.storage.persist) {
    const ask = () => {
      navigator.storage.persisted().then((already) => {
        if (!already) navigator.storage.persist().catch(() => {});
      }).catch(() => {});
      document.removeEventListener('pointerdown', ask);
    };
    document.addEventListener('pointerdown', ask, { once: true });
  }
}

boot();
