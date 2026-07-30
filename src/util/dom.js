/**
 * A very small rendering layer.
 *
 * Views are pure functions of state that return escaped HTML strings, and the
 * shell re-renders the active view whenever the store changes. Interaction goes
 * through one delegated listener that reads `data-action` attributes, so views
 * never bind or tear down handlers themselves.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

/** Mark a string as already-escaped HTML. */
export function raw(value) {
  return new SafeHtml(String(value));
}

export function isSafeHtml(value) {
  return value instanceof SafeHtml;
}

function interpolate(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (Array.isArray(value)) return value.map(interpolate).join('');
  if (value instanceof SafeHtml) return value.value;
  return escapeHtml(value);
}

/**
 * Tagged template that escapes every interpolated value unless it is SafeHtml.
 * Nested `html` calls and arrays of them compose without extra ceremony.
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += interpolate(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Join a list into one SafeHtml blob. */
export function join(list, separator = '') {
  return raw(list.map(interpolate).join(separator));
}

/** Build a class attribute from strings and `{ name: condition }` maps. */
export function cls(...parts) {
  const out = [];
  for (const part of parts) {
    if (!part) continue;
    if (typeof part === 'string') out.push(part);
    else if (typeof part === 'object') {
      for (const [name, on] of Object.entries(part)) if (on) out.push(name);
    }
  }
  return out.join(' ');
}

export function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function fmtMoney(cents) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
