// Progress — weight trend, calories vs target, weekly averages, adherence.

import * as store from '../store.js';
import { trendSeries, weightTrendSummary, gradeDay, adherenceOver, currentStreak, calcTargets, sumEntries } from '../calc.js';
import { todayKey, addDays, lastNDays, rangeKeys, weekStart, isoWeekNumber, fmtShort } from '../dates.js';
import { el, fmt } from '../ui.js';
import { weightChart, caloriesChart } from '../charts.js';
import { openWeightSheet } from './today.js';

let weightRange = 84; // days

export function render(root) {
  const today = todayKey();
  const targets = store.getTargets();
  const profile = store.getProfile();
  const weights = store.getWeights();
  const days = store.getDaysInRange(addDays(today, -400), today);
  const fallback = { kcal: targets.kcal, p: targets.proteinG, c: targets.carbsG, f: targets.fatG };

  root.appendChild(weightCard(weights, profile, today));
  root.appendChild(caloriesCard(days, today, fallback));
  root.appendChild(adherenceCard(days, today, fallback));
  root.appendChild(weeklyCard(days, today));
  root.appendChild(el('div.spacer'));
}

/* ---------------- weight ---------------- */

function weightCard(weights, profile, today) {
  const keys = Object.keys(weights).sort();
  const card = el('div.card');
  card.appendChild(el('div.card-head', [
    el('h2', 'Body weight'),
    el('button.btn.sm.ghost', { onclick: () => openWeightSheet(today) }, '+ Log'),
  ]));

  if (!keys.length) {
    card.appendChild(el('div.empty-state', [
      el('strong', 'No weigh-ins yet'),
      'Weigh in a few mornings a week. The trend line matters, single readings do not.',
    ]));
    return card;
  }

  const summary = weightTrendSummary(weights);
  const goal = calcTargets(profile, summary.trend || store.currentWeightKg());
  const from = weightRange === 0 ? keys[0] : addDays(today, -(weightRange - 1));
  const series = trendSeries(weights, rangeKeys(from < keys[0] ? keys[0] : from, today));

  card.appendChild(el('div.stat-row', { style: { marginBottom: '12px' } }, [
    el('div.stat', [
      el('span', 'Trend'),
      el('b', summary.trend !== null ? fmt.kg(summary.trend) : '—'),
      el('small', `latest ${fmt.kg(summary.latestKg)}`),
    ]),
    el('div.stat', [
      el('span', 'Per week'),
      el('b', summary.weeklyKg !== null ? `${fmt.signed(summary.weeklyKg, 2)} kg` : '—'),
      el('small', summary.weeklyKg === null
        ? 'needs ~2 weeks'
        : `goal ${fmt.signed(goal.weeklyKg, 2)} kg`),
    ]),
  ]));

  card.appendChild(weightChart(series));

  const rangeRow = el('div.chips', { style: { marginTop: '10px' } });
  [[28, '4w'], [84, '12w'], [0, 'All']].forEach(([v, label]) => {
    rangeRow.appendChild(el('button.chip' + (v === weightRange ? '.on' : ''), {
      type: 'button',
      onclick: () => { weightRange = v; rerender(); },
    }, label));
  });
  card.appendChild(rangeRow);

  if (summary.weeklyKg !== null) {
    card.appendChild(el('div.hint', paceNote(summary.weeklyKg, goal.weeklyKg, profile.goal)));
  }
  return card;
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

/* ---------------- calories ---------------- */

function caloriesCard(days, today, fallback) {
  const keys = lastNDays(today, 28);
  const bars = keys.map((k) => {
    const g = gradeDay(days[k], fallback);
    return {
      date: k,
      value: g.logged ? g.totals.kcal : 0,
      target: (days[k] && days[k].targets ? days[k].targets.kcal : fallback.kcal),
      state: g.logged ? (g.adherent ? 'good' : 'warn') : null,
    };
  });
  const logged = bars.filter((b) => b.value > 0);
  const avg = logged.length ? logged.reduce((n, b) => n + b.value, 0) / logged.length : 0;

  const card = el('div.card', [
    el('div.card-head', [
      el('h2', 'Calories · last 28 days'),
      el('span.badge', logged.length ? `${fmt.int(avg)} avg` : 'no data'),
    ]),
  ]);

  if (!logged.length) {
    card.appendChild(el('div.empty-state', 'Log a day or two and this fills in.'));
    return card;
  }
  card.appendChild(caloriesChart(bars));
  card.appendChild(el('div.hint', 'Dashed line is that day\'s target. Green bars hit it, amber missed.'));
  return card;
}

/* ---------------- adherence ---------------- */

function adherenceCard(days, today, fallback) {
  const streak = currentStreak(days, today, fallback);
  const a7 = adherenceOver(days, lastNDays(today, 7), fallback);
  const a28 = adherenceOver(days, lastNDays(today, 28), fallback);

  const strip = el('div.dotstrip');
  lastNDays(today, 28).forEach((k) => {
    const g = gradeDay(days[k], fallback);
    strip.appendChild(el('i' + (g.logged ? (g.adherent ? '.good' : '.warn') : ''), { title: `${fmtShort(k)} · ${g.logged ? Math.round(g.totals.kcal) + ' kcal' : 'not logged'}` }));
  });

  return el('div.card', [
    el('div.card-head', [el('h2', 'Adherence')]),
    el('div.stat-row', { style: { marginBottom: '14px' } }, [
      el('div.stat', [el('span', 'Streak'), el('b', `${streak}`), el('small', streak === 1 ? 'day on target' : 'days on target')]),
      el('div.stat', [el('span', '7 day'), el('b', pct(a7.rate)), el('small', `${a7.logged}/7 logged`)]),
      el('div.stat', [el('span', '28 day'), el('b', pct(a28.rate)), el('small', `${a28.logged}/28 logged`)]),
    ]),
    strip,
    el('div.hint', 'A day counts when calories land within 5% of target and protein reaches 90% of it.'),
  ]);
}

function pct(rate) {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/* ---------------- weekly table ---------------- */

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

  const table = el('table.data', [
    el('thead', el('tr', [
      el('th', 'Week'), el('th', 'kcal'), el('th', 'P'), el('th', 'C'), el('th', 'F'), el('th', 'Days'),
    ])),
    el('tbody', rows.map((r) => el('tr', [
      el('td', [el('strong', r.label), el('br'), el('small.muted', r.sub)]),
      el('td', fmt.int(r.kcal)),
      el('td', Math.round(r.p)),
      el('td', Math.round(r.c)),
      el('td', Math.round(r.f)),
      el('td', `${r.logged}/${r.of}`),
    ]))),
  ]);
  card.appendChild(el('div.scroll-x', table));
  card.appendChild(el('div.hint', 'Averages count logged days only, so a skipped day does not fake a deficit.'));
  return card;
}

function rerender() {
  import('../app.js').then((m) => m.refresh());
}
