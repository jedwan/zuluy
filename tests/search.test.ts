// Tests for the city search ranker (src/lib/search.ts). Ported from eSalah,
// pruned to the cases that apply to Zuluy:
//   • normalization of diacritics + casing
//   • match-quality tiers (exact id > exact name > prefix > token-prefix > contains)
//   • recognition + population bonuses
//   • no-match-on-non-empty-query → 0 (keeps "xyzzy" from surfacing big cities)
//   • empty-query browse-mode returns recognition+population score
//
// eSalah's geo_bonus, mosque, and place ranking tests are intentionally
// omitted — see the comment at the top of src/lib/search.ts for the
// game-design rationale.

import { describe, it, expect } from 'vitest';
import {
  normalizeSearchTerm,
  matchQuality,
  scoreCity,
  recognitionBonus,
  populationBonus,
  cityToHit,
} from '../src/lib/search.js';
import type { City } from '../src/lib/types.js';

function makeCity(overrides: Partial<City> = {}): City {
  return {
    id: 'testville-xx',
    name: 'Testville',
    asciiName: 'Testville',
    country: 'XX',
    countryName: 'Testland',
    lat: 0,
    lng: 0,
    hemisphere: 'north',
    tz: 'UTC',
    utcOffsetMinutes: 0,
    population: 10_000,
    recognitionScore: 5,
    alternateNames: [],
    ...overrides,
  };
}

describe('normalizeSearchTerm', () => {
  it('lowercases', () => expect(normalizeSearchTerm('LONDON')).toBe('london'));
  it('strips diacritics', () => {
    expect(normalizeSearchTerm('Café')).toBe('cafe');
    expect(normalizeSearchTerm('İstanbul')).toBe('istanbul');
    expect(normalizeSearchTerm('Köln')).toBe('koln');
    expect(normalizeSearchTerm('Zürich')).toBe('zurich');
  });
  it('collapses whitespace and trims', () => {
    expect(normalizeSearchTerm('  New   York  ')).toBe('new york');
  });
  it('strips punctuation but keeps hyphens', () => {
    expect(normalizeSearchTerm("St. John's")).toBe('st john s');
    expect(normalizeSearchTerm('kuala-lumpur')).toBe('kuala-lumpur');
  });
});

describe('matchQuality', () => {
  it('exact id match → 1.0', () => {
    expect(matchQuality('london-gb', 'london', 'london-gb')).toBe(1.0);
  });
  it('exact normalized-name match → 0.9', () => {
    expect(matchQuality('new york', 'new york', 'new-york-us')).toBe(0.9);
  });
  it('prefix-of-name match → 0.7', () => {
    expect(matchQuality('lon', 'london', 'london-gb')).toBe(0.7);
  });
  it('whitespace-token prefix → 0.65', () => {
    expect(matchQuality('york', 'new york', 'new-york-us')).toBe(0.65);
  });
  it('substring match → 0.4', () => {
    expect(matchQuality('ond', 'london', 'london-gb')).toBe(0.4);
  });
  it('no match → 0', () => {
    expect(matchQuality('xyz', 'london', 'london-gb')).toBe(0);
  });
  it('empty query → 0', () => {
    expect(matchQuality('', 'london', 'london-gb')).toBe(0);
  });
});

describe('recognitionBonus + populationBonus', () => {
  it('recognitionBonus is linear: 10 → 50, 1 → 5', () => {
    expect(recognitionBonus(10)).toBe(50);
    expect(recognitionBonus(5)).toBe(25);
    expect(recognitionBonus(1)).toBe(5);
  });
  it('recognitionBonus clamps out-of-range scores', () => {
    expect(recognitionBonus(11)).toBe(50);
    expect(recognitionBonus(0)).toBe(0);
    expect(recognitionBonus(-3)).toBe(0);
  });
  it('population bonus is log-scaled', () => {
    const small = populationBonus(1_000);
    const big = populationBonus(10_000_000);
    expect(big).toBeGreaterThan(small);
    expect(big / small).toBeLessThan(3);
  });
  it('null/zero population → 0 bonus', () => {
    expect(populationBonus(null)).toBe(0);
    expect(populationBonus(0)).toBe(0);
  });
});

describe('scoreCity — ranking rules', () => {
  it('high recognition beats low recognition at equal match quality', () => {
    const highRec = makeCity({ name: 'Alphatown', id: 'alphatown-aa', recognitionScore: 9, population: 100_000 });
    const lowRec = makeCity({ name: 'Alphatown', id: 'alphatown-bb', recognitionScore: 2, population: 100_000 });
    expect(scoreCity(highRec, 'alphatown')).toBeGreaterThan(scoreCity(lowRec, 'alphatown'));
  });

  it('exact id match beats prefix match at same recognition', () => {
    const exact = makeCity({ name: 'London', id: 'london-gb', recognitionScore: 5 });
    const prefix = makeCity({ name: 'Londonderry', id: 'londonderry-gb', recognitionScore: 5 });
    expect(scoreCity(exact, 'london-gb')).toBeGreaterThan(scoreCity(prefix, 'london-gb'));
  });

  it('population breaks ties at equal recognition and match quality', () => {
    const big = makeCity({ name: 'Bigcity', id: 'bigcity-1', recognitionScore: 5, population: 10_000_000 });
    const small = makeCity({ name: 'Bigcity', id: 'bigcity-2', recognitionScore: 5, population: 10_000 });
    expect(scoreCity(big, 'bigcity')).toBeGreaterThan(scoreCity(small, 'bigcity'));
  });

  it('diacritic-insensitive matching: "zurich" matches Zürich', () => {
    const zurich = makeCity({ name: 'Zürich', asciiName: 'Zurich', id: 'zurich-ch' });
    expect(scoreCity(zurich, normalizeSearchTerm('zurich'))).toBeGreaterThan(0);
  });

  it('matches via alternateNames (Mumbai ↔ Bombay)', () => {
    const mumbai = makeCity({
      name: 'Mumbai',
      asciiName: 'Mumbai',
      id: 'mumbai-in',
      alternateNames: [{ name: 'Bombay', lang: 'en', isPreferred: false }],
    });
    expect(scoreCity(mumbai, 'bombay')).toBeGreaterThan(0);
  });

  it('no match against a non-empty query → 0 (drops the row)', () => {
    const c = makeCity({ recognitionScore: 10, population: 1_000_000 });
    expect(scoreCity(c, 'nonsense')).toBe(0);
  });

  it('empty query → recognition+population score (browse-mode ranking)', () => {
    const c = makeCity({ recognitionScore: 8, population: 1_000_000 });
    expect(scoreCity(c, '')).toBe(recognitionBonus(8) + populationBonus(1_000_000));
  });
});

describe('cityToHit — result shape', () => {
  it('returns id, name, countryName, score', () => {
    const c = makeCity({ name: 'London', countryName: 'United Kingdom' });
    const hit = cityToHit(c, 123);
    expect(hit).toEqual({
      id: 'testville-xx',
      name: 'London',
      countryName: 'United Kingdom',
      score: 123,
    });
  });
});
