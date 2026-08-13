// Hand-rolled inline-SVG charts. No dependencies, no network, theme-aware via CSS.

import { svgEl } from './ui.js';
import { fmtShort } from './dates.js';

const W = 320; // viewBox width; the SVG scales to its container
const PAD_L = 30;
const PAD_R = 6;
const PAD_T = 8;
const PAD_B = 18;

function frame(height) {
  // viewBox scales with the container; aspect ratio is preserved so text never stretches
  return svgEl('svg', {
    class: 'chart',
    viewBox: `0 0 ${W} ${height}`,
    role: 'img',
  });
}

function niceTicks(min, max, count = 3) {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/**
 * Weight chart: raw weigh-ins as dots, rolling trend as a line.
 * series: [{ date, raw|null, trend|null }]
 */
export function weightChart(series, { height = 150 } = {}) {
  const svg = frame(height);
  const values = series.flatMap((p) => [p.raw, p.trend]).filter((v) => typeof v === 'number');
  if (values.length < 2) {
    const t = svgEl('text', { x: W / 2, y: height / 2, 'text-anchor': 'middle', class: 'axis' });
    t.textContent = 'Not enough weigh-ins yet';
    svg.appendChild(t);
    return svg;
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  const pad = Math.max(0.4, (max - min) * 0.18);
  min -= pad; max += pad;

  const plotW = W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const x = (i) => PAD_L + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const y = (v) => PAD_T + plotH - ((v - min) / (max - min)) * plotH;

  niceTicks(min, max, 3).forEach((v) => {
    svg.appendChild(svgEl('line', { class: 'grid', x1: PAD_L, x2: W - PAD_R, y1: y(v), y2: y(v) }));
    const label = svgEl('text', { class: 'axis', x: 0, y: y(v) + 3 });
    label.textContent = v.toFixed(1);
    svg.appendChild(label);
  });

  // trend line, broken into runs so gaps do not draw through empty stretches
  let run = [];
  const flush = () => {
    if (run.length > 1) {
      svg.appendChild(svgEl('path', { class: 'trend', d: run.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') }));
    }
    run = [];
  };
  series.forEach((p, i) => {
    if (typeof p.trend === 'number') run.push([x(i), y(p.trend)]);
    else flush();
  });
  flush();

  series.forEach((p, i) => {
    if (typeof p.raw !== 'number') return;
    svg.appendChild(svgEl('circle', { class: 'dot', cx: x(i), cy: y(p.raw), r: 1.9 }));
  });

  [0, series.length - 1].forEach((i, n) => {
    const label = svgEl('text', { class: 'axis', x: x(i), y: height - 4, 'text-anchor': n ? 'end' : 'start' });
    label.textContent = fmtShort(series[i].date);
    svg.appendChild(label);
  });

  return svg;
}

/**
 * Daily calories vs target.
 * bars: [{ date, value, target, state: 'good'|'warn'|null }]
 */
export function caloriesChart(bars, { height = 150 } = {}) {
  const svg = frame(height);
  if (!bars.length) return svg;

  const max = Math.max(...bars.map((b) => Math.max(b.value || 0, b.target || 0))) * 1.12 || 1;
  const plotW = W - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const slot = plotW / bars.length;
  const barW = Math.max(2, slot * 0.66);
  const y = (v) => PAD_T + plotH - (v / max) * plotH;

  niceTicks(0, max, 3).forEach((v) => {
    svg.appendChild(svgEl('line', { class: 'grid', x1: PAD_L, x2: W - PAD_R, y1: y(v), y2: y(v) }));
    const label = svgEl('text', { class: 'axis', x: 0, y: y(v) + 3 });
    label.textContent = Math.round(v / 100) * 100;
    svg.appendChild(label);
  });

  bars.forEach((b, i) => {
    const cx = PAD_L + slot * i + slot / 2;
    const h = Math.max(0, plotH - (y(b.value || 0) - PAD_T));
    if (b.value) {
      svg.appendChild(svgEl('rect', {
        class: `barfill${b.state ? ` ${b.state}` : ''}`,
        x: cx - barW / 2, y: y(b.value), width: barW, height: h, rx: 1.5,
      }));
    }
  });

  // stepped target line so target changes mid-block stay visible
  const steps = [];
  bars.forEach((b, i) => {
    if (!b.target) return;
    const x0 = PAD_L + slot * i;
    const x1 = x0 + slot;
    steps.push(`M${x0.toFixed(1)},${y(b.target).toFixed(1)} L${x1.toFixed(1)},${y(b.target).toFixed(1)}`);
  });
  if (steps.length) svg.appendChild(svgEl('path', { class: 'target', d: steps.join(' ') }));

  [0, bars.length - 1].forEach((i, n) => {
    const label = svgEl('text', {
      class: 'axis',
      x: PAD_L + slot * i + slot / 2,
      y: height - 4,
      'text-anchor': n ? 'end' : 'start',
    });
    label.textContent = fmtShort(bars[i].date);
    svg.appendChild(label);
  });

  return svg;
}
