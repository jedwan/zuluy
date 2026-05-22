// Puzzle picker.
//
// Zuluy v1 (post-pivot, 2026-05-22): unlimited puzzles per session. The
// canonical picker is `pickRandomCity`. `pickPuzzleCity` is retained as a
// deterministic, seed-based picker used only by tests and any future
// "daily challenge"-style feature that wants reproducibility.

import type { City } from './types.js';

/**
 * UTC date stamp YYYY-MM-DD. Kept around for share-grid timestamps and any
 * future feature that needs a stable per-day identifier. Not currently the
 * driver of puzzle selection — see `pickRandomCity`.
 */
export function puzzleDateString(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Stable 32-bit hash (xmur3). Deterministic spread from a string seed.
 */
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/**
 * Deterministic picker — same `seed` → same city. Used by tests and future
 * daily-challenge replays. Filters by `minRecognition` (default 6) so the
 * eligible pool is the "globally recognizable" subset.
 */
export function pickPuzzleCity(
  cities: City[],
  seed: string,
  minRecognition = 6,
): City {
  if (cities.length === 0) throw new Error('cannot pick a puzzle from an empty city list');
  const pool = cities.filter((c) => c.recognitionScore >= minRecognition);
  const eligible = pool.length > 0 ? pool : cities;
  const sorted = eligible.slice().sort((a, b) => a.id.localeCompare(b.id));
  const h = xmur3(seed);
  return sorted[h % sorted.length]!;
}

/**
 * Random picker — non-deterministic, used in production for the
 * unlimited-puzzle session. Filters by `minRecognition`; optionally
 * excludes a recent-id set so back-to-back puzzles don't repeat. Falls
 * back gracefully if the exclusion list empties the pool.
 */
export function pickRandomCity(
  cities: City[],
  minRecognition = 6,
  exclude: Set<string> = new Set(),
): City {
  if (cities.length === 0) throw new Error('cannot pick a puzzle from an empty city list');
  const withRec = cities.filter((c) => c.recognitionScore >= minRecognition);
  const recPool = withRec.length > 0 ? withRec : cities;
  // Apply recent-exclusion; if that empties the pool, fall back to ignoring it.
  const pool = recPool.filter((c) => !exclude.has(c.id));
  const eligible = pool.length > 0 ? pool : recPool;
  return eligible[Math.floor(Math.random() * eligible.length)]!;
}

/**
 * Current local time at a city, formatted "4:47 PM" — 12-hour clock, no
 * seconds. Live-updating; the page re-calls this each minute so the
 * displayed time stays current.
 */
export function formatLocalTimePrompt(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);
}
