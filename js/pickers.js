// Shared sheets: food picker, portion editor, food editor, quick add.
// Used by the Today log, the Foods library and the preset editor.

import * as store from './store.js';
import { portionMacros, foodBasisKcal, kcalFromMacros, round1 } from './calc.js';
import { el, openSheet, field, numberInput, segmented, toast, fmt, clear, confirmSheet } from './ui.js';

/* ---------------- shared bits ---------------- */

export function macroLine(m) {
  return el('span.macro-mini', [
    el('i.p', `${Math.round(m.p)}P`), ' ',
    el('i.c', `${Math.round(m.c)}C`), ' ',
    el('i.f', `${Math.round(m.f)}F`),
  ]);
}

export function foodBasisLabel(food) {
  return food.per === 'unit' ? `per ${food.unitName || 'unit'}` : 'per 100 g';
}

export function foodSubtitle(food) {
  const k = Math.round(foodBasisKcal(food));
  const bits = [foodBasisLabel(food), `${k} kcal`, `${round1(food.p)}/${round1(food.c)}/${round1(food.f)}`];
  return (food.brand ? `${food.brand} · ` : '') + bits.join(' · ');
}

export function portionLabel(entry) {
  if (entry.unit === 'serving') return `${fmt.qty(entry.qty)} × ${entry.servingName}`;
  if (entry.unit === 'unit') {
    // older entries did not store the unit name, so fall back to the food itself
    const named = entry.unitName || (entry.foodId && store.getFood(entry.foodId)?.unitName);
    return named ? `${fmt.qty(entry.qty)} × ${named}` : `×${fmt.qty(entry.qty)}`;
  }
  return `${fmt.qty(entry.qty)} g`;
}

/* ---------------- food picker ---------------- */

/**
 * openPicker({ title, presets, onFood, onPreset, onQuick, submitVerb })
 * Recents first, live search, footer routes to quick-add and new-food.
 */
export function openPicker({
  title = 'Add food',
  presets = true,
  onFood,
  onPreset,
  onQuick,
  excludeIds = [],
} = {}) {
  const sheet = openSheet({ title, flush: true });
  const listWrap = el('div');
  const search = el('input', { type: 'search', placeholder: 'Search foods…', autocomplete: 'off' });
  search.addEventListener('input', () => paint(search.value.trim().toLowerCase()));

  sheet.body.appendChild(el('div.searchwrap', search));
  sheet.body.appendChild(listWrap);

  function recentScore(x) {
    return x.lastUsedAt ? `2${x.lastUsedAt}` : `1${String(x.usedCount || 0).padStart(6, '0')}`;
  }

  function paint(q = '') {
    clear(listWrap);
    const foods = store.listFoods().filter((f) => !excludeIds.includes(f.id));
    const presetList = presets ? store.listPresets() : [];

    const matches = (name) => !q || name.toLowerCase().includes(q);
    const fFoods = foods.filter((f) => matches(f.name) || matches(f.brand || ''));
    const fPresets = presetList.filter((p) => matches(p.name));

    if (!fFoods.length && !fPresets.length) {
      listWrap.appendChild(el('div.empty-state', [
        el('strong', q ? 'No matches' : 'Your library is empty'),
        q ? 'Try a different word, or create it as a new food.' : 'Add a food once and it stays here for every future log.',
      ]));
    }

    if (fPresets.length) {
      listWrap.appendChild(el('div.card-title', { style: { padding: '12px 16px 6px' } }, 'Meals'));
      const list = el('div.list', { style: { borderRadius: '0', borderLeft: 'none', borderRight: 'none' } });
      fPresets.sort((a, b) => recentScore(b).localeCompare(recentScore(a))).forEach((p) => {
        const totals = presetTotals(p);
        list.appendChild(el('button.row', { type: 'button', onclick: () => { sheet.close(); onPreset && onPreset(p); } }, [
          el('div.row-main', [
            el('strong', p.name),
            el('small', `${p.items.length} item${p.items.length === 1 ? '' : 's'}`),
          ]),
          el('div.row-side', [el('b', `${Math.round(totals.kcal)}`), macroLine(totals)]),
        ]));
      });
      listWrap.appendChild(list);
    }

    if (fFoods.length) {
      listWrap.appendChild(el('div.card-title', { style: { padding: '12px 16px 6px' } }, fPresets.length ? 'Foods' : 'Recent'));
      const list = el('div.list', { style: { borderRadius: '0', borderLeft: 'none', borderRight: 'none' } });
      fFoods.sort((a, b) => recentScore(b).localeCompare(recentScore(a))).forEach((f) => {
        list.appendChild(el('button.row', { type: 'button', onclick: () => { sheet.close(); onFood && onFood(f); } }, [
          el('div.row-main', [el('strong', f.name), el('small', foodSubtitle(f))]),
        ]));
      });
      listWrap.appendChild(list);
    }
  }

  paint();

  sheet.setFooter([
    onQuick ? el('button.btn.ghost', {
      onclick: () => { sheet.close(); onQuick(); },
    }, 'Quick add') : null,
    el('button.btn.primary', {
      onclick: () => {
        sheet.close();
        openFoodEditor({
          prefillName: search.value.trim(),
          onSave: (food) => onFood && onFood(food),
        });
      },
    }, '+ New food'),
  ].filter(Boolean));

  return sheet;
}

export function presetTotals(preset, scale = 1) {
  const total = { kcal: 0, p: 0, c: 0, f: 0 };
  preset.items.forEach((it) => {
    const food = store.getFood(it.foodId);
    if (!food) return;
    const m = portionMacros(food, it.qty * scale, it.unit, it.servingName);
    total.kcal += m.kcal; total.p += m.p; total.c += m.c; total.f += m.f;
  });
  return total;
}

/* ---------------- portion sheet ---------------- */

/**
 * openPortion({ food, initial, submitLabel, onSubmit })
 * onSubmit receives { qty, unit, servingName, ...macros }.
 */
export function openPortion({ food, initial = null, submitLabel = 'Add', onSubmit, onDelete }) {
  const isUnit = food.per === 'unit';
  const servings = food.servings || [];

  let unit = initial?.unit || (isUnit ? 'unit' : (food.lastUnit || 'g'));
  if (isUnit) unit = 'unit';
  if (unit === 'serving' && !servings.length) unit = 'g';

  let servingName = initial?.servingName || food.lastServing || (servings[0] ? servings[0].name : null);
  if (unit === 'serving' && !servings.some((s) => s.name === servingName)) {
    servingName = servings[0] ? servings[0].name : null;
  }
  let qty = initial?.qty ?? food.lastQty ?? defaultQty(unit);

  const sheet = openSheet({ title: food.name });
  const qtyInput = numberInput({ value: qty, min: 0, style: { fontSize: '20px', fontWeight: '700', textAlign: 'center' } });
  const chipRow = el('div.chips', { style: { marginTop: '10px' } });
  const preview = el('div.card.tight', { style: { marginTop: '14px', marginBottom: '0' } });

  function defaultQty(u) {
    if (u === 'unit') return 1;
    if (u === 'serving') return 1;
    return 100;
  }

  function currentServing() {
    return servings.find((s) => s.name === servingName) || null;
  }

  function update() {
    qty = Number(qtyInput.value) || 0;
    const m = portionMacros(food, qty, unit, servingName);
    clear(preview);
    const gramsNote = unit === 'serving' && currentServing()
      ? `${fmt.qty(qty * currentServing().grams)} g`
      : null;
    preview.appendChild(el('div.kcal-row', [
      el('div.kcal-big', [`${Math.round(m.kcal)}`, el('span', ' kcal')]),
      el('div.kcal-left', gramsNote ? el('b', gramsNote) : macroLine(m)),
    ]));
    if (gramsNote) preview.appendChild(el('div', { style: { textAlign: 'right' } }, macroLine(m)));
    return m;
  }

  function paintChips() {
    clear(chipRow);
    let values;
    if (unit === 'g') values = [50, 100, 150, 200, 250];
    else if (unit === 'serving') values = [0.5, 1, 1.5, 2, 3];
    else values = [1, 2, 3, 4, 6];
    if (food.lastQty && !values.includes(food.lastQty)) values = [food.lastQty, ...values].slice(0, 6);
    values.forEach((v) => {
      chipRow.appendChild(el('button.chip', {
        type: 'button',
        onclick: () => { qtyInput.value = v; update(); },
      }, unit === 'g' ? `${v} g` : `${fmt.qty(v)}`));
    });
  }

  qtyInput.addEventListener('input', update);

  // unit switcher
  const unitOptions = [];
  if (isUnit) unitOptions.push({ value: 'unit', label: food.unitName || 'unit' });
  else {
    unitOptions.push({ value: 'g', label: 'grams' });
    servings.forEach((s) => unitOptions.push({ value: `serving:${s.name}`, label: `${s.name} (${s.grams}g)` }));
  }

  if (unitOptions.length > 1) {
    const currentValue = unit === 'serving' ? `serving:${servingName}` : unit;
    sheet.body.appendChild(field('Measure', segmented(unitOptions, currentValue, (v) => {
      if (v.startsWith('serving:')) { unit = 'serving'; servingName = v.slice(8); }
      else { unit = v; servingName = null; }
      qtyInput.value = defaultQty(unit);
      paintChips();
      update();
    })));
  }

  sheet.body.appendChild(field(unit === 'g' ? 'Amount (g)' : 'Amount', qtyInput));
  sheet.body.appendChild(chipRow);
  sheet.body.appendChild(preview);
  sheet.body.appendChild(el('div.hint', { style: { marginTop: '10px' } }, foodSubtitle(food)));

  paintChips();
  update();

  sheet.setFooter([
    onDelete ? el('button.btn.danger', { onclick: () => { sheet.close(); onDelete(); } }, 'Delete') : null,
    el('button.btn.primary', {
      onclick: () => {
        const m = update();
        if (!qty || qty <= 0) { toast('Enter an amount first'); return; }
        sheet.close();
        onSubmit({ qty, unit, servingName: unit === 'serving' ? servingName : null, ...m });
      },
    }, submitLabel),
  ].filter(Boolean));

  setTimeout(() => { qtyInput.focus(); qtyInput.select(); }, 60);
  return sheet;
}

/* ---------------- quick add ---------------- */

export function openQuickAdd({ onSubmit }) {
  const sheet = openSheet({ title: 'Quick add macros' });
  const name = el('input', { type: 'text', placeholder: 'e.g. Restaurant meal' });
  const p = numberInput({ placeholder: '0' });
  const c = numberInput({ placeholder: '0' });
  const f = numberInput({ placeholder: '0' });
  const kcal = numberInput({ placeholder: 'auto' });
  const hint = el('div.hint');

  const sync = () => {
    const auto = kcalFromMacros(Number(p.value) || 0, Number(c.value) || 0, Number(f.value) || 0);
    hint.textContent = `Leave calories blank to use ${Math.round(auto)} kcal from the macros.`;
  };
  [p, c, f].forEach((i) => i.addEventListener('input', sync));
  sync();

  sheet.body.appendChild(field('Name (optional)', name));
  sheet.body.appendChild(el('div.grid-3', [
    field('Protein (g)', p), field('Carbs (g)', c), field('Fat (g)', f),
  ]));
  sheet.body.appendChild(field('Calories', kcal, null));
  sheet.body.appendChild(hint);

  sheet.setFooter(el('button.btn.primary', {
    onclick: () => {
      const P = round1(Number(p.value) || 0);
      const C = round1(Number(c.value) || 0);
      const F = round1(Number(f.value) || 0);
      const K = kcal.value === '' ? round1(kcalFromMacros(P, C, F)) : round1(Number(kcal.value) || 0);
      if (!P && !C && !F && !K) { toast('Enter at least one number'); return; }
      sheet.close();
      onSubmit({ name: name.value.trim() || 'Quick add', p: P, c: C, f: F, kcal: K });
    },
  }, 'Add'));

  setTimeout(() => name.focus(), 60);
  return sheet;
}

/* ---------------- food editor ---------------- */

export function openFoodEditor({ food = null, prefillName = '', onSave, onDeleted } = {}) {
  const editing = !!food;
  const draft = {
    id: food?.id,
    name: food?.name ?? prefillName,
    brand: food?.brand ?? '',
    per: food?.per ?? '100g',
    unitName: food?.unitName ?? '',
    p: food?.p ?? '', c: food?.c ?? '', f: food?.f ?? '',
    kcal: food?.kcal ?? '',
    servings: (food?.servings || []).map((s) => ({ ...s })),
  };

  const sheet = openSheet({ title: editing ? 'Edit food' : 'New food' });
  const nameIn = el('input', { type: 'text', value: draft.name, placeholder: 'Chicken breast' });
  const brandIn = el('input', { type: 'text', value: draft.brand, placeholder: 'Brand (optional)' });
  const unitNameIn = el('input', { type: 'text', value: draft.unitName, placeholder: 'egg, slice, scoop…' });
  const pIn = numberInput({ value: draft.p, placeholder: '0' });
  const cIn = numberInput({ value: draft.c, placeholder: '0' });
  const fIn = numberInput({ value: draft.f, placeholder: '0' });
  const kcalIn = numberInput({ value: draft.kcal, placeholder: 'auto' });
  const kcalHint = el('div.hint');
  const unitNameField = field('Unit name', unitNameIn, 'What one unit is called.');
  const servingsWrap = el('div');
  const macroLabel = el('label');

  function basisWord() {
    return draft.per === 'unit' ? `per ${unitNameIn.value.trim() || 'unit'}` : 'per 100 g';
  }
  function syncBasis() {
    unitNameField.style.display = draft.per === 'unit' ? '' : 'none';
    servingsWrap.style.display = draft.per === 'unit' ? 'none' : '';
    macroLabel.textContent = `Macros ${basisWord()}`;
    const auto = kcalFromMacros(Number(pIn.value) || 0, Number(cIn.value) || 0, Number(fIn.value) || 0);
    kcalHint.textContent = `Blank uses ${Math.round(auto)} kcal from the macros. Fill it in only to match a label that disagrees.`;
  }
  [pIn, cIn, fIn, unitNameIn].forEach((i) => i.addEventListener('input', syncBasis));

  function paintServings() {
    clear(servingsWrap);
    servingsWrap.appendChild(el('label', 'Named servings (optional)'));
    draft.servings.forEach((s, i) => {
      const nm = el('input', { type: 'text', value: s.name, placeholder: 'breast, cup, scoop' });
      const gr = numberInput({ value: s.grams, placeholder: 'grams' });
      nm.addEventListener('input', () => { s.name = nm.value; });
      gr.addEventListener('input', () => { s.grams = Number(gr.value) || 0; });
      servingsWrap.appendChild(el('div', {
        style: { display: 'grid', gridTemplateColumns: '1fr 88px 40px', gap: '8px', marginBottom: '8px' },
      }, [nm, gr, el('button.btn.icon.ghost', {
        type: 'button',
        onclick: () => { draft.servings.splice(i, 1); paintServings(); },
      }, '×')]));
    });
    servingsWrap.appendChild(el('button.btn.sm.ghost', {
      type: 'button',
      onclick: () => { draft.servings.push({ name: '', grams: 0 }); paintServings(); },
    }, '+ Add serving'));
    servingsWrap.appendChild(el('div.hint', 'Lets you log "1 scoop" or "1 breast" instead of counting grams.'));
  }

  sheet.body.appendChild(field('Name', nameIn));
  sheet.body.appendChild(field('Brand', brandIn));
  sheet.body.appendChild(field('Measured', segmented([
    { value: '100g', label: 'Per 100 g' },
    { value: 'unit', label: 'Per unit' },
  ], draft.per, (v) => { draft.per = v; syncBasis(); })));
  sheet.body.appendChild(unitNameField);
  sheet.body.appendChild(el('div.field', [
    macroLabel,
    el('div.grid-3', [
      el('div', [el('div.hint', { style: { marginTop: 0, marginBottom: '4px' } }, 'Protein'), pIn]),
      el('div', [el('div.hint', { style: { marginTop: 0, marginBottom: '4px' } }, 'Carbs'), cIn]),
      el('div', [el('div.hint', { style: { marginTop: 0, marginBottom: '4px' } }, 'Fat'), fIn]),
    ]),
  ]));
  sheet.body.appendChild(field('Calories (optional)', kcalIn));
  sheet.body.appendChild(kcalHint);
  sheet.body.appendChild(el('div.spacer'));
  sheet.body.appendChild(servingsWrap);

  paintServings();
  syncBasis();

  sheet.setFooter([
    editing ? el('button.btn.danger', {
      onclick: async () => {
        const ok = await confirmSheet({
          title: 'Delete food',
          message: `Remove "${food.name}" from your library? Anything you have already logged keeps its numbers.`,
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!ok) return;
        const res = store.deleteFood(food.id);
        sheet.close();
        toast(res.archived ? 'Food archived (it is used in your history)' : 'Food deleted');
        onDeleted && onDeleted();
      },
    }, 'Delete') : null,
    el('button.btn.primary', {
      onclick: () => {
        const name = nameIn.value.trim();
        if (!name) { toast('Give the food a name'); return; }
        if (draft.per === 'unit' && !unitNameIn.value.trim()) { toast('Name the unit (egg, slice, scoop…)'); return; }
        const saved = store.saveFood({
          id: draft.id,
          name,
          brand: brandIn.value,
          per: draft.per,
          unitName: unitNameIn.value,
          p: pIn.value, c: cIn.value, f: fIn.value,
          kcal: kcalIn.value === '' ? null : kcalIn.value,
          servings: draft.servings,
          archived: food?.archived || false,
        });
        sheet.close();
        onSave && onSave(saved);
      },
    }, editing ? 'Save' : 'Save and log'),
  ].filter(Boolean));

  if (!draft.name) setTimeout(() => nameIn.focus(), 60);
  return sheet;
}
