// Progress — the dashboard. Overview, weight and macros, each with its own charts.

import * as store from '../store.js';
import {
  trendSeries, weightTrendSummary, gradeDay, adherenceOver, currentStreak,
  calcTargets, sumEntries, trendAt,
} from '../calc.js';
import {
  todayKey, addDays, lastNDays, rangeKeys, weekStart, isoWeekNumber, fmtShort, fmtDay, diffDays,
} from '../dates.js';
import { el, fmt, clear } from '../ui.js';
import { weightChart, caloriesChart, macroStack, proteinChart, heatmap, sparkline, macroRing, runCounters } from '../charts.js';
import { openWeightSheet } from './today.js';

let tab = 'overview';
let weightRange = 84;

export function render(root) {
  const today = todayKey();
  const targets = store.getTargets();
  const profile = store.getProfile();
  const weights = store.getWeights();
  const days = store.getDaysInRange(addDays(today, -400), today);
  const fallback = { kcal: targets.kcal, p: targets.proteinG, c: targets.carbsG, f: targets.fatG };
  const ctx = { today, targets, profile, weights, days, fallback };

  const seg = el('div.seg.accent', { style: { marginBottom: '12px' } });
  [['overview', 'Overview'], ['weight', 'Weight'], ['macros', 'Macros']].forEach(([value, label]) => {
    seg.appendChild(el('button', {
      type: 'button',
      class: tab === value ? 'on' : '',
      onclick: () => { tab = value; rerender(); },
    }, label));
  });
  root.appendChild(seg);

  const logged = Object.values(days).filter((d) => d.entries && d.entries.length).length;
  if (!logged) {
    root.appendChild(el('div.empty-state', [
      el('strong', 'Nothing to chart yet'),
      'Log a couple of days and your trends, streak and averages appear here.',
    ]));
    return;
  }

  if (tab === 'overview') renderOverview(root, ctx);
  else if (tab === 'weight') renderWeight(root, ctx);
  else renderMacros(root, ctx);

  root.appendChild(el('div.spacer'));
  runCounters(root);
}

function rerender() {
  import('../app.js').then((m) => m.refresh());
}

/* ================= overview ================= */

function renderOverview(root, { today, days, weights, profile, fallback }) {
  const streak = currentStreak(days, today, fallback);
  const a28 = adherenceOver(days, lastNDays(today, 28), fallback);
  const week = lastNDays(today, 7).map((k) => (days[k] ? sumEntries(days[k].entries).kcal : null));
  const loggedWeek = week.filter((v) => v);
  const avgKcal = loggedWeek.length ? loggedWeek.reduce((a, b) => a + b, 0) / loggedWeek.length : 0;
  const summary = weightTrendSummary(weights);
  const goal = calcTargets(profile, summary && summary.trend ? summary.trend : store.currentWeightKg());

  const kcalDelta = avgKcal ? avgKcal - fallback.kcal : 0;

  root.appendChild(el('div.hero', [
    el('div.hero-tile.flame', [
      el('div.label', 'Streak'),
      el('b', { 'data-count': streak }, '0'),
      el('small', streak === 0 ? 'log a day on target' : streak === 1 ? 'day on target' : 'days on target'),
    ]),
    el('div.hero-tile', [
      el('div.label', 'Adherence 28d'),
      el('b', a28.rate === null ? '—' : `${Math.round(a28.rate * 100)}%`),
      el('small', `${a28.logged} of 28 days logged`),
    ]),
    el('div.hero-tile', { style: { gridColumn: '1 / -1' } }, [
      el('div.label', '7-day average'),
      el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px' } }, [
        el('b', avgKcal ? fmt.int(avgKcal) : '—'),
        el('span.delta' + (Math.abs(kcalDelta) <= Math.max(fallback.kcal * 0.05, 100) ? '.good' : '.warn'),
          avgKcal ? `${kcalDelta > 0 ? '+' : '−'}${fmt.int(Math.abs(kcalDelta))} vs target` : ''),
      ]),
      el('div.hero-spark', sparkline(week)),
    ]),
    summary ? el('div.hero-tile', [
      el('div.label', 'Trend weight'),
      el('b', fmt.kg(summary.trend)),
      el('small', `latest ${fmt.kg(summary.latestKg)}`),
    ]) : null,
    summary ? el('div.hero-tile', [
      el('div.label', 'Per week'),
      el('b', summary.weeklyKg === null ? '—' : `${fmt.signed(summary.weeklyKg, 2)}`),
      el('small', summary.weeklyKg === null ? 'needs ~2 weeks' : `goal ${fmt.signed(goal.weeklyKg, 2)} kg`),
    ]) : null,
  ].filter(Boolean)));

  root.appendChild(caloriesCard(days, today, fallback));
  root.appendChild(consistencyCard(days, today, fallback));
  root.appendChild(weeklyCard(days, today));
}

function caloriesCard(days, today, fallback) {
  const bars = lastNDays(today, 28).map((k) => {
    const g = gradeDay(days[k], fallback);
    return {
      date: k,
      value: g.logged ? g.totals.kcal : 0,
      target: (days[k] && days[k].targets ? days[k].targets.kcal : fallback.kcal),
      state: g.logged ? (g.adherent ? 'good' : 'warn') : null,
      detail: g.logged ? `${Math.round(g.totals.p)}P ${Math.round(g.totals.c)}C ${Math.round(g.totals.f)}F` : null,
    };
  });
  const logged = bars.filter((b) => b.value > 0);
  const avg = logged.length ? logged.reduce((n, b) => n + b.value, 0) / logged.length : 0;

  const card = el('div.card', [
    el('div.card-head', [
      el('h2', 'Calories'),
      el('span.badge', logged.length ? `${fmt.int(avg)} avg` : 'no data'),
    ]),
  ]);
  if (!logged.length) {
    card.appendChild(el('div.empty-state', 'Log a day or two and this fills in.'));
    return card;
  }
  card.appendChild(caloriesChart(bars));
  card.appendChild(el('div.legend', [
    el('span', [el('i', { style: { background: 'var(--good)' } }), 'on target']),
    el('span', [el('i', { style: { background: 'var(--warn)' } }), 'missed']),
    el('span', [el('i', { style: { background: 'var(--muted)' } }), 'target line']),
  ]));
  card.appendChild(el('div.hint', 'Drag across the chart to read any day.'));
  return card;
}

function consistencyCard(days, today, fallback) {
  const start = weekStart(addDays(today, -83));
  const cells = rangeKeys(start, today).map((k) => {
    const g = gradeDay(days[k], fallback);
    if (!g.logged) return { date: k, level: 0, title: `${fmtShort(k)} · not logged` };
    const t = g.targets;
    const off = Math.abs(g.totals.kcal - t.kcal) / t.kcal;
    const level = off <= 0.05 ? 4 : off <= 0.10 ? 3 : off <= 0.20 ? 2 : 1;
    return {
      date: k,
      level,
      title: `${fmtShort(k)} · ${Math.round(g.totals.kcal)} of ${t.kcal} kcal · ${Math.round(g.totals.p)}g protein`,
    };
  });
  const loggedCount = cells.filter((c) => c.level > 0).length;

  return el('div.card', [
    el('div.card-head', [
      el('h2', 'Consistency'),
      el('span.badge', `${loggedCount}/${cells.length} days`),
    ]),
    heatmap(cells),
    el('div.heat-key', [
      'Off target',
      el('i.l1'), el('i.l2'), el('i.l3'), el('i.l4'),
      'Bang on',
    ]),
    el('div.hint', 'Twelve weeks, one square a day. Darker means closer to your calorie target.'),
  ]);
}

function weeklyCard(days, today) {
  const rows = [];
  let cursor = weekStart(today);
  for (let i = 0; i < 6; i++) {
    const start = cursor;
    const end = addDays(start, 6);
    const keys = rangeKeys(start, end > today ? today : end);
    const logged = keys.filter((k) => days[k] && days[k].entries && days[k].entries.length);
    if (logged.length) {
      const totals = logged.reduce((acc, k) => {
        const t = sumEntries(days[k].entries);
        acc.kcal += t.kcal; acc.p += t.p; acc.c += t.c; acc.f += t.f;
        return acc;
      }, { kcal: 0, p: 0, c: 0, f: 0 });
      rows.push({
        label: `W${isoWeekNumber(start)}`,
        sub: fmtShort(start),
        kcal: totals.kcal / logged.length,
        p: totals.p / logged.length,
        c: totals.c / logged.length,
        f: totals.f / logged.length,
        logged: logged.length,
        of: keys.length,
      });
    }
    cursor = addDays(start, -7);
  }

  const card = el('div.card', [el('div.card-head', [el('h2', 'Weekly averages')])]);
  if (!rows.length) {
    card.appendChild(el('div.empty-state', 'Nothing logged yet this block.'));
    return card;
  }

  card.appendChild(el('div.scroll-x', el('table.data', [
    el('thead', el('tr', [
      el('th', 'Week'), el('th', 'kcal'), el('th', 'P'), el('th', 'C'), el('th', 'F'), el('th', 'Days'),
    ])),
    el('tbody', rows.map((r, i) => {
      const prev = rows[i + 1];
      const delta = prev ? r.kcal - prev.kcal : null;
      return el('tr', [
        el('td', [el('strong', r.label), el('br'), el('small.muted', r.sub)]),
        el('td', [
          fmt.int(r.kcal),
          delta !== null && Math.abs(delta) > 40
            ? el('div.delta.flat', { style: { fontSize: '10.5px' } }, `${delta > 0 ? '+' : '−'}${fmt.int(Math.abs(delta))}`)
            : null,
        ]),
        el('td', Math.round(r.p)),
        el('td', Math.round(r.c)),
        el('td', Math.round(r.f)),
        el('td', `${r.logged}/${r.of}`),
      ]);
    })),
  ])));
  card.appendChild(el('div.hint', 'Averages count logged days only, so a skipped day does not fake a deficit.'));
  return card;
}

/* ================= weight ================= */

function renderWeight(root, { today, weights, profile }) {
  const keys = Object.keys(weights).sort();
  if (!keys.length) {
    root.appendChild(el('div.card', [
      el('div.empty-state', [
        el('strong', 'No weigh-ins yet'),
        'Weigh in a few mornings a week. The trend line is what matters, single readings bounce around.',
      ]),
      el('button.btn.primary.block', { onclick: () => openWeightSheet(today) }, 'Log your first weigh-in'),
    ]));
    return;
  }

  const summary = weightTrendSummary(weights);
  const goal = calcTargets(profile, summary.trend || store.currentWeightKg());
  const from = weightRange === 0 || addDays(today, -(weightRange - 1)) < keys[0]
    ? keys[0]
    : addDays(today, -(weightRange - 1));
  const span = rangeKeys(from, today);
  const series = trendSeries(weights, span);

  // projection of where the goal rate would have taken you from the first trend point
  const firstIdx = series.findIndex((p) => p.trend !== null);
  const goalLine = firstIdx === -1 ? null : series.map((p, i) => (
    i < firstIdx ? null : series[firstIdx].trend + (goal.weeklyKg / 7) * (i - firstIdx)
  ));

  const startTrend = firstIdx === -1 ? null : series[firstIdx].trend;
  const change = startTrend !== null && summary.trend !== null ? summary.trend - startTrend : null;

  root.appendChild(el('div.hero', [
    el('div.hero-tile', [
      el('div.label', 'Trend now'),
      el('b', fmt.kg(summary.trend)),
      el('small', `latest ${fmt.kg(summary.latestKg)} · ${fmtShort(summary.latestDate)}`),
    ]),
    el('div.hero-tile', [
      el('div.label', 'Per week'),
      el('b', summary.weeklyKg === null ? '—' : `${fmt.signed(summary.weeklyKg, 2)}`),
      el('small', summary.weeklyKg === null ? 'needs ~2 weeks' : `goal ${fmt.signed(goal.weeklyKg, 2)} kg`),
    ]),
    el('div.hero-tile', { style: { gridColumn: '1 / -1' } }, [
      el('div.label', `Change over ${span.length} days`),
      el('b', change === null ? '—' : `${fmt.signed(change, 1)} kg`),
      el('small', startTrend === null ? '' : `from ${fmt.kg(startTrend)} on ${fmtShort(span[firstIdx])}`),
    ]),
  ]));

  const card = el('div.card', [
    el('div.card-head', [
      el('h2', 'Trend'),
      el('span.badge', `${Object.keys(weights).length} weigh-ins`),
    ]),
    weightChart(series, { goalLine }),
  ]);
  const chips = el('div.chips', { style: { marginTop: '10px' } });
  [[28, '4w'], [84, '12w'], [0, 'All']].forEach(([v, label]) => {
    chips.appendChild(el('button.chip' + (v === weightRange ? '.on' : ''), {
      type: 'button',
      onclick: () => { weightRange = v; rerender(); },
    }, label));
  });
  card.appendChild(chips);
  card.appendChild(el('div.legend', [
    el('span', [el('i', { style: { background: 'var(--accent)' } }), '7-day trend']),
    el('span', [el('i', { style: { background: 'var(--text)', opacity: 0.55 } }), 'weigh-ins']),
    goalLine ? el('span', [el('i', { style: { background: 'var(--muted)' } }), 'goal pace']) : null,
  ].filter(Boolean)));
  if (summary.weeklyKg !== null) {
    card.appendChild(el('div.hint', paceNote(summary.weeklyKg, goal.weeklyKg, profile.goal)));
  }
  root.appendChild(card);

  const recent = keys.slice(-8).reverse();
  const list = el('div.list');
  recent.forEach((k) => {
    const t = trendAt(weights, k);
    list.appendChild(el('button.row', {
      type: 'button',
      onclick: () => openWeightSheet(k),
    }, [
      el('div.row-main', [
        el('strong', fmt.kg(weights[k])),
        el('small', fmtDay(k)),
      ]),
      el('div.row-side', [el('small', t !== null ? `trend ${t.toFixed(1)}` : '')]),
    ]));
  });
  root.appendChild(el('div.card', { style: { padding: '0', overflow: 'hidden' } }, list));
}

function paceNote(actual, goalRate, goal) {
  if (goal === 'maintain') {
    return Math.abs(actual) < 0.2
      ? 'Holding steady, which is the job on maintenance.'
      : `Drifting ${fmt.signed(actual, 2)} kg a week. Nudge calories the other way if it keeps up.`;
  }
  if (goalRate === 0) return '';
  const ratio = actual / goalRate;
  if (ratio < 0.25) return `Barely moving against a ${fmt.signed(goalRate, 2)} kg/week goal. Give it another week, then adjust calories by 5-10%.`;
  if (ratio < 0.7) return 'Slower than planned. Worth checking your logging accuracy before cutting calories further.';
  if (ratio <= 1.4) return 'On pace with your goal rate.';
  return `Moving faster than planned (${fmt.signed(actual, 2)} vs ${fmt.signed(goalRate, 2)} kg/week). ${goal === 'cut' ? 'Add some calories back to protect muscle.' : 'Ease the surplus to keep the gain leaner.'}`;
}

/* ================= macros ================= */

function renderMacros(root, { today, days, fallback, weights, profile }) {
  const week = lastNDays(today, 7).filter((k) => days[k] && days[k].entries.length);
  const avg = { p: 0, c: 0, f: 0, kcal: 0 };
  week.forEach((k) => {
    const t = sumEntries(days[k].entries);
    avg.p += t.p; avg.c += t.c; avg.f += t.f; avg.kcal += t.kcal;
  });
  if (week.length) ['p', 'c', 'f', 'kcal'].forEach((key) => { avg[key] /= week.length; });

  const bodyKg = store.currentWeightKg();

  root.appendChild(el('div.card', [
    el('div.card-head', [
      el('h2', '7-day average'),
      el('span.badge', `${week.length} day${week.length === 1 ? '' : 's'}`),
    ]),
    el('div.mrings', [
      macroRing({ label: 'Protein', value: avg.p, target: fallback.p, colorVar: 'var(--protein)' }),
      macroRing({ label: 'Carbs', value: avg.c, target: fallback.c, colorVar: 'var(--carbs)' }),
      macroRing({ label: 'Fat', value: avg.f, target: fallback.f, colorVar: 'var(--fat)' }),
    ]),
    el('div.kv', { style: { marginTop: '16px', borderTop: '1px solid var(--line)', paddingTop: '10px' } }, [
      el('span', 'Protein per kg body weight'),
      el('b', bodyKg ? `${(avg.p / bodyKg).toFixed(2)} g/kg` : '—'),
    ]),
    el('div.kv', [el('span', 'Average calories'), el('b', `${fmt.int(avg.kcal)} kcal`)]),
  ]));

  const keys = lastNDays(today, 28);
  const proteinBars = keys.map((k) => ({
    date: k,
    value: days[k] ? sumEntries(days[k].entries).p : 0,
    target: (days[k] && days[k].targets ? days[k].targets.p : fallback.p),
  }));
  const hits = proteinBars.filter((b) => b.value >= b.target * 0.9).length;
  const loggedDays = proteinBars.filter((b) => b.value > 0).length;

  root.appendChild(el('div.card', [
    el('div.card-head', [
      el('h2', 'Protein'),
      el('span.badge' + (loggedDays && hits / loggedDays >= 0.8 ? '.accent' : ''),
        loggedDays ? `${hits}/${loggedDays} days hit` : 'no data'),
    ]),
    proteinChart(proteinBars),
    el('div.hint', 'Green means you reached 90% of target. This is the number that protects muscle on a cut.'),
  ]));

  const stackBars = keys.map((k) => {
    const t = days[k] ? sumEntries(days[k].entries) : { p: 0, c: 0, f: 0 };
    return { date: k, p: t.p, c: t.c, f: t.f };
  });

  root.appendChild(el('div.card', [
    el('div.card-head', [el('h2', 'Macro split')]),
    macroStack(stackBars),
    el('div.legend', [
      el('span', [el('i', { style: { background: 'var(--protein)' } }), 'protein']),
      el('span', [el('i', { style: { background: 'var(--carbs)' } }), 'carbs']),
      el('span', [el('i', { style: { background: 'var(--fat)' } }), 'fat']),
    ]),
    el('div.hint', 'Each bar is a day, split by where the calories came from.'),
  ]));
}
