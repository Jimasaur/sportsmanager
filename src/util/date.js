/**
 * Date helpers.
 *
 * Everything is stored as `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` and interpreted in
 * the operator's local timezone. Bare dates are anchored at midday so that a
 * timezone offset can never roll a fixture onto the previous or next day.
 */

export const DAY_MS = 86400000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!match) return new Date(value);
  const hasTime = match[4] !== undefined;
  return new Date(+match[1], +match[2] - 1, +match[3], hasTime ? +match[4] : 12, hasTime ? +match[5] : 0, 0, 0);
}

export function toISODate(value) {
  const d = parseDate(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toISODateTime(value) {
  const d = parseDate(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function startOfDay(value) {
  const d = parseDate(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(value, n) {
  const d = parseDate(value);
  d.setDate(d.getDate() + n);
  return d;
}

/** Whole days from `from` to `value`. Negative when `value` is in the past. */
export function daysUntil(value, from = new Date()) {
  return Math.round((startOfDay(value) - startOfDay(from)) / DAY_MS);
}

export function hoursBetween(a, b) {
  return Math.abs(parseDate(a) - parseDate(b)) / 3600000;
}

export function isSameDay(a, b) {
  return toISODate(a) === toISODate(b);
}

/** Monday-anchored start of the week containing `value`. */
export function startOfWeek(value) {
  const d = startOfDay(value);
  const shift = (d.getDay() + 6) % 7;
  return addDays(d, -shift);
}

export function startOfMonth(value) {
  const d = startOfDay(value);
  d.setDate(1);
  return d;
}

export function addMonths(value, n) {
  const d = startOfMonth(value);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function fmtShort(value) {
  const d = parseDate(value);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtFull(value) {
  const d = parseDate(value);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtMonthYear(value) {
  const d = parseDate(value);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtWeekdayBanner(value = new Date()) {
  const d = parseDate(value);
  return `${WEEKDAYS[d.getDay()]} · ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`.toUpperCase();
}

export function fmtMonthAbbr(value) {
  return MONTHS[parseDate(value).getMonth()].toUpperCase();
}

export function fmtTime(value) {
  const d = parseDate(value);
  const h = d.getHours();
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  const mins = d.getMinutes();
  return mins ? `${hour}:${String(mins).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

/** "12 min ago" / "in 3 days" — used by the live feed and audit log. */
export function fmtRelative(value, from = new Date()) {
  const delta = parseDate(value) - parseDate(from);
  const past = delta < 0;
  const mins = Math.round(Math.abs(delta) / 60000);
  let text;
  if (mins < 1) text = 'just now';
  else if (mins < 60) text = `${mins} min`;
  else if (mins < 60 * 24) {
    const hrs = Math.round(mins / 60);
    text = `${hrs} hr${hrs === 1 ? '' : 's'}`;
  } else {
    const days = Math.round(mins / (60 * 24));
    text = `${days} day${days === 1 ? '' : 's'}`;
  }
  if (text === 'just now') return text;
  return past ? `${text} ago` : `in ${text}`;
}

export function fmtCountdown(value, from = new Date()) {
  const days = daysUntil(value, from);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days} days`;
}
