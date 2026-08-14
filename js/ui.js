// Tiny DOM helpers plus the sheet / toast / confirm primitives the views share.

/**
 * el('div.card', { onclick }, [children])  — tag#id.class.class syntax.
 * Children may be nodes, strings, or nested arrays; null/false are skipped.
 */
export function el(spec, props = null, children = null) {
  const m = /^([a-zA-Z0-9-]+)?(#[^.]+)?((?:\.[^.#]+)*)$/.exec(spec);
  const tag = (m && m[1]) || 'div';
  const node = document.createElement(tag);
  if (m && m[2]) node.id = m[2].slice(1);
  if (m && m[3]) node.className = m[3].slice(1).split('.').join(' ');

  if (Array.isArray(props) || typeof props === 'string' || typeof props === 'number' || props instanceof Node) {
    children = props;
    props = null;
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'value') node.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') node[k] = !!v;
      else node.setAttribute(k, v);
    }
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  if (children === null || children === undefined || children === false) return node;
  if (Array.isArray(children)) {
    children.forEach((c) => append(node, c));
    return node;
  }
  node.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, v);
  }
  return node;
}

/* ---------------- sheets ---------------- */

const sheetRoot = () => document.getElementById('sheetRoot');
const openSheets = [];

/**
 * openSheet({ title, body, footer, onClose }) -> { close(), body, backdrop }
 * body/footer may be nodes or a function receiving the sheet handle.
 */
/** Stroke icons on a 24 grid, drawn in one weight so nothing reads as clip art. */
const ICONS = {
  plus: 'M12 5.5v13M5.5 12h13',
  scale: 'M12 3.5v3M6.5 6.5h11l3 8.5a4.5 4.5 0 0 1-8.5 0zM6.5 6.5l-3 8.5a4.5 4.5 0 0 0 8.5 0z',
  chevron: 'M9 5.5l6.5 6.5L9 18.5',
};

export function icon(name, { size = 18, width = 2.1 } = {}) {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true',
    fill: 'none', stroke: 'currentColor', 'stroke-width': width,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  svg.appendChild(svgEl('path', { d: ICONS[name] }));
  return svg;
}

export function openSheet({ title, body, footer, flush = false, onClose } = {}) {
  const handle = {};
  const bodyEl = el('div.sheet-body' + (flush ? '.flush' : ''));
  const headEl = el('div.sheet-head', [
    el('h2', title || ''),
    el('button.btn.sm.ghost', { onclick: () => handle.close(), 'aria-label': 'Close' }, 'Close'),
  ]);
  const sheet = el('div.sheet', [el('div.sheet-grab'), headEl, bodyEl]);
  const backdrop = el('div.sheet-backdrop', {
    onclick: (e) => { if (e.target === backdrop) handle.close(); },
  }, sheet);

  handle.body = bodyEl;
  handle.sheet = sheet;
  handle.setTitle = (t) => { headEl.firstChild.textContent = t; };
  handle.close = () => {
    const i = openSheets.indexOf(handle);
    if (i === -1) return;
    openSheets.splice(i, 1);
    backdrop.remove();
    if (!openSheets.length) document.body.style.overflow = '';
    if (onClose) onClose();
  };
  handle.setFooter = (content) => {
    let foot = sheet.querySelector('.sheet-foot');
    if (!content) { if (foot) foot.remove(); return; }
    if (!foot) { foot = el('div.sheet-foot'); sheet.appendChild(foot); }
    clear(foot);
    append(foot, content);
  };

  append(bodyEl, typeof body === 'function' ? body(handle) : body);
  if (footer) handle.setFooter(typeof footer === 'function' ? footer(handle) : footer);

  sheetRoot().appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  openSheets.push(handle);
  return handle;
}

export function closeAllSheets() {
  [...openSheets].reverse().forEach((s) => s.close());
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openSheets.length) openSheets[openSheets.length - 1].close();
});

/* ---------------- toast & confirm ---------------- */

export function toast(message, { action, actionLabel, duration = 2800 } = {}) {
  const root = document.getElementById('toastRoot');
  const node = el('div.toast', [
    el('span', message),
    action ? el('button', { onclick: () => { node.remove(); action(); } }, actionLabel || 'Undo') : null,
  ]);
  root.appendChild(node);
  if (duration) setTimeout(() => node.remove(), duration);
  return node;
}

export function confirmSheet({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const sheet = openSheet({
      title,
      body: el('p', { style: { margin: '4px 0 8px', fontSize: '15px' } }, message),
      onClose: () => { if (!done) resolve(false); },
    });
    sheet.setFooter([
      el('button.btn.ghost', { onclick: () => sheet.close() }, 'Cancel'),
      el('button.btn' + (danger ? '.danger' : '.primary'), {
        onclick: () => { done = true; sheet.close(); resolve(true); },
      }, confirmLabel),
    ]);
  });
}

/* ---------------- small components ---------------- */

/** Segmented control. options: [{value,label}]; returns the element. */
export function segmented(options, value, onChange, { accent = false } = {}) {
  const wrap = el('div.seg' + (accent ? '.accent' : ''));
  options.forEach((opt) => {
    wrap.appendChild(el('button', {
      type: 'button',
      class: opt.value === value ? 'on' : '',
      onclick: () => {
        [...wrap.children].forEach((c) => c.classList.remove('on'));
        wrap.children[options.indexOf(opt)].classList.add('on');
        onChange(opt.value);
      },
    }, opt.label));
  });
  return wrap;
}

export function field(label, input, hint) {
  return el('div.field', [el('label', label), input, hint ? el('div.hint', hint) : null]);
}

export function numberInput(props = {}) {
  return el('input', { type: 'number', inputmode: 'decimal', step: 'any', ...props });
}

/** Progress bar; ratio > 1 renders the striped over-target fill. */
export function progressBar(ratio, color) {
  const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
  const fill = el('i', { style: { width: `${pct}%` } });
  if (ratio > 1.001) fill.classList.add('over');
  if (color) fill.style.background = color;
  return el('div.bar', fill);
}

export const fmt = {
  int: (n) => Math.round(n || 0).toLocaleString(),
  g: (n) => `${Math.round(n || 0)} g`,
  kg: (n) => `${(n || 0).toFixed(1)} kg`,
  signed: (n, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`,
  qty: (n) => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : String(Number(n.toFixed(2)))),
};
