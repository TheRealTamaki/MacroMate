// Foods — personal library and saved meals (presets).

import * as store from '../store.js';
import { portionMacros } from '../calc.js';
import { el, openSheet, field, toast, fmt, clear, confirmSheet } from '../ui.js';
import { openPicker, openPortion, openFoodEditor, macroLine, foodSubtitle, portionLabel, presetTotals } from '../pickers.js';

let mode = 'foods';
let query = '';
let showArchived = false;

export function render(root) {
  const seg = el('div.seg.accent', { style: { marginBottom: '12px' } });
  [['foods', 'Foods'], ['presets', 'Meals']].forEach(([value, label]) => {
    seg.appendChild(el('button', {
      type: 'button',
      class: mode === value ? 'on' : '',
      onclick: () => { mode = value; query = ''; rerender(); },
    }, label));
  });
  root.appendChild(seg);

  if (mode === 'foods') renderFoods(root);
  else renderPresets(root);

  root.appendChild(el('button.fab', {
    'aria-label': mode === 'foods' ? 'New food' : 'New meal',
    onclick: () => (mode === 'foods'
      ? openFoodEditor({ onSave: () => toast('Food saved') })
      : openPresetEditor(null)),
  }, '+'));
}

function rerender() {
  import('../app.js').then((m) => m.refresh());
}

/* ---------------- foods ---------------- */

function renderFoods(root) {
  const all = store.listFoods({ includeArchived: showArchived });

  const search = el('input', {
    type: 'search',
    placeholder: 'Search your foods…',
    value: query,
    autocomplete: 'off',
  });
  search.addEventListener('input', () => {
    query = search.value;
    paint();
  });
  root.appendChild(el('div.field', search));

  const listWrap = el('div');
  root.appendChild(listWrap);

  function paint() {
    const qq = query.trim().toLowerCase();
    const shown = all.filter((f) => !qq || f.name.toLowerCase().includes(qq) || (f.brand || '').toLowerCase().includes(qq));
    clear(listWrap);

    if (!all.length) {
      listWrap.appendChild(el('div.empty-state', [
        el('strong', 'No foods yet'),
        'Add the things you eat often. Each one is entered once, then logged in a couple of taps forever after.',
      ]));
      return;
    }
    if (!shown.length) {
      listWrap.appendChild(el('div.empty-state', [el('strong', 'No matches'), 'Nothing in your library matches that.']));
      return;
    }

    const list = el('div.list');
    shown.forEach((f) => {
      list.appendChild(el('button.row', {
        type: 'button',
        onclick: () => openFoodEditor({ food: f, onSave: () => toast('Saved'), onDeleted: () => {} }),
      }, [
        el('div.row-main', [
          el('strong', f.archived ? `${f.name} (archived)` : f.name),
          el('small', foodSubtitle(f)),
        ]),
        el('div.row-side', [el('small', f.usedCount ? `${f.usedCount}×` : '')]),
      ]));
    });
    listWrap.appendChild(list);

    const archivedCount = store.listFoods({ includeArchived: true }).filter((f) => f.archived).length;
    if (archivedCount) {
      listWrap.appendChild(el('button.btn.sm.ghost', {
        style: { marginTop: '12px' },
        onclick: () => { showArchived = !showArchived; rerender(); },
      }, showArchived ? 'Hide archived' : `Show ${archivedCount} archived`));
    }
  }

  paint();
}

/* ---------------- presets ---------------- */

function renderPresets(root) {
  const presets = store.listPresets();
  if (!presets.length) {
    root.appendChild(el('div.empty-state', [
      el('strong', 'No saved meals yet'),
      'Group foods you eat together — a shake, a prepped lunch — and log the whole thing in one tap.',
    ]));
    return;
  }

  const list = el('div.list');
  presets.forEach((p) => {
    const totals = presetTotals(p);
    list.appendChild(el('button.row', {
      type: 'button',
      onclick: () => openPresetEditor(p),
    }, [
      el('div.row-main', [
        el('strong', p.name),
        el('small', `${p.items.length} item${p.items.length === 1 ? '' : 's'}`),
      ]),
      el('div.row-side', [el('b', fmt.int(totals.kcal)), macroLine(totals)]),
    ]));
  });
  root.appendChild(list);
}

function openPresetEditor(preset) {
  const draft = {
    id: preset?.id,
    name: preset?.name || '',
    items: (preset?.items || []).map((it) => ({ ...it })),
  };

  const sheet = openSheet({ title: preset ? 'Edit meal' : 'New meal' });
  const nameIn = el('input', { type: 'text', value: draft.name, placeholder: 'Post-workout shake' });
  const itemsWrap = el('div');
  const totalWrap = el('div.card.tight', { style: { marginTop: '12px', marginBottom: 0 } });

  function paint() {
    clear(itemsWrap);
    if (!draft.items.length) {
      itemsWrap.appendChild(el('div.empty-state', { style: { padding: '18px 8px' } }, 'No items yet.'));
    } else {
      const list = el('div.list');
      draft.items.forEach((it, i) => {
        const food = store.getFood(it.foodId);
        if (!food) {
          list.appendChild(el('div.row.empty', 'Missing food'));
          return;
        }
        const m = portionMacros(food, it.qty, it.unit, it.servingName);
        list.appendChild(el('button.row', {
          type: 'button',
          onclick: () => openPortion({
            food,
            initial: it,
            submitLabel: 'Save',
            onDelete: () => { draft.items.splice(i, 1); paint(); },
            onSubmit: (r) => {
              draft.items[i] = { foodId: food.id, qty: r.qty, unit: r.unit, servingName: r.servingName };
              paint();
            },
          }),
        }, [
          el('div.row-main', [
            el('strong', food.name),
            el('small', portionLabel({ ...it, unitName: food.unitName })),
          ]),
          el('div.row-side', [el('b', fmt.int(m.kcal)), macroLine(m)]),
        ]));
      });
      itemsWrap.appendChild(list);
    }

    itemsWrap.appendChild(el('button.btn.block.ghost', {
      style: { marginTop: '10px' },
      onclick: () => openPicker({
        title: 'Add to meal',
        presets: false,
        onFood: (food) => openPortion({
          food,
          submitLabel: 'Add to meal',
          onSubmit: (r) => {
            draft.items.push({ foodId: food.id, qty: r.qty, unit: r.unit, servingName: r.servingName });
            paint();
          },
        }),
      }),
    }, '+ Add food'));

    const totals = { kcal: 0, p: 0, c: 0, f: 0 };
    draft.items.forEach((it) => {
      const food = store.getFood(it.foodId);
      if (!food) return;
      const m = portionMacros(food, it.qty, it.unit, it.servingName);
      totals.kcal += m.kcal; totals.p += m.p; totals.c += m.c; totals.f += m.f;
    });
    clear(totalWrap);
    totalWrap.appendChild(el('div.kcal-row', [
      el('div.kcal-big', [fmt.int(totals.kcal), el('span', ' kcal')]),
      el('div.kcal-left', macroLine(totals)),
    ]));
  }

  sheet.body.appendChild(field('Name', nameIn));
  sheet.body.appendChild(el('div.label', 'Items'));
  sheet.body.appendChild(itemsWrap);
  sheet.body.appendChild(totalWrap);
  paint();

  sheet.setFooter([
    preset ? el('button.btn.danger', {
      onclick: async () => {
        const ok = await confirmSheet({
          title: 'Delete meal',
          message: `Delete "${preset.name}"? Days you already logged it on are unaffected.`,
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!ok) return;
        store.deletePreset(preset.id);
        sheet.close();
        toast('Meal deleted');
      },
    }, 'Delete') : null,
    el('button.btn.primary', {
      onclick: () => {
        if (!nameIn.value.trim()) { toast('Give the meal a name'); return; }
        if (!draft.items.length) { toast('Add at least one food'); return; }
        store.savePreset({ ...draft, name: nameIn.value });
        sheet.close();
        toast('Meal saved');
      },
    }, 'Save'),
  ].filter(Boolean));

  if (!draft.name) setTimeout(() => nameIn.focus(), 60);
}
