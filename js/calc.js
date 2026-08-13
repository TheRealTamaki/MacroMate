// Pure calculation functions: TDEE, macro split, entry macros, weight trend, adherence.

import { addDays, diffDays } from './dates.js';

export const ACTIVITY = [
  { value: 'sedentary', label: 'Sedentary', mult: 1.2, note: 'Desk job, little or no exercise' },
  { value: 'light', label: 'Light', mult: 1.375, note: 'Training 1-3 days a week' },
  { value: 'moderate', label: 'Moderate', mult: 1.55, note: 'Training 3-5 days a week' },
  { value: 'high', label: 'High', mult: 1.725, note: 'Hard training 6-7 days a week' },
  { value: 'athlete', label: 'Athlete', mult: 1.9, note: 'Twice-daily training or physical job' },
];

export const GOALS = [
  { value: 'cut', label: 'Cut' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'bulk', label: 'Bulk' },
];

export const RATES = {
  cut: [
    { value: 'slow', label: 'Slow', adj: -0.10 },
    { value: 'standard', label: 'Standard', adj: -0.20 },
    { value: 'aggressive', label: 'Aggressive', adj: -0.25 },
  ],
  bulk: [
    { value: 'slow', label: 'Lean', adj: 0.05 },
    { value: 'standard', label: 'Standard', adj: 0.10 },
    { value: 'aggressive', label: 'Fast', adj: 0.15 },
  ],
  maintain: [{ value: 'standard', label: 'Maintain', adj: 0 }],
};

const PROTEIN_PER_KG = { cut: 2.2, maintain: 2.0, bulk: 1.8 };
const FAT_PER_KG = 0.8;
const FAT_FLOOR_PER_KG = 0.6;
const KCAL_PER_KG_BODY = 7700;

export function activityMultiplier(activity) {
  return (ACTIVITY.find((a) => a.value === activity) || ACTIVITY[2]).mult;
}

export function goalAdjustment(goal, rate) {
  const list = RATES[goal] || RATES.maintain;
  return (list.find((r) => r.value === rate) || list[0]).adj;
}

/** Mifflin-St Jeor basal metabolic rate. */
export function bmr({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === 'female' ? -161 : 5));
}

export function tdee(profile) {
  return Math.round(bmr(profile) * activityMultiplier(profile.activity));
}

/**
 * Full target calculation from profile + body weight.
 * Returns { bmr, tdee, kcal, proteinG, fatG, carbsG, adj, weeklyKg, warning }.
 */
export function calcTargets(profile, weightKg) {
  const w = weightKg || profile.weightKg;
  const stats = { sex: profile.sex, weightKg: w, heightCm: profile.heightCm, age: profile.age };
  const basal = bmr(stats);
  const maintenance = Math.round(basal * activityMultiplier(profile.activity));
  const adj = goalAdjustment(profile.goal, profile.rate);
  const kcal = Math.round((maintenance * (1 + adj)) / 10) * 10;

  let proteinG = Math.round((PROTEIN_PER_KG[profile.goal] || 2.0) * w);
  let fatG = Math.round(FAT_PER_KG * w);
  let carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);
  let warning = null;

  if (carbsG < 50) {
    // free up carbs by dropping fat toward its floor before clamping anything
    const fatFloor = Math.round(FAT_FLOOR_PER_KG * w);
    fatG = Math.max(fatFloor, Math.round((kcal - proteinG * 4 - 50 * 4) / 9));
    carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);
  }
  if (carbsG < 0) {
    carbsG = 0;
    warning = 'These targets are very aggressive — protein and fat alone use the whole calorie budget. Ease the deficit or lower protein.';
  }

  return {
    bmr: basal,
    tdee: maintenance,
    kcal,
    proteinG,
    fatG,
    carbsG,
    adj,
    weeklyKg: (maintenance * adj * 7) / KCAL_PER_KG_BODY,
    warning,
  };
}

export function kcalFromMacros(p, c, f) {
  return p * 4 + c * 4 + f * 9;
}

/* ---------------- entry macros ---------------- */

/** Grams (or unit count) -> multiplier against the food's stated basis. */
export function portionFactor(food, qty, unit, servingName) {
  const q = Number(qty) || 0;
  if (food.per === 'unit') return q;
  if (unit === 'serving') {
    const serving = (food.servings || []).find((s) => s.name === servingName);
    return serving ? (q * serving.grams) / 100 : 0;
  }
  return q / 100;
}

/** Macro snapshot for one logged portion. Values rounded to 1 decimal. */
export function portionMacros(food, qty, unit, servingName) {
  const factor = portionFactor(food, qty, unit, servingName);
  const p = round1(food.p * factor);
  const c = round1(food.c * factor);
  const f = round1(food.f * factor);
  const kcal = round1(food.kcal !== null && food.kcal !== undefined
    ? food.kcal * factor
    : kcalFromMacros(food.p, food.c, food.f) * factor);
  return { p, c, f, kcal };
}

/** Calories per basis unit for a food, using the label override when present. */
export function foodBasisKcal(food) {
  return food.kcal !== null && food.kcal !== undefined
    ? food.kcal
    : kcalFromMacros(food.p, food.c, food.f);
}

export function sumEntries(entries) {
  const total = { kcal: 0, p: 0, c: 0, f: 0 };
  (entries || []).forEach((e) => {
    total.kcal += e.kcal || 0;
    total.p += e.p || 0;
    total.c += e.c || 0;
    total.f += e.f || 0;
  });
  return total;
}

export function dayTotals(day) {
  return sumEntries(day && day.entries);
}

/* ---------------- weight trend ---------------- */

/**
 * 7-day trailing mean of whatever weigh-ins exist in the window.
 * Returns null when the window is empty.
 */
export function trendAt(weights, dateKey, window = 7) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < window; i++) {
    const v = weights[addDays(dateKey, -i)];
    if (typeof v === 'number') { sum += v; n++; }
  }
  return n ? sum / n : null;
}

/**
 * Weekly change from the trend line: trend(latest) - trend(latest - 7).
 * Returns { latestDate, trend, weeklyKg } or null when there is not enough data.
 */
export function weightTrendSummary(weights) {
  const keys = Object.keys(weights).sort();
  if (!keys.length) return null;
  const latest = keys[keys.length - 1];
  const now = trendAt(weights, latest);
  const prior = trendAt(weights, addDays(latest, -7));
  return {
    latestDate: latest,
    latestKg: weights[latest],
    trend: now,
    weeklyKg: now !== null && prior !== null ? now - prior : null,
    spanDays: diffDays(latest, keys[0]) + 1,
  };
}

/** Trend series over a list of date keys; entries with no data are null. */
export function trendSeries(weights, dateKeys, window = 7) {
  return dateKeys.map((k) => ({ date: k, raw: weights[k] ?? null, trend: trendAt(weights, k, window) }));
}

/* ---------------- adherence ---------------- */

export const KCAL_TOLERANCE_PCT = 0.05;
export const KCAL_TOLERANCE_MIN = 100;
export const PROTEIN_FLOOR_PCT = 0.9;

/** Grade one day against its own snapshot targets (falls back to current). */
export function gradeDay(day, fallbackTargets) {
  const entries = (day && day.entries) || [];
  if (!entries.length) return { logged: false, adherent: false, totals: { kcal: 0, p: 0, c: 0, f: 0 }, targets: null };
  const t = (day && day.targets) || fallbackTargets;
  const totals = sumEntries(entries);
  const tol = Math.max(t.kcal * KCAL_TOLERANCE_PCT, KCAL_TOLERANCE_MIN);
  const kcalHit = Math.abs(totals.kcal - t.kcal) <= tol;
  const proteinHit = totals.p >= t.p * PROTEIN_FLOOR_PCT;
  return { logged: true, adherent: kcalHit && proteinHit, kcalHit, proteinHit, totals, targets: t };
}

/**
 * Adherence over the given date keys.
 * rate = adherent / logged; logRate = logged / total days.
 */
export function adherenceOver(days, dateKeys, fallbackTargets) {
  let logged = 0;
  let adherent = 0;
  dateKeys.forEach((k) => {
    const g = gradeDay(days[k], fallbackTargets);
    if (g.logged) { logged++; if (g.adherent) adherent++; }
  });
  return {
    logged,
    adherent,
    total: dateKeys.length,
    rate: logged ? adherent / logged : null,
    logRate: dateKeys.length ? logged / dateKeys.length : 0,
  };
}

/**
 * Consecutive adherent days ending yesterday; today extends the streak
 * once it qualifies, so a half-eaten day never appears to break it.
 */
export function currentStreak(days, todayK, fallbackTargets) {
  let streak = 0;
  const todayGrade = gradeDay(days[todayK], fallbackTargets);
  if (todayGrade.adherent) streak++;
  let cursor = addDays(todayK, -1);
  for (let i = 0; i < 400; i++) {
    const g = gradeDay(days[cursor], fallbackTargets);
    if (!g.adherent) break;
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}
