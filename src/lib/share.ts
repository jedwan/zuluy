// Share grid composer.
//
// Post-pivot (2026-05-22, unlimited model): each puzzle is a fresh random
// city, so the share is per-puzzle rather than per-day. We dropped the
// date from the header — there's no shared "today's puzzle" any more.
//
// Output is plain text, copy-pasteable. The format is the contract;
// changing it after launch silently breaks every screenshot sitting on
// social media. Treat with care.

import type { City } from './types.js';
import { haversineKm, bearingDegrees } from './geo.js';

const MAX_GUESSES = 5;

const COMPASS_EMOJI = [
  '⬆️', // 0°    N
  '↗️', // 45°   NE
  '➡️', // 90°   E
  '↘️', // 135°  SE
  '⬇️', // 180°  S
  '↙️', // 225°  SW
  '⬅️', // 270°  W
  '↖️', // 315°  NW
] as const;

const HIT_EMOJI = '🎯';
const FULL_SQUARE = '🟩';
const EMPTY_SQUARE = '⬜';

/**
 * Proximity → number of filled squares (0–5). Distance brackets tuned so
 * a continent-close guess gets 3 and the wrong-side-of-the-world gets 1.
 */
export function squaresFromDistance(km: number): number {
  if (km < 500) return 5;
  if (km < 1500) return 4;
  if (km < 5000) return 3;
  if (km < 12000) return 2;
  if (km < 20000) return 1;
  return 0;
}

/**
 * Bearing in degrees → directional emoji. Same 8-sector mapping as
 * `compassPoint` in geo.ts; keep them in lockstep.
 */
export function arrowForBearing(bearing: number): string {
  const i = Math.round(((bearing + 360) % 360) / 45) % 8;
  return COMPASS_EMOJI[i]!;
}

export type ShareStatus = 'won' | 'lost';

/**
 * One line per guess: proximity squares + bearing emoji. Used by both
 * `buildShareGrid` (joined for clipboard) and the history-card renderer
 * on the puzzle page (rendered as separate spans).
 */
export function buildGridRows(answer: City, guesses: City[]): string[] {
  return guesses.map((g) => {
    const isHit = g.id === answer.id;
    const km = haversineKm(g.lat, g.lng, answer.lat, answer.lng);
    const filled = isHit ? 5 : squaresFromDistance(km);
    const squares = FULL_SQUARE.repeat(filled) + EMPTY_SQUARE.repeat(5 - filled);
    const arrow = isHit
      ? HIT_EMOJI
      : arrowForBearing(bearingDegrees(g.lat, g.lng, answer.lat, answer.lng));
    return `${squares} ${arrow}`;
  });
}

/**
 * Build the share-grid text for a completed puzzle.
 *
 * Example (won in 3):
 *
 *   zuluy. 3/5
 *
 *   🟩🟩⬜⬜⬜ ↖️
 *   🟩🟩🟩⬜⬜ ➡️
 *   🟩🟩🟩🟩🟩 🎯
 *
 *   zuluy.com
 */
export function buildShareGrid(answer: City, guesses: City[], status: ShareStatus): string {
  const score = status === 'won' ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  return [`zuluy. ${score}`, '', ...buildGridRows(answer, guesses), '', 'zuluy.com'].join('\n');
}
