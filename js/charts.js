// Hand-rolled inline-SVG charts. No dependencies, no network, theme-aware.
// Colours come through inline styles so CSS custom properties resolve in both themes.

import { svgEl, el, clear } from './ui.js';
import { fmtShort, fmtDay } from './dates.js';

const W = 340; // viewBox width; every chart scales to its container
let uid = 0;
const nextId = () => `mm${++uid}`;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function frame(height, { overflow = false } = {}) {
  const svg = svgEl('svg', { class: 'chart', viewBox: `0 0 ${W} ${height}`, role: 'img' });
  if (overflow) svg.style.overflow = 'visible';
  return svg;
}

/** Wraps a chart so a tooltip can float over it. */
function wrap(svg, extra) {
  return el('div.chartwrap', [svg, extra].filter(Boolean));
}

function ticks(min, max, count = 3) {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/** Catmull-Rom smoothed path through points, clamped so it never overshoots. */
function smoothPath(pts, close = null) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  if (close !== null) d += ` L${pts[pts.length - 1][0].toFixed(1)},${close} L${pts[0][0].toFixed(1)},${close} Z`;
  return d;
}

function gradient(svg, id, color, { from = 0.26, to = 0 } = {}) {
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 });
  const a = svgEl('stop', { offset: '0%', 'stop-opacity': from });
  const b = svgEl('stop', { offset: '100%', 'stop-opacity': to });
  a.style.stopColor = color;
  b.style.stopColor = color;
  grad.append(a, b);
  defs.appendChild(grad);
  svg.appendChild(defs);
  return `url(#${id})`;
}

/**
 * Grow-in for a group of marks. CSS animations are used throughout rather than
 * rAF-driven transitions: the final value is always what sits in the DOM, so a
 * chart built in a hidden tab still reads correctly the moment it is shown.
 */
function animateIn(group, baselineY) {
  if (reduceMotion()) return;
  group.style.transformOrigin = `0px ${baselineY}px`;
  group.style.animation = 'growY 620ms cubic-bezier(0.22, 1, 0.36, 1)';
}

/** Draws a stroke on, from its full length down to the element's own dashoffset. */
function animateStroke(node, length, { duration = 800, delay = 0 } = {}) {
  if (reduceMotion() || !length) return;
  node.style.setProperty('--dash', length);
  node.style.animation = `drawStroke ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`;
}

/* ================= rings ================= */

/**
 * Big calorie ring. Over-target draws a second arc in the warn colour.
 * Returns a div holding the SVG plus centred readout.
 */
export function calorieRing({ value, target, size = 172, stroke = 15 }) {
  const svg = svgEl('svg', { class: 'ring', viewBox: `0 0 ${size} ${size}` });
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const ratio = target ? value / target : 0;
  const over = Math.max(0, ratio - 1);

  const track = svgEl('circle', { cx, cy: cx, r, fill: 'none', 'stroke-width': stroke });
  track.style.stroke = 'var(--ring-track)';

  const arc = svgEl('circle', {
    cx, cy: cx, r, fill: 'none', 'stroke-width': stroke, 'stroke-linecap': 'round',
    transform: `rotate(-90 ${cx} ${cx})`,
    'stroke-dasharray': circ,
  });
  arc.style.stroke = over > 0 ? 'var(--warn)' : 'var(--accent)';
  const shown = Math.min(1, ratio);
  arc.setAttribute('stroke-dashoffset', circ * (1 - shown));
  animateStroke(arc, circ);
  svg.append(track, arc);

  if (over > 0) {
    const overArc = svgEl('circle', {
      cx, cy: cx, r, fill: 'none', 'stroke-width': stroke, 'stroke-linecap': 'round',
      transform: `rotate(-90 ${cx} ${cx})`,
      'stroke-dasharray': circ,
      'stroke-dashoffset': circ * (1 - Math.min(1, over)),
    });
    overArc.style.stroke = 'var(--bad)';
    overArc.style.opacity = '0.9';
    animateStroke(overArc, circ, { delay: 260 });
    svg.appendChild(overArc);
  }

  const left = target - value;
  const centre = el('div.ring-centre', [
    el('div.ring-value', { 'data-count': Math.round(Math.abs(left)) }, '0'),
    el('div.ring-label', left >= 0 ? 'kcal left' : 'kcal over'),
    el('div.ring-sub', `${Math.round(value).toLocaleString()} of ${Math.round(target).toLocaleString()}`),
  ]);

  return el('div.ringwrap', { style: { maxWidth: `${size}px` } }, [svg, centre]);
}

/** Small macro ring with its own label. */
export function macroRing({ label, value, target, colorVar, size = 74, stroke = 8 }) {
  const svg = svgEl('svg', { class: 'ring', viewBox: `0 0 ${size} ${size}` });
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const ratio = target ? Math.min(1, value / target) : 0;

  const track = svgEl('circle', { cx, cy: cx, r, fill: 'none', 'stroke-width': stroke });
  track.style.stroke = 'var(--ring-track)';
  const arc = svgEl('circle', {
    cx, cy: cx, r, fill: 'none', 'stroke-width': stroke, 'stroke-linecap': 'round',
    transform: `rotate(-90 ${cx} ${cx})`,
    'stroke-dasharray': circ,
    'stroke-dashoffset': circ * (1 - ratio),
  });
  arc.style.stroke = colorVar;
  animateStroke(arc, circ, { duration: 720, delay: 90 });
  svg.append(track, arc);

  const over = value > target;
  return el('div.mring', [
    el('div.mring-svg', [svg, el('div.mring-centre', [
      el('b', `${Math.round(value)}`),
      el('span', `/${Math.round(target)}`),
    ])]),
    el('div.mring-label', { style: { color: colorVar } }, label),
    el('div.mring-left', over ? `${Math.round(value - target)} over` : `${Math.round(target - value)} left`),
  ]);
}

/* ================= area / line ================= */

/**
 * Weight chart: gradient area under the trend line, raw weigh-ins as dots,
 * optional goal band. Tap or drag to inspect a day.
 * series: [{ date, raw|null, trend|null }]
 */
export function weightChart(series, { height = 168, goalLine = null } = {}) {
  const svg = frame(height);
  const values = series.flatMap((p) => [p.raw, p.trend]).filter((v) => typeof v === 'number');
  if (values.length < 2) {
    const t = svgEl('text', { x: W / 2, y: height / 2, 'text-anchor': 'middle', class: 'axis' });
    t.textContent = 'Not enough weigh-ins yet';
    svg.appendChild(t);
    return wrap(svg);
  }

  const padL = 34, padR = 8, padT = 12, padB = 20;
  let min = Math.min(...values, ...(goalLine ? goalLine.filter((v) => v !== null) : []));
  let max = Math.max(...values, ...(goalLine ? goalLine.filter((v) => v !== null) : []));
  const pad = Math.max(0.35, (max - min) * 0.2);
  min -= pad; max += pad;

  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const x = (i) => padL + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - min) / (max - min)) * plotH;

  ticks(min, max, 3).forEach((v) => {
    const line = svgEl('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(v), y2: y(v) });
    svg.appendChild(line);
    const label = svgEl('text', { class: 'axis', x: 2, y: y(v) + 3 });
    label.textContent = v.toFixed(1);
    svg.appendChild(label);
  });

  const fill = gradient(svg, nextId(), 'var(--accent)');

  // goal path, drawn behind the actual trend
  if (goalLine) {
    const gp = goalLine.map((v, i) => (v === null ? null : [x(i), y(v)])).filter(Boolean);
    if (gp.length > 1) {
      const path = svgEl('path', { d: gp.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') });
      path.setAttribute('class', 'goalline');
      svg.appendChild(path);
    }
  }

  const runs = [];
  let run = [];
  series.forEach((p, i) => {
    if (typeof p.trend === 'number') run.push([x(i), y(p.trend)]);
    else if (run.length) { runs.push(run); run = []; }
  });
  if (run.length) runs.push(run);

  runs.forEach((pts) => {
    if (pts.length > 1) {
      const area = svgEl('path', { d: smoothPath(pts, padT + plotH), fill });
      area.style.opacity = '1';
      svg.appendChild(area);
    }
    const line = svgEl('path', { class: 'trend', d: pts.length > 1 ? smoothPath(pts) : '' });
    svg.appendChild(line);
    if (pts.length > 1) {
      // getTotalLength needs the node in a document, so measure after insertion
      const len = line.getTotalLength ? line.getTotalLength() : 0;
      if (len) {
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = '0';
        animateStroke(line, len, { duration: 900 });
      }
    }
  });

  const dots = svgEl('g');
  series.forEach((p, i) => {
    if (typeof p.raw !== 'number') return;
    dots.appendChild(svgEl('circle', { class: 'dot', cx: x(i), cy: y(p.raw), r: 2 }));
  });
  svg.appendChild(dots);

  [0, series.length - 1].forEach((i, n) => {
    const label = svgEl('text', { class: 'axis', x: x(i), y: height - 4, 'text-anchor': n ? 'end' : 'start' });
    label.textContent = fmtShort(series[i].date);
    svg.appendChild(label);
  });

  // interactive scrubber
  const cursor = svgEl('line', { class: 'cursor', y1: padT, y2: padT + plotH, x1: 0, x2: 0 });
  const marker = svgEl('circle', { class: 'cursor-dot', r: 4, cx: 0, cy: 0 });
  cursor.style.opacity = '0'; marker.style.opacity = '0';
  svg.append(cursor, marker);

  const tip = el('div.chart-tip');
  attachScrubber(svg, tip, series.length, (i, px) => {
    const p = series[i];
    const v = p.trend ?? p.raw;
    if (v === null || v === undefined) return null;
    cursor.setAttribute('x1', x(i)); cursor.setAttribute('x2', x(i));
    marker.setAttribute('cx', x(i)); marker.setAttribute('cy', y(v));
    cursor.style.opacity = '1'; marker.style.opacity = '1';
    return {
      x: px,
      html: `<b>${v.toFixed(1)} kg</b><span>${fmtDay(p.date)}${p.raw !== null && p.raw !== undefined ? ` · weighed ${p.raw.toFixed(1)}` : ' · trend'}</span>`,
    };
  }, () => { cursor.style.opacity = '0'; marker.style.opacity = '0'; });

  return wrap(svg, tip);
}

/* ================= bars ================= */

/**
 * Daily calories vs target. Rounded gradient bars, stepped target line,
 * tap a bar for the day's numbers.
 * bars: [{ date, value, target, state, detail }]
 */
export function caloriesChart(bars, { height = 168 } = {}) {
  const svg = frame(height);
  if (!bars.length) return wrap(svg);

  const padL = 34, padR = 8, padT = 12, padB = 20;
  const max = Math.max(...bars.map((b) => Math.max(b.value || 0, b.target || 0))) * 1.14 || 1;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const slot = plotW / bars.length;
  const barW = Math.max(2.5, Math.min(14, slot * 0.64));
  const y = (v) => padT + plotH - (v / max) * plotH;
  const baseline = padT + plotH;

  ticks(0, max, 3).forEach((v) => {
    svg.appendChild(svgEl('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
    const label = svgEl('text', { class: 'axis', x: 2, y: y(v) + 3 });
    label.textContent = Math.round(v / 100) * 100;
    svg.appendChild(label);
  });

  const group = svgEl('g');
  bars.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    if (!b.value) {
      group.appendChild(svgEl('rect', {
        class: 'barmiss', x: cx - barW / 2, y: baseline - 3, width: barW, height: 3, rx: 1.5,
      }));
      return;
    }
    const top = y(b.value);
    const rect = svgEl('rect', {
      class: `barfill${b.state ? ` ${b.state}` : ''}`,
      x: cx - barW / 2, y: top, width: barW, height: Math.max(2, baseline - top), rx: Math.min(3, barW / 2),
    });
    group.appendChild(rect);
  });
  svg.appendChild(group);
  animateIn(group, baseline);

  const steps = [];
  bars.forEach((b, i) => {
    if (!b.target) return;
    const x0 = padL + slot * i;
    steps.push(`M${x0.toFixed(1)},${y(b.target).toFixed(1)} L${(x0 + slot).toFixed(1)},${y(b.target).toFixed(1)}`);
  });
  if (steps.length) svg.appendChild(svgEl('path', { class: 'target', d: steps.join(' ') }));

  [0, bars.length - 1].forEach((i, n) => {
    const label = svgEl('text', {
      class: 'axis', x: padL + slot * i + slot / 2, y: height - 4, 'text-anchor': n ? 'end' : 'start',
    });
    label.textContent = fmtShort(bars[i].date);
    svg.appendChild(label);
  });

  const hilite = svgEl('rect', { class: 'barhi', y: padT, height: plotH, width: slot, x: 0, rx: 3 });
  hilite.style.opacity = '0';
  svg.insertBefore(hilite, svg.firstChild);

  const tip = el('div.chart-tip');
  attachScrubber(svg, tip, bars.length, (i, px) => {
    const b = bars[i];
    hilite.setAttribute('x', padL + slot * i);
    hilite.style.opacity = '1';
    return {
      x: px,
      html: b.value
        ? `<b>${Math.round(b.value).toLocaleString()} kcal</b><span>${fmtDay(b.date)} · target ${Math.round(b.target).toLocaleString()}${b.detail ? ` · ${b.detail}` : ''}</span>`
        : `<b>Not logged</b><span>${fmtDay(b.date)}</span>`,
    };
  }, () => { hilite.style.opacity = '0'; });

  return wrap(svg, tip);
}

/**
 * Stacked macro calories per day, so the shape of the diet is visible at a glance.
 * bars: [{ date, p, c, f }] in grams
 */
export function macroStack(bars, { height = 158 } = {}) {
  const svg = frame(height);
  if (!bars.length) return wrap(svg);

  const padL = 34, padR = 8, padT = 12, padB = 20;
  const kcal = bars.map((b) => b.p * 4 + b.c * 4 + b.f * 9);
  const max = Math.max(...kcal) * 1.1 || 1;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const slot = plotW / bars.length;
  const barW = Math.max(2.5, Math.min(14, slot * 0.64));
  const y = (v) => padT + plotH - (v / max) * plotH;
  const baseline = padT + plotH;

  ticks(0, max, 3).forEach((v) => {
    svg.appendChild(svgEl('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
    const label = svgEl('text', { class: 'axis', x: 2, y: y(v) + 3 });
    label.textContent = Math.round(v / 100) * 100;
    svg.appendChild(label);
  });

  const group = svgEl('g');
  bars.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    let acc = 0;
    [['p', b.p * 4, 'var(--protein)'], ['c', b.c * 4, 'var(--carbs)'], ['f', b.f * 9, 'var(--fat)']].forEach(([, kc, color]) => {
      if (kc <= 0) return;
      const top = y(acc + kc);
      const h = Math.max(1, y(acc) - top);
      const rect = svgEl('rect', { x: cx - barW / 2, y: top, width: barW, height: h });
      rect.style.fill = color;
      group.appendChild(rect);
      acc += kc;
    });
  });
  svg.appendChild(group);
  animateIn(group, baseline);

  [0, bars.length - 1].forEach((i, n) => {
    const label = svgEl('text', { class: 'axis', x: padL + slot * i + slot / 2, y: height - 4, 'text-anchor': n ? 'end' : 'start' });
    label.textContent = fmtShort(bars[i].date);
    svg.appendChild(label);
  });

  const tip = el('div.chart-tip');
  attachScrubber(svg, tip, bars.length, (i, px) => {
    const b = bars[i];
    const total = b.p * 4 + b.c * 4 + b.f * 9;
    if (!total) return { x: px, html: `<b>Not logged</b><span>${fmtDay(b.date)}</span>` };
    const share = (v) => Math.round((v / total) * 100);
    return {
      x: px,
      html: `<b>${Math.round(b.p)}P ${Math.round(b.c)}C ${Math.round(b.f)}F</b><span>${fmtDay(b.date)} · ${share(b.p * 4)}/${share(b.c * 4)}/${share(b.f * 9)}% of calories</span>`,
    };
  });

  return wrap(svg, tip);
}

/**
 * Daily protein against target — the metric that decides whether a cut keeps muscle.
 * bars: [{ date, value, target }]
 */
export function proteinChart(bars, { height = 132 } = {}) {
  const svg = frame(height);
  if (!bars.length) return wrap(svg);

  const padL = 30, padR = 8, padT = 10, padB = 18;
  const max = Math.max(...bars.map((b) => Math.max(b.value || 0, b.target || 0))) * 1.15 || 1;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const slot = plotW / bars.length;
  const barW = Math.max(2.5, Math.min(14, slot * 0.64));
  const y = (v) => padT + plotH - (v / max) * plotH;
  const baseline = padT + plotH;

  const target = bars[bars.length - 1].target;
  svg.appendChild(svgEl('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(0), y2: y(0) }));

  const group = svgEl('g');
  bars.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    if (!b.value) return;
    const top = y(b.value);
    const rect = svgEl('rect', {
      x: cx - barW / 2, y: top, width: barW, height: Math.max(2, baseline - top), rx: Math.min(3, barW / 2),
    });
    rect.style.fill = b.value >= b.target * 0.9 ? 'var(--protein)' : 'var(--surface-3)';
    group.appendChild(rect);
  });
  svg.appendChild(group);
  animateIn(group, baseline);

  const line = svgEl('path', { class: 'target', d: `M${padL},${y(target)} L${W - padR},${y(target)}` });
  svg.appendChild(line);
  const label = svgEl('text', { class: 'axis', x: 2, y: y(target) + 3 });
  label.textContent = Math.round(target);
  svg.appendChild(label);

  const tip = el('div.chart-tip');
  attachScrubber(svg, tip, bars.length, (i, px) => {
    const b = bars[i];
    return {
      x: px,
      html: b.value
        ? `<b>${Math.round(b.value)} g protein</b><span>${fmtDay(b.date)} · target ${Math.round(b.target)} g</span>`
        : `<b>Not logged</b><span>${fmtDay(b.date)}</span>`,
    };
  });

  return wrap(svg, tip);
}

/* ================= heatmap ================= */

/**
 * Consistency calendar, newest column on the right.
 * cells: [{ date, level 0-4, title }]  — laid out Mon..Sun down each column.
 */
export function heatmap(cells) {
  const cols = Math.ceil(cells.length / 7);
  const grid = el('div.heat', { style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
  cells.forEach((c) => {
    grid.appendChild(el(`i.l${c.level}`, { title: c.title }));
  });
  return grid;
}

/* ================= sparkline ================= */

export function sparkline(values, { height = 34, colorVar = 'var(--accent)' } = {}) {
  const svg = svgEl('svg', { class: 'spark', viewBox: `0 0 100 ${height}`, preserveAspectRatio: 'none' });
  const clean = values.filter((v) => typeof v === 'number');
  if (clean.length < 2) return svg;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const pts = values.map((v, i) => (typeof v === 'number'
    ? [(i / (values.length - 1)) * 100, height - 3 - ((v - min) / span) * (height - 6)]
    : null)).filter(Boolean);
  const path = svgEl('path', { d: smoothPath(pts), fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' });
  path.style.stroke = colorVar;
  svg.appendChild(path);
  return svg;
}

/* ================= shared interaction ================= */

/**
 * Maps pointer position to a data index and drives the floating tooltip.
 * resolve(i, xPx) returns { x, html } or null; onLeave clears chart-side state.
 */
function attachScrubber(svg, tip, count, resolve, onLeave) {
  if (!count) return;
  let active = false;

  const show = (clientX) => {
    const box = svg.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    const i = Math.min(count - 1, Math.floor(rel * count));
    const px = box.width * ((i + 0.5) / count);
    const res = resolve(i, px);
    if (!res) return;
    tip.innerHTML = res.html;
    tip.classList.add('on');
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.max(half + 2, Math.min(box.width - half - 2, res.x))}px`;
  };

  const hide = () => {
    active = false;
    tip.classList.remove('on');
    if (onLeave) onLeave();
  };

  svg.style.touchAction = 'pan-y';
  svg.addEventListener('pointerdown', (e) => {
    active = true;
    svg.setPointerCapture(e.pointerId);
    show(e.clientX);
  });
  svg.addEventListener('pointermove', (e) => {
    if (active || e.pointerType === 'mouse') show(e.clientX);
  });
  svg.addEventListener('pointerup', hide);
  svg.addEventListener('pointercancel', hide);
  svg.addEventListener('pointerleave', () => { if (!active) hide(); });
}

/**
 * Count-up for any element carrying data-count. The final value is written first
 * so a stalled rAF (hidden tab) can never leave a zero on screen.
 */
export function runCounters(root) {
  const nodes = [...root.querySelectorAll('[data-count]')];
  if (!nodes.length) return;
  nodes.forEach((n) => { n.textContent = Number(n.dataset.count).toLocaleString(); });
  if (reduceMotion() || document.hidden) return;
  const start = performance.now();
  const dur = 700;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    nodes.forEach((n) => {
      const target = Number(n.dataset.count) || 0;
      n.textContent = Math.round(target * eased).toLocaleString();
    });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export { clear };
