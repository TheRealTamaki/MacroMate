// Settings — profile, TDEE calculator, targets, preferences, data tools.

import * as store from '../store.js';
import { calcTargets, ACTIVITY, GOALS, RATES, kcalFromMacros } from '../calc.js';
import { el, field, numberInput, segmented, toast, fmt, clear, confirmSheet, openSheet } from '../ui.js';
import { downloadBackup, readBackupFile, applyBackup, pickFile } from '../export.js';

export function render(root) {
  root.appendChild(calculatorCard());
  root.appendChild(targetsCard());
  root.appendChild(preferencesCard());
  root.appendChild(dataCard());
  root.appendChild(aboutCard());
  root.appendChild(el('div.spacer'));
}

function rerender() {
  import('../app.js').then((m) => m.refresh());
}

/* ---------------- calculator ---------------- */

function calculatorCard() {
  const profile = store.getProfile();
  const draft = { ...profile };
  const lastWeight = store.latestWeight();

  const card = el('div.card');
  card.appendChild(el('div.card-head', [el('h2', 'Your numbers')]));

  const readout = el('div');

  const weightIn = numberInput({ value: draft.weightKg });
  const heightIn = numberInput({ value: draft.heightCm });
  const ageIn = numberInput({ value: draft.age });

  [weightIn, heightIn, ageIn].forEach((input) => input.addEventListener('input', () => {
    draft.weightKg = Number(weightIn.value) || draft.weightKg;
    draft.heightCm = Number(heightIn.value) || draft.heightCm;
    draft.age = Number(ageIn.value) || draft.age;
    paint();
  }));

  card.appendChild(field('Sex', segmented([
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ], draft.sex, (v) => { draft.sex = v; paint(); })));

  card.appendChild(el('div.grid-3', [
    field('Weight (kg)', weightIn),
    field('Height (cm)', heightIn),
    field('Age', ageIn),
  ]));

  if (lastWeight && Math.abs(lastWeight.kg - draft.weightKg) > 0.05) {
    card.appendChild(el('button.btn.sm.ghost', {
      style: { marginBottom: '12px' },
      onclick: () => { weightIn.value = lastWeight.kg; draft.weightKg = lastWeight.kg; paint(); },
    }, `Use latest weigh-in (${fmt.kg(lastWeight.kg)})`));
  }

  const activitySelect = el('select', ACTIVITY.map((a) => el('option', { value: a.value, selected: a.value === draft.activity }, `${a.label} · ${a.note}`)));
  activitySelect.addEventListener('change', () => { draft.activity = activitySelect.value; paint(); });
  card.appendChild(field('Activity', activitySelect));

  card.appendChild(field('Goal', segmented(GOALS, draft.goal, (v) => {
    draft.goal = v;
    if (!RATES[v].some((r) => r.value === draft.rate)) draft.rate = RATES[v][0].value;
    rateWrap.replaceChildren(rateControl());
    paint();
  }, { accent: true })));

  const rateWrap = el('div.field');
  function rateControl() {
    return el('div', [
      el('label', draft.goal === 'maintain' ? 'Pace' : 'Pace of change'),
      segmented(RATES[draft.goal], draft.rate, (v) => { draft.rate = v; paint(); }),
    ]);
  }
  rateWrap.appendChild(rateControl());
  card.appendChild(rateWrap);

  card.appendChild(readout);

  function paint() {
    const result = calcTargets(draft, draft.weightKg);
    clear(readout);
    readout.appendChild(el('div.card.tight', { style: { background: 'var(--surface-2)', border: 'none' } }, [
      el('div.kv', [el('span', 'BMR'), el('b', `${fmt.int(result.bmr)} kcal`)]),
      el('div.kv', [el('span', 'Maintenance (TDEE)'), el('b', `${fmt.int(result.tdee)} kcal`)]),
      el('div.kv', [el('span', 'Target calories'), el('b', `${fmt.int(result.kcal)} kcal`)]),
      el('div.kv', [el('span', 'Protein / Carbs / Fat'), el('b', `${result.proteinG} / ${result.carbsG} / ${result.fatG} g`)]),
      el('div.kv', [el('span', 'Expected change'), el('b', result.adj === 0 ? 'hold weight' : `${fmt.signed(result.weeklyKg, 2)} kg / week`)]),
    ]));
    if (result.warning) readout.appendChild(el('div.hint.warn', result.warning));
    readout.appendChild(el('button.btn.primary.block', {
      style: { marginTop: '12px' },
      onclick: () => {
        store.setProfile({
          sex: draft.sex, age: draft.age, heightCm: draft.heightCm, weightKg: draft.weightKg,
          activity: draft.activity, goal: draft.goal, rate: draft.rate,
        });
        store.setTargets({
          kcal: result.kcal, proteinG: result.proteinG, carbsG: result.carbsG, fatG: result.fatG,
        }, 'calculated');
        toast('Targets updated');
      },
    }, 'Apply as my targets'));
  }

  paint();
  return card;
}

/* ---------------- targets ---------------- */

function targetsCard() {
  const targets = store.getTargets();
  const card = el('div.card');
  card.appendChild(el('div.card-head', [
    el('h2', 'Daily targets'),
    el('span.badge' + (targets.source === 'manual' ? '.accent' : ''),
      targets.source === 'placeholder' ? 'Not set' : targets.source === 'manual' ? 'Manual' : 'Calculated'),
  ]));

  const kcalIn = numberInput({ value: targets.kcal });
  const pIn = numberInput({ value: targets.proteinG });
  const cIn = numberInput({ value: targets.carbsG });
  const fIn = numberInput({ value: targets.fatG });
  const drift = el('div');

  function checkDrift() {
    const fromMacros = kcalFromMacros(Number(pIn.value) || 0, Number(cIn.value) || 0, Number(fIn.value) || 0);
    const stated = Number(kcalIn.value) || 0;
    clear(drift);
    if (Math.abs(fromMacros - stated) > 50) {
      drift.appendChild(el('div.hint.warn', `Your macros add up to ${fmt.int(fromMacros)} kcal, not ${fmt.int(stated)}.`));
      drift.appendChild(el('button.btn.sm.ghost', {
        style: { marginTop: '6px' },
        onclick: () => { kcalIn.value = Math.round(fromMacros); checkDrift(); },
      }, 'Use the macro total'));
    }
  }
  [kcalIn, pIn, cIn, fIn].forEach((i) => i.addEventListener('input', checkDrift));

  card.appendChild(field('Calories', kcalIn));
  card.appendChild(el('div.grid-3', [
    field('Protein (g)', pIn), field('Carbs (g)', cIn), field('Fat (g)', fIn),
  ]));
  card.appendChild(drift);
  checkDrift();

  card.appendChild(el('button.btn.block', {
    style: { marginTop: '4px' },
    onclick: () => {
      store.setTargets({
        kcal: kcalIn.value, proteinG: pIn.value, carbsG: cIn.value, fatG: fIn.value,
      }, 'manual');
      toast('Targets saved');
    },
  }, 'Save targets'));
  card.appendChild(el('div.hint', 'Days you have already logged keep the targets they were logged against.'));
  return card;
}

/* ---------------- preferences ---------------- */

function preferencesCard() {
  const profile = store.getProfile();
  const card = el('div.card');
  card.appendChild(el('div.card-head', [el('h2', 'Preferences')]));

  card.appendChild(el('div.label', 'Meal names'));
  const inputs = profile.mealNames.map((n) => el('input', { type: 'text', value: n }));
  card.appendChild(el('div.grid-2', { style: { marginBottom: '10px' } }, inputs));
  card.appendChild(el('button.btn.sm.ghost', {
    style: { marginBottom: '16px' },
    onclick: () => {
      const names = inputs.map((i, idx) => i.value.trim() || profile.mealNames[idx]);
      store.setProfile({ mealNames: names });
      toast('Meal names saved');
    },
  }, 'Save meal names'));

  card.appendChild(field('Theme', segmented([
    { value: 'auto', label: 'Auto' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ], profile.theme || 'auto', (v) => {
    store.setProfile({ theme: v });
    import('../app.js').then((m) => m.applyTheme());
  })));

  return card;
}

/* ---------------- data ---------------- */

function dataCard() {
  const bytes = store.storageBytes();
  const card = el('div.card');
  card.appendChild(el('div.card-head', [el('h2', 'Your data')]));

  card.appendChild(el('div.hint', { style: { marginTop: 0, marginBottom: '12px' } },
    'Everything lives on this device only. Export a backup to keep a copy or move to another phone.'));

  card.appendChild(el('div.btn-row', { style: { marginBottom: '10px' } }, [
    el('button.btn', {
      onclick: () => {
        const s = downloadBackup();
        toast(`Exported ${s.days} days, ${s.foods} foods`);
      },
    }, 'Export backup'),
    el('button.btn', { onclick: runImport }, 'Import backup'),
  ]));

  card.appendChild(el('div.kv', [el('span', 'Storage used'), el('b', `${(bytes / 1024).toFixed(0)} KB`)]));
  card.appendChild(el('div.kv', [el('span', 'Days logged'), el('b', String(store.listDayKeys().length))]));

  card.appendChild(el('button.btn.danger.block', {
    style: { marginTop: '14px' },
    onclick: async () => {
      const ok = await confirmSheet({
        title: 'Erase everything',
        message: 'This deletes every log, food, meal and weigh-in on this device. Export a backup first if you might want it back.',
        confirmLabel: 'Erase everything',
        danger: true,
      });
      if (!ok) return;
      store.eraseAll();
      toast('All data erased');
    },
  }, 'Erase all data'));

  return card;
}

async function runImport() {
  const file = await pickFile();
  if (!file) return;
  let result;
  try {
    result = await readBackupFile(file);
  } catch (err) {
    toast(String(err.message || err), { duration: 5000 });
    return;
  }

  const s = result.summary;
  const sheet = openSheet({ title: 'Import backup' });
  sheet.body.appendChild(el('div.card.tight', { style: { background: 'var(--surface-2)', border: 'none', marginBottom: '12px' } }, [
    el('div.kv', [el('span', 'Days'), el('b', String(s.days))]),
    el('div.kv', [el('span', 'Entries'), el('b', String(s.entries))]),
    el('div.kv', [el('span', 'Foods'), el('b', String(s.foods))]),
    el('div.kv', [el('span', 'Meals'), el('b', String(s.presets))]),
    el('div.kv', [el('span', 'Weigh-ins'), el('b', String(s.weights))]),
  ]));
  sheet.body.appendChild(el('div.hint.warn', 'Importing replaces everything currently on this device.'));
  sheet.setFooter([
    el('button.btn.ghost', { onclick: () => sheet.close() }, 'Cancel'),
    el('button.btn.primary', {
      onclick: () => {
        applyBackup(result.bundle);
        sheet.close();
        toast('Backup restored');
      },
    }, 'Replace my data'),
  ]);
}

/* ---------------- about ---------------- */

function aboutCard() {
  return el('div.card', [
    el('div.card-head', [el('h2', 'About')]),
    el('div.kv', [el('span', 'Version'), el('b', store.APP_VERSION)]),
    el('div.kv', [el('span', 'Data format'), el('b', `schema v${store.SCHEMA_VERSION}`)]),
    el('div.hint', 'MacroMate works offline. Add it to your home screen and it opens like any other app.'),
  ]);
}
