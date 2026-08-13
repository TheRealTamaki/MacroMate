// Local-time date helpers. Every date key is YYYY-MM-DD in the device timezone.
// toISOString() is deliberately never used — it shifts the day near midnight.

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

export function keyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey() {
  return keyOf(new Date());
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}

export function monthKey(key) {
  return key.slice(0, 7);
}

export function diffDays(a, b) {
  // whole days from b to a, timezone-safe (compares midday to dodge DST)
  const da = parseKey(a); da.setHours(12);
  const db = parseKey(b); db.setHours(12);
  return Math.round((da - db) / 86400000);
}

/** Inclusive list of date keys from `from` to `to`. */
export function rangeKeys(from, to) {
  const out = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 4000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** The last `n` date keys ending at `endKey` (inclusive). */
export function lastNDays(endKey, n) {
  return rangeKeys(addDays(endKey, -(n - 1)), endKey);
}

/** Monday-start week key, e.g. 2026-08-10 (the Monday). */
export function weekStart(key) {
  const d = parseKey(key);
  const shift = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - shift);
  return keyOf(d);
}

export function isoWeekNumber(key) {
  const d = parseKey(key);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export function fmtDay(key) {
  const d = parseKey(key);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function fmtShort(key) {
  const d = parseKey(key);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function relativeLabel(key) {
  const delta = diffDays(key, todayKey());
  if (delta === 0) return 'Today';
  if (delta === -1) return 'Yesterday';
  if (delta === 1) return 'Tomorrow';
  const d = parseKey(key);
  if (Math.abs(delta) < 300) return `${d.getFullYear()}`;
  return `${d.getFullYear()}`;
}

export function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}

export function nowStamp() {
  const d = new Date();
  return `${keyOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
