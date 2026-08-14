// localStorage persistence: versioned schema, month-sharded logs, change events.

import { todayKey, monthKey, nowStamp, keyOf, parseKey, addDays } from './dates.js';

export const SCHEMA_VERSION = 1;
export const APP_VERSION = '2.0.0';

const K = {
  meta: 'mm:meta',
  profile: 'mm:profile',
  targets: 'mm:targets',
  foods: 'mm:foods',
  presets: 'mm:presets',
  weights: 'mm:weights',
  log: (mk) => `mm:log:${mk}`,
  migrationBackup: 'mm:backup:migration',
};

export const DEFAULT_PROFILE = {
  sex: 'male',
  age: 30,
  heightCm: 178,
  weightKg: 80,
  activity: 'moderate',
  goal: 'cut',
  rate: 'standard',
  mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
  theme: 'auto',
};

export const PLACEHOLDER_TARGETS = {
  kcal: 2500, proteinG: 180, carbsG: 250, fatG: 70,
  source: 'placeholder', updatedAt: null,
};

/* ---------------- raw storage ---------------- */

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const val = JSON.parse(raw);
    return val === null || val === undefined ? fallback : val;
  } catch (err) {
    console.warn('MacroMate: unreadable key', key, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('MacroMate: write failed', key, err);
    throw new Error('Storage is full or unavailable. Export a backup and free some space.');
  }
}

function allKeys() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('mm:')) out.push(k);
  }
  return out;
}

/* ---------------- change events ---------------- */

const listeners = new Set();
let suspendDepth = 0;
let pendingEmit = false;

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  if (suspendDepth > 0) { pendingEmit = true; return; }
  listeners.forEach((fn) => {
    try { fn(); } catch (err) { console.error(err); }
  });
}

/** Batch several mutations into one change event. */
export function batch(fn) {
  suspendDepth++;
  try { return fn(); }
  finally {
    suspendDepth--;
    if (suspendDepth === 0 && pendingEmit) { pendingEmit = false; emit(); }
  }
}

/* ---------------- migrations ---------------- */

// MIGRATIONS[n] upgrades a full data bundle from version n to n+1.
const MIGRATIONS = {};

function snapshotBundle() {
  const bundle = { profile: getProfile(), targets: getTargets(), foods: read(K.foods, {}), presets: read(K.presets, {}), weights: read(K.weights, {}), days: {} };
  allKeys().filter((k) => k.startsWith('mm:log:')).forEach((k) => {
    Object.assign(bundle.days, read(k, {}));
  });
  return bundle;
}

/** Runs bundle through migrations from `from` up to SCHEMA_VERSION. */
export function migrateBundle(bundle, from) {
  let data = bundle;
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No migration path from schema v${v}`);
    data = step(data);
  }
  return data;
}

export function init() {
  const meta = read(K.meta, null);
  if (!meta) {
    write(K.meta, { schemaVersion: SCHEMA_VERSION, createdAt: nowStamp() });
    return;
  }
  if (meta.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`This data was saved by a newer version of MacroMate (schema v${meta.schemaVersion}). Update the app before opening it.`);
  }
  if (meta.schemaVersion < SCHEMA_VERSION) {
    const before = snapshotBundle();
    write(K.migrationBackup, { schemaVersion: meta.schemaVersion, savedAt: nowStamp(), data: before });
    const after = migrateBundle(before, meta.schemaVersion);
    replaceAll(after, { silent: true });
    write(K.meta, { ...meta, schemaVersion: SCHEMA_VERSION, migratedAt: nowStamp() });
  }
}

/* ---------------- profile & targets ---------------- */

export function getProfile() {
  return { ...DEFAULT_PROFILE, ...read(K.profile, {}) };
}

export function setProfile(patch) {
  const next = { ...getProfile(), ...patch };
  write(K.profile, next);
  emit();
  return next;
}

export function hasProfile() {
  return read(K.profile, null) !== null;
}

export function getTargets() {
  return read(K.targets, null) || { ...PLACEHOLDER_TARGETS };
}

export function setTargets(patch, source) {
  const next = { ...getTargets(), ...patch, updatedAt: nowStamp() };
  if (source) next.source = source;
  ['kcal', 'proteinG', 'carbsG', 'fatG'].forEach((k) => { next[k] = Math.max(0, Math.round(Number(next[k]) || 0)); });
  write(K.targets, next);
  emit();
  return next;
}

export function targetsAreSet() {
  return getTargets().source !== 'placeholder';
}

/* ---------------- foods ---------------- */

export function getFoods() {
  return read(K.foods, {});
}

export function listFoods({ includeArchived = false } = {}) {
  return Object.values(getFoods())
    .filter((f) => includeArchived || !f.archived)
    .sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0) || a.name.localeCompare(b.name));
}

export function getFood(id) {
  return getFoods()[id] || null;
}

export function saveFood(food) {
  const foods = getFoods();
  const id = food.id || crypto.randomUUID();
  const existing = foods[id] || {};
  const next = {
    id,
    name: (food.name || '').trim(),
    brand: (food.brand || '').trim(),
    per: food.per === 'unit' ? 'unit' : '100g',
    unitName: (food.unitName || '').trim(),
    p: num(food.p), c: num(food.c), f: num(food.f),
    kcal: food.kcal === null || food.kcal === undefined || food.kcal === '' ? null : num(food.kcal),
    servings: Array.isArray(food.servings)
      ? food.servings.filter((s) => s && s.name && num(s.grams) > 0).map((s) => ({ name: String(s.name).trim(), grams: num(s.grams) }))
      : [],
    usedCount: existing.usedCount || 0,
    lastUsedAt: existing.lastUsedAt || null,
    lastQty: existing.lastQty ?? null,
    lastUnit: existing.lastUnit ?? null,
    lastServing: existing.lastServing ?? null,
    archived: !!food.archived,
    createdAt: existing.createdAt || nowStamp(),
  };
  foods[id] = next;
  write(K.foods, foods);
  emit();
  return next;
}

export function markFoodUsed(id, { qty, unit, servingName } = {}) {
  const foods = getFoods();
  const food = foods[id];
  if (!food) return;
  food.usedCount = (food.usedCount || 0) + 1;
  food.lastUsedAt = nowStamp();
  if (qty !== undefined) food.lastQty = qty;
  if (unit !== undefined) food.lastUnit = unit;
  if (servingName !== undefined) food.lastServing = servingName;
  write(K.foods, foods);
}

export function deleteFood(id) {
  const foods = getFoods();
  if (!foods[id]) return { removed: false };
  const usedInPreset = Object.values(read(K.presets, {})).some((p) => p.items.some((it) => it.foodId === id));
  if (usedInPreset || (foods[id].usedCount || 0) > 0) {
    foods[id].archived = true;
    write(K.foods, foods);
    emit();
    return { removed: false, archived: true };
  }
  delete foods[id];
  write(K.foods, foods);
  emit();
  return { removed: true };
}

export function restoreFood(id) {
  const foods = getFoods();
  if (!foods[id]) return;
  foods[id].archived = false;
  write(K.foods, foods);
  emit();
}

/* ---------------- presets ---------------- */

export function getPresets() {
  return read(K.presets, {});
}

export function listPresets() {
  return Object.values(getPresets())
    .sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0) || a.name.localeCompare(b.name));
}

export function getPreset(id) {
  return getPresets()[id] || null;
}

export function savePreset(preset) {
  const presets = getPresets();
  const id = preset.id || crypto.randomUUID();
  const existing = presets[id] || {};
  presets[id] = {
    id,
    name: (preset.name || '').trim(),
    items: (preset.items || []).map((it) => ({
      foodId: it.foodId,
      qty: num(it.qty),
      unit: it.unit || 'g',
      servingName: it.servingName || null,
    })),
    usedCount: existing.usedCount || 0,
    lastUsedAt: existing.lastUsedAt || null,
    createdAt: existing.createdAt || nowStamp(),
  };
  write(K.presets, presets);
  emit();
  return presets[id];
}

export function markPresetUsed(id) {
  const presets = getPresets();
  if (!presets[id]) return;
  presets[id].usedCount = (presets[id].usedCount || 0) + 1;
  presets[id].lastUsedAt = nowStamp();
  write(K.presets, presets);
}

export function deletePreset(id) {
  const presets = getPresets();
  delete presets[id];
  write(K.presets, presets);
  emit();
}

/* ---------------- day logs (month-sharded) ---------------- */

function readMonth(mk) {
  return read(K.log(mk), {});
}

function writeMonth(mk, data) {
  if (Object.keys(data).length === 0) localStorage.removeItem(K.log(mk));
  else write(K.log(mk), data);
}

export function getDay(dateKey) {
  const month = readMonth(monthKey(dateKey));
  const day = month[dateKey];
  if (!day) return { targets: null, entries: [] };
  return { targets: day.targets || null, entries: day.entries || [] };
}

export function listDayKeys() {
  const keys = [];
  allKeys().filter((k) => k.startsWith('mm:log:')).forEach((k) => {
    Object.keys(read(k, {})).forEach((d) => keys.push(d));
  });
  return keys.sort();
}

/** All days in [fromKey, toKey] that have data, as { dateKey: day }. */
export function getDaysInRange(fromKey, toKey) {
  const out = {};
  const seen = new Set();
  let cur = fromKey.slice(0, 7);
  const end = toKey.slice(0, 7);
  let guard = 0;
  while (guard++ < 600) {
    if (!seen.has(cur)) {
      seen.add(cur);
      const month = readMonth(cur);
      for (const [dk, day] of Object.entries(month)) {
        if (dk >= fromKey && dk <= toKey) out[dk] = day;
      }
    }
    if (cur === end) break;
    const [y, m] = cur.split('-').map(Number);
    const d = new Date(y, m - 1 + 1, 1);
    cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return out;
}

function mutateDay(dateKey, fn) {
  const mk = monthKey(dateKey);
  const month = readMonth(mk);
  const day = month[dateKey] || { targets: null, entries: [] };
  const result = fn(day);
  if (day.entries.length === 0 && !day.targets) delete month[dateKey];
  else month[dateKey] = day;
  writeMonth(mk, month);
  emit();
  return result;
}

export function addEntries(dateKey, entries) {
  return mutateDay(dateKey, (day) => {
    if (!day.targets) {
      const t = getTargets();
      day.targets = { kcal: t.kcal, p: t.proteinG, c: t.carbsG, f: t.fatG };
    }
    const stamped = entries.map((e) => ({ id: crypto.randomUUID(), ts: nowStamp(), ...e }));
    day.entries.push(...stamped);
    return stamped;
  });
}

export function updateEntry(dateKey, entryId, patch) {
  return mutateDay(dateKey, (day) => {
    const idx = day.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return null;
    day.entries[idx] = { ...day.entries[idx], ...patch };
    return day.entries[idx];
  });
}

export function deleteEntry(dateKey, entryId) {
  return mutateDay(dateKey, (day) => {
    const idx = day.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) return null;
    return day.entries.splice(idx, 1)[0];
  });
}

/** Re-insert a previously deleted entry (undo), keeping its id and timestamp. */
export function restoreEntry(dateKey, entry) {
  return mutateDay(dateKey, (day) => {
    if (!day.targets) {
      const t = getTargets();
      day.targets = { kcal: t.kcal, p: t.proteinG, c: t.carbsG, f: t.fatG };
    }
    day.entries.push(entry);
    day.entries.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    return entry;
  });
}

/* ---------------- weights ---------------- */

export function getWeights() {
  return read(K.weights, {});
}

export function setWeight(dateKey, kg) {
  const w = getWeights();
  if (kg === null || kg === '' || Number.isNaN(Number(kg))) delete w[dateKey];
  else w[dateKey] = num(kg);
  write(K.weights, w);
  emit();
}

export function latestWeight() {
  const w = getWeights();
  const keys = Object.keys(w).sort();
  if (!keys.length) return null;
  const k = keys[keys.length - 1];
  return { date: k, kg: w[k] };
}

/** Body weight used for macro maths: latest weigh-in, else the profile figure. */
export function currentWeightKg() {
  const lw = latestWeight();
  return lw ? lw.kg : getProfile().weightKg;
}

/* ---------------- bulk data ops ---------------- */

export function exportBundle() {
  return {
    app: 'macromate',
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowStamp(),
    data: snapshotBundle(),
  };
}

export function bundleSummary(bundle) {
  const d = bundle.data || {};
  return {
    days: Object.keys(d.days || {}).length,
    foods: Object.keys(d.foods || {}).length,
    presets: Object.keys(d.presets || {}).length,
    weights: Object.keys(d.weights || {}).length,
    entries: Object.values(d.days || {}).reduce((n, day) => n + (day.entries || []).length, 0),
  };
}

export function replaceAll(data, { silent = false } = {}) {
  allKeys().filter((k) => k !== K.migrationBackup).forEach((k) => localStorage.removeItem(k));
  write(K.meta, { schemaVersion: SCHEMA_VERSION, createdAt: nowStamp() });
  if (data.profile) write(K.profile, data.profile);
  if (data.targets) write(K.targets, data.targets);
  write(K.foods, data.foods || {});
  write(K.presets, data.presets || {});
  write(K.weights, data.weights || {});

  const byMonth = {};
  for (const [dk, day] of Object.entries(data.days || {})) {
    const mk = monthKey(dk);
    (byMonth[mk] = byMonth[mk] || {})[dk] = day;
  }
  for (const [mk, days] of Object.entries(byMonth)) writeMonth(mk, days);
  if (!silent) emit();
}

export function eraseAll() {
  allKeys().forEach((k) => localStorage.removeItem(k));
  write(K.meta, { schemaVersion: SCHEMA_VERSION, createdAt: nowStamp() });
  emit();
}

export function storageBytes() {
  return allKeys().reduce((n, k) => n + k.length + (localStorage.getItem(k) || '').length, 0);
}

/* ---------------- helpers ---------------- */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Dev helper (console only): ~8 weeks of plausible data for chart checks. */
export function seedDemo() {
  const foods = [
    { name: 'Chicken breast', per: '100g', p: 31, c: 0, f: 3.6, servings: [{ name: 'breast', grams: 150 }] },
    { name: 'White rice, cooked', per: '100g', p: 2.7, c: 28, f: 0.3, servings: [{ name: 'cup', grams: 158 }] },
    { name: 'Whey protein', per: '100g', p: 80, c: 8, f: 6, servings: [{ name: 'scoop', grams: 30 }] },
    { name: 'Rolled oats', per: '100g', p: 13, c: 60, f: 7, servings: [{ name: 'cup', grams: 90 }] },
    { name: 'Whole egg', per: 'unit', unitName: 'egg', p: 6.3, c: 0.4, f: 5, servings: [] },
    { name: 'Olive oil', per: '100g', p: 0, c: 0, f: 100, servings: [{ name: 'tbsp', grams: 14 }] },
    { name: 'Greek yoghurt 2%', per: '100g', p: 10, c: 4, f: 2, servings: [{ name: 'tub', grams: 170 }] },
    { name: 'Banana', per: 'unit', unitName: 'banana', p: 1.3, c: 27, f: 0.4, servings: [] },
  ].map((f) => saveFood(f));

  batch(() => {
    let weight = 84.5;
    for (let i = 55; i >= 0; i--) {
      const dk = keyOf(new Date(Date.now() - i * 86400000));
      if (i % 7 !== 3) setWeight(dk, Math.round((weight + (Math.sin(i * 1.7) * 0.35)) * 10) / 10);
      weight -= 0.07;
      if (i % 9 === 4) continue; // a few unlogged days
      const t = getTargets();
      const entries = [];
      const jitter = 0.92 + ((i * 37) % 17) / 100;
      const picks = [
        [foods[3], 130], [foods[2], 40], [foods[0], 320], [foods[1], 480],
        [foods[4], 2], [foods[6], 170], [foods[7], 1], [foods[5], 12],
      ];
      picks.forEach(([food, qty], n) => {
        const q = food.per === 'unit' ? Math.max(1, Math.round(qty * jitter)) : Math.round(qty * jitter);
        const factor = food.per === 'unit' ? q : q / 100;
        entries.push({
          meal: [0, 0, 1, 1, 0, 3, 3, 1][n],
          kind: 'food',
          foodId: food.id,
          name: food.name,
          qty: q,
          unit: food.per === 'unit' ? 'unit' : 'g',
          unitName: food.per === 'unit' ? food.unitName : null,
          servingName: null,
          p: round1(food.p * factor), c: round1(food.c * factor), f: round1(food.f * factor),
          kcal: round1((food.p * 4 + food.c * 4 + food.f * 9) * factor),
        });
      });
      const mk = monthKey(dk);
      const month = readMonth(mk);
      month[dk] = {
        targets: { kcal: t.kcal, p: t.proteinG, c: t.carbsG, f: t.fatG },
        entries: entries.map((e) => ({ id: crypto.randomUUID(), ts: `${dk}T08:00:00`, ...e })),
      };
      writeMonth(mk, month);
    }
  });
  emit();
  return 'Seeded ~8 weeks of demo data.';
}

const round1 = (n) => Math.round(n * 10) / 10;

// dev console access
if (typeof window !== 'undefined') {
  window.MacroMate = {
    seedDemo, eraseAll, exportBundle,
    get days() { return listDayKeys(); },
    version: APP_VERSION,
  };
}
