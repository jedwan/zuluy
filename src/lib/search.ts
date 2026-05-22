// City search — pure ranking + normalization for the puzzle's autocomplete.
//
// ── Game-design constraint (do not re-add) ──────────────────────────────────
// The puzzle premise is *you don't know where the city is yet*. Geo signals
// (haversine distance from user location, distance from a hinted region) must
// NOT influence autocomplete ranking, even if they technically could be cheap.
// Adding geo signals would leak information about the puzzle answer and break
// the epistemic uncertainty that the game depends on.
//
// eSalah's search.ts had a `geoBonusKm` that biased ranking toward cities near
// the user's location. We strip that here. If a future PR proposes adding it
// back ("for autocomplete quality"), the answer is no — that's the game.
// ────────────────────────────────────────────────────────────────────────────
//
// Ranking:
//
//   score = match_quality*100 + recognition_bonus + log10(population+1)*2
//
// match_quality dominates (0–100). recognitionScore (1–10) acts as the tier-
// like signal: more globally-recognized cities surface first at equal text
// match. Population is the gentle tiebreak.
//
// Ported from eSalah's `src/lib/search.ts`. Diacritic-insensitive normalization
// and the match-quality ladder are unchanged.

import type { City } from './types.js';

// ── normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a string for prefix / contains matching. Lowercases, strips
 * Unicode diacritics (NFD + combining-mark removal), collapses whitespace,
 * removes punctuation. Used on both the query and the haystack so "café",
 * "Cafe", and "CAFE" all collide.
 */
export function normalizeSearchTerm(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining marks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── match quality ────────────────────────────────────────────────────────────

/**
 * Grade how well `q` matches `name` + `id` (the kebab-case slug-with-cc).
 * Returns a 0–1 score, or 0 for no match. Callers multiply by 100 before
 * combining with bonuses.
 *
 *   1.00  exact id match
 *   0.90  exact normalized-name match
 *   0.70  prefix-of-name match (most autocomplete hits land here)
 *   0.65  prefix-of-name-token match ("york" matches "new york")
 *   0.40  substring-of-name match
 *   0.00  no match
 */
export function matchQuality(qNorm: string, nameNorm: string, id: string): number {
  if (qNorm === '') return 0;
  if (qNorm === id) return 1.0;
  if (qNorm === nameNorm) return 0.9;
  if (nameNorm.startsWith(qNorm)) return 0.7;
  if (nameNorm.split(' ').some((tok) => tok.startsWith(qNorm))) return 0.65;
  if (nameNorm.includes(qNorm)) return 0.4;
  return 0;
}

// ── bonuses ──────────────────────────────────────────────────────────────────

/**
 * Recognition bonus — Zuluy's tier-equivalent. Score 10 → +50, score 1 → +5.
 * Linear so the scale is intuitive ("how recognizable is this city" maps
 * directly to "how much does it boost in autocomplete").
 */
export function recognitionBonus(score: number): number {
  return Math.max(0, Math.min(10, score)) * 5;
}

/** log10 population tiebreak. Pure ordering signal. */
export function populationBonus(pop: number | null | undefined): number {
  if (!pop || pop <= 0) return 0;
  return Math.log10(pop + 1) * 2;
}

// ── search results ───────────────────────────────────────────────────────────

export interface SearchHit {
  id: string;
  name: string;
  countryName: string;
  score: number;
}

/**
 * Score a city against a normalized query. Empty query is "browse mode" —
 * returns the recognition+population score so a sorted list shows the most
 * recognizable cities first when nothing is typed.
 */
export function scoreCity(city: City, qNorm: string): number {
  const nameNorm = normalizeSearchTerm(city.name);
  const asciiNorm = normalizeSearchTerm(city.asciiName);
  // Match against name OR asciiName OR any alternate name; take the best.
  const candidates = [nameNorm, asciiNorm, ...city.alternateNames.map((a) => normalizeSearchTerm(a.name))];
  const mq = qNorm === '' ? 0 : Math.max(...candidates.map((c) => matchQuality(qNorm, c, city.id)));
  // Hard zero-out when a non-empty query doesn't match — keeps "?city=xyzzy"
  // from surfacing the world's biggest cities just on recognition bonus.
  if (qNorm !== '' && mq === 0) return 0;
  return mq * 100 + recognitionBonus(city.recognitionScore) + populationBonus(city.population);
}

export function cityToHit(city: City, score: number): SearchHit {
  return {
    id: city.id,
    name: city.name,
    countryName: city.countryName,
    score,
  };
}
