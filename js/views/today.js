// Today — the core logging screen.

import * as store from '../store.js';
import { dayTotals, portionMacros } from '../calc.js';
import { todayKey, addDays, fmtDay, diffDays, relativeLabel } from '../dates.js';
import { el, progressBar, openSheet, field, numberInput, toast, fmt, clear } from '../ui.js';
import { openPicker, openPortion, openQuickAdd, macroLine, portionLabel, presetTotals } from '../pickers.js';

let selected = todayKey();

export function render(root) {
  const profile = store.getProfile();
  const targets = store.getTargets();
  const day = store.getDay(selected);
  const totals = dayTotals(day);
  const dayTargets = day.targets || { kcal: targets.kcal, p: targets.proteinG, c: targets.carbsG, f: targets.fatG };

  root.appendChild(dateBar());

  if (targets.source === 'placeholder') {
    root.appendChild(el('div.notice', [
      el('div', { style: { flex: '1' } }, [
        el('b', 'Set your targets'),
        el('span.hint', { style: { marginTop: '2px' } }, 'Using placeholder numbers until you run the calculator.'),
      ]),
      el('a.btn.sm.primary', { href: '#/settings' }, 'Set up'),
    ]));
  }

  root.appendChild(totalsCard(totals, dayTargets));
  root.appendChild(weightRow());

  profile.mealNames.forEach((name, i) => {
    root.appendChild(mealSection(name, i, day));
  });

  root.appendChild(el('div.spacer'));
}

/* ---------------- date bar ---------------- */

function dateBar() {
  const delta = diffDays(selected, todayKey());
  const picker = el('input', {
    type: 'date',
    value: selected,
    onchange: (e) => { if (e.target.value) go(e.target.value); },
  });

  return el('div.datebar', [
    el('button.btn.icon.ghost', { onclick: () => go(addDays(selected, -1)), 'aria-label': 'Previous day' }, '‹'),
    el('div.datebar-mid', [
      el('strong', fmtDay(selected)),
      el('small', delta === 0 ? 'Today' : relativeLabel(selected)),
      picker,
    ]),
    el('button.btn.icon.ghost', {
      onclick: () => go(addDays(selected, 1)),
      'aria-label': 'Next day',
      disabled: delta >= 0,
    }, '›'),
    delta !== 0 ? el('button.btn.sm.ghost', { onclick: () => go(todayKey()) }, 'Today') : null,
  ].filter(Boolean));
}

function go(dateKey) {
  selected = dateKey;
  rerender();
}

function rerender() {
  import('../app.js').then((m) => m.refresh());
}

/* ---------------- totals ---------------- */

function totalsCard(totals, t) {
  const left = t.kcal - totals.kcal;
  const card = el('div.card', [
    el('div.kcal-row', [
      el('div.kcal-big', [fmt.int(totals.kcal), el('span', ` / ${fmt.int(t.kcal)} kcal`)]),
      el('div.kcal-left', [
        left >= 0 ? 'left' : 'over',
        el('b', fmt.int(Math.abs(left))),
      ]),
    ]),
    progressBar(t.kcal ? totals.kcal / t.kcal : 0),
    el('div.macro-grid', [
      macroTile('p', 'Protein', totals.p, t.p),
      macroTile('c', 'Carbs', totals.c, t.c),
      macroTile('f', 'Fat', totals.f, t.f),
    ]),
  ]);
  return card;
}

function macroTile(cls, label, value, target) {
  const left = target - value;
  return el(`div.macro.${cls}`, [
    el('div.macro-name', label),
    el('div.macro-val', [`${Math.round(value)}`, el('small', ` / ${Math.round(target)} g`)]),
    progressBar(target ? value / target : 0),
    el('div.macro-left', left >= 0 ? `${Math.round(left)} g left` : `${Math.round(-left)} g over`),
  ]);
}

/* ---------------- weigh-in ---------------- */

function weightRow() {
  const weights = store.getWeights();
  const existing = weights[selected];
  return el('button.btn.block.ghost', {
    style: { marginBottom: '12px', justifyContent: 'space-between' },
    onclick: () => openWeightSheet(selected),
  }, [
    el('span', existing !== undefined ? 'Weight logged' : 'Log weight'),
    el('strong', existing !== undefined ? fmt.kg(existing) : '—'),
  ]);
}

export function openWeightSheet(dateKey) {
  const weights = store.getWeights();
  const last = store.latestWeight();
  const input = numberInput({
    value: weights[dateKey] ?? (last ? last.kg : store.getProfile().weightKg),
    style: { fontSize: '22px', fontWeight: '700', textAlign: 'center' },
  });
  const sheet = openSheet({ title: `Weight · ${fmtDay(dateKey)}` });
  sheet.body.appendChild(field('Body weight (kg)', input));
  if (last && last.date !== dateKey) {
    sheet.body.appendChild(el('div.hint', `Last weigh-in: ${fmt.kg(last.kg)} on ${fmtDay(last.date)}.`));
  }
  sheet.setFooter([
    weights[dateKey] !== undefined
      ? el('button.btn.danger', { onclick: () => { store.setWeight(dateKey, null); sheet.close(); toast('Weigh-in removed'); } }, 'Remove')
      : null,
    el('button.btn.primary', {
      onclick: () => {
        const v = Number(input.value);
        if (!v || v <= 0) { toast('Enter a weight'); return; }
        store.setWeight(dateKey, Math.round(v * 10) / 10);
        sheet.close();
        toast('Weight saved');
      },
    }, 'Save'),
  ].filter(Boolean));
  setTimeout(() => { input.focus(); input.select(); }, 60);
}

/* ---------------- meals ---------------- */

function mealSection(name, index, day) {
  const entries = day.entries.filter((e) => e.meal === index);
  const subtotal = entries.reduce((n, e) => n + (e.kcal || 0), 0);

  const list = el('div.list');
  entries.forEach((entry) => {
    list.appendChild(el('button.row', {
      type: 'button',
      onclick: () => openEntrySheet(entry),
    }, [
      el('div.row-main', [
        el('strong', entry.name),
        el('small', entry.kind === 'quick' ? 'Quick add' : portionLabel(entry)),
      ]),
      el('div.row-side', [
        el('b', fmt.int(entry.kcal)),
        macroLine(entry),
      ]),
    ]));
  });

  list.appendChild(el('button.row.add', { type: 'button', onclick: () => startAdd(index) }, '+ Add'));

  return el('div.meal', [
    el('div.meal-head', [
      el('h3', name),
      el('span', subtotal ? `${fmt.int(subtotal)} kcal` : ''),
    ]),
    list,
  ]);
}

/* ---------------- logging flow ---------------- */

function startAdd(meal) {
  openPicker({
    title: `Add to ${store.getProfile().mealNames[meal]}`,
    onFood: (food) => openPortionFor(food, meal),
    onPreset: (preset) => openPresetLogger(preset, meal),
    onQuick: () => openQuickAdd({
      onSubmit: (q) => {
        store.addEntries(selected, [{ meal, kind: 'quick', foodId: null, name: q.name, qty: 1, unit: 'unit', servingName: null, p: q.p, c: q.c, f: q.f, kcal: q.kcal }]);
        toast('Added');
      },
    }),
  });
}

function openPortionFor(food, meal) {
  openPortion({
    food,
    submitLabel: `Add to ${store.getProfile().mealNames[meal]}`,
    onSubmit: (r) => {
      store.markFoodUsed(food.id, { qty: r.qty, unit: r.unit, servingName: r.servingName });
      store.addEntries(selected, [{
        meal,
        kind: 'food',
        foodId: food.id,
        name: food.name,
        unitName: food.per === 'unit' ? (food.unitName || 'unit') : null,
        qty: r.qty, unit: r.unit, servingName: r.servingName,
        p: r.p, c: r.c, f: r.f, kcal: r.kcal,
      }]);
      toast('Added');
    },
  });
}

function openPresetLogger(preset, meal) {
  let scale = 1;
  const sheet = openSheet({ title: preset.name });
  const listWrap = el('div.list', { style: { marginBottom: '12px' } });
  const totalWrap = el('div.card.tight', { style: { marginBottom: 0 } });

  function paint() {
    clear(listWrap);
    preset.items.forEach((it) => {
      const food = store.getFood(it.foodId);
      if (!food) {
        listWrap.appendChild(el('div.row.empty', 'Missing food (deleted)'));
        return;
      }
      const m = portionMacros(food, it.qty * scale, it.unit, it.servingName);
      listWrap.appendChild(el('div.row', [
        el('div.row-main', [
          el('strong', food.name),
          el('small', portionLabel({ qty: it.qty * scale, unit: it.unit, servingName: it.servingName, unitName: food.unitName })),
        ]),
        el('div.row-side', [el('b', fmt.int(m.kcal)), macroLine(m)]),
      ]));
    });
    const t = presetTotals(preset, scale);
    clear(totalWrap);
    totalWrap.appendChild(el('div.kcal-row', [
      el('div.kcal-big', [fmt.int(t.kcal), el('span', ' kcal')]),
      el('div.kcal-left', macroLine(t)),
    ]));
  }

  const chips = el('div.chips', { style: { marginBottom: '12px' } });
  [0.5, 1, 1.5, 2].forEach((v) => {
    chips.appendChild(el('button.chip' + (v === 1 ? '.on' : ''), {
      type: 'button',
      onclick: (e) => {
        scale = v;
        [...chips.children].forEach((c) => c.classList.remove('on'));
        e.currentTarget.classList.add('on');
        paint();
      },
    }, `×${fmt.qty(v)}`));
  });

  sheet.body.appendChild(el('div.label', 'Portion'));
  sheet.body.appendChild(chips);
  sheet.body.appendChild(listWrap);
  sheet.body.appendChild(totalWrap);
  paint();

  sheet.setFooter(el('button.btn.primary', {
    onclick: () => {
      const entries = [];
      preset.items.forEach((it) => {
        const food = store.getFood(it.foodId);
        if (!food) return;
        const qty = it.qty * scale;
        const m = portionMacros(food, qty, it.unit, it.servingName);
        entries.push({
          meal, kind: 'food', foodId: food.id, name: food.name,
          unitName: food.per === 'unit' ? (food.unitName || 'unit') : null,
          qty, unit: it.unit, servingName: it.servingName,
          p: m.p, c: m.c, f: m.f, kcal: m.kcal,
        });
        store.markFoodUsed(food.id, { qty });
      });
      if (!entries.length) { toast('This meal has no usable items'); return; }
      store.markPresetUsed(preset.id);
      store.addEntries(selected, entries);
      sheet.close();
      toast(`Added ${entries.length} item${entries.length === 1 ? '' : 's'}`);
    },
  }, `Add ${preset.items.length} item${preset.items.length === 1 ? '' : 's'}`));
}

/* ---------------- entry editing ---------------- */

function openEntrySheet(entry) {
  const dateKey = selected;
  const mealNames = store.getProfile().mealNames;
  const food = entry.foodId ? store.getFood(entry.foodId) : null;

  const sheet = openSheet({ title: entry.name });
  sheet.body.appendChild(el('div.card.tight', { style: { marginBottom: '14px' } }, [
    el('div.kcal-row', [
      el('div.kcal-big', [fmt.int(entry.kcal), el('span', ' kcal')]),
      el('div.kcal-left', macroLine(entry)),
    ]),
    el('div.hint', entry.kind === 'quick' ? 'Quick add' : portionLabel(entry)),
  ]));

  sheet.body.appendChild(el('div.label', 'Meal'));
  const mealSeg = el('div.seg');
  mealNames.forEach((n, i) => {
    mealSeg.appendChild(el('button', {
      type: 'button',
      class: i === entry.meal ? 'on' : '',
      onclick: () => {
        store.updateEntry(dateKey, entry.id, { meal: i });
        sheet.close();
      },
    }, n));
  });
  sheet.body.appendChild(mealSeg);

  sheet.setFooter([
    el('button.btn.danger', {
      onclick: () => {
        const removed = store.deleteEntry(dateKey, entry.id);
        sheet.close();
        toast('Removed', {
          action: () => store.restoreEntry(dateKey, removed),
          actionLabel: 'Undo',
        });
      },
    }, 'Delete'),
    food
      ? el('button.btn.primary', {
        onclick: () => {
          sheet.close();
          openPortion({
            food,
            initial: { qty: entry.qty, unit: entry.unit, servingName: entry.servingName },
            submitLabel: 'Save',
            onSubmit: (r) => {
              store.updateEntry(dateKey, entry.id, {
                qty: r.qty, unit: r.unit, servingName: r.servingName,
                p: r.p, c: r.c, f: r.f, kcal: r.kcal,
              });
              toast('Updated');
            },
          });
        },
      }, 'Change portion')
      : el('button.btn.primary', {
        onclick: () => {
          sheet.close();
          openQuickAdd({
            onSubmit: (q) => {
              store.updateEntry(dateKey, entry.id, { name: q.name, p: q.p, c: q.c, f: q.f, kcal: q.kcal });
              toast('Updated');
            },
          });
        },
      }, 'Edit'),
  ]);
}

export function selectedDate() {
  return selected;
}
