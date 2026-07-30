/**
 * Deterministic pseudo-random numbers.
 *
 * The seed data must be identical on every load: the app rebuilds its dataset
 * from `data/seed.js` at startup and persists only the operator's decisions on
 * top of it. An unseeded `Math.random()` would make record ids and results
 * drift between reloads, and stored decisions would point at records that no
 * longer exist.
 */

/** mulberry32 — small, fast, good enough for fixture generation. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn a string into a stable 32-bit seed (FNV-1a). */
export function seedFrom(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Integer in [min, max], inclusive. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Fisher-Yates, returns a new array. */
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
