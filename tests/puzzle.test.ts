import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  puzzleDateString,
  pickPuzzleCity,
  pickRandomCity,
  formatLocalTimePrompt,
} from '../src/lib/puzzle.js';
import type { City } from '../src/lib/types.js';

function mkCity(overrides: Partial<City> = {}): City {
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
    recognitionScore: 7,
    alternateNames: [],
    ...overrides,
  };
}

describe('puzzleDateString', () => {
  it('formats UTC date as YYYY-MM-DD', () => {
    expect(puzzleDateString(new Date(Date.UTC(2026, 4, 22, 12, 0, 0)))).toBe('2026-05-22');
  });
  it('zero-pads month and day', () => {
    expect(puzzleDateString(new Date(Date.UTC(2026, 0, 3, 0, 0, 0)))).toBe('2026-01-03');
  });
});

describe('pickPuzzleCity (deterministic, seed-based)', () => {
  const cities: City[] = [
    mkCity({ id: 'aaa-aa', recognitionScore: 9 }),
    mkCity({ id: 'bbb-bb', recognitionScore: 8 }),
    mkCity({ id: 'ccc-cc', recognitionScore: 7 }),
    mkCity({ id: 'ddd-dd', recognitionScore: 6 }),
    mkCity({ id: 'eee-ee', recognitionScore: 5 }),
    mkCity({ id: 'fff-ff', recognitionScore: 2 }),
  ];

  it('same seed → same city', () => {
    const a = pickPuzzleCity(cities, 'hello');
    const b = pickPuzzleCity(cities, 'hello');
    expect(a.id).toBe(b.id);
  });

  it('different seeds produce a spread', () => {
    const picks = new Set<string>();
    for (let i = 0; i < 30; i++) picks.add(pickPuzzleCity(cities, `seed-${i}`).id);
    expect(picks.size).toBeGreaterThan(1);
  });

  it('respects minRecognition gate', () => {
    for (let i = 0; i < 50; i++) {
      const c = pickPuzzleCity(cities, `seed-${i}`, 6);
      expect(c.recognitionScore).toBeGreaterThanOrEqual(6);
    }
  });

  it('throws on empty catalogue', () => {
    expect(() => pickPuzzleCity([], 'anything')).toThrow();
  });
});

describe('pickRandomCity', () => {
  const cities: City[] = [
    mkCity({ id: 'aaa-aa', recognitionScore: 9 }),
    mkCity({ id: 'bbb-bb', recognitionScore: 8 }),
    mkCity({ id: 'ccc-cc', recognitionScore: 7 }),
    mkCity({ id: 'ddd-dd', recognitionScore: 6 }),
    mkCity({ id: 'eee-ee', recognitionScore: 5 }),
    mkCity({ id: 'fff-ff', recognitionScore: 2 }),
  ];

  afterEach(() => vi.restoreAllMocks());

  it('returns a city above the recognition gate', () => {
    for (let i = 0; i < 30; i++) {
      const c = pickRandomCity(cities, 6);
      expect(c.recognitionScore).toBeGreaterThanOrEqual(6);
    }
  });

  it('excludes ids in the exclude set', () => {
    const exclude = new Set(['aaa-aa', 'bbb-bb', 'ccc-cc']);
    for (let i = 0; i < 30; i++) {
      const c = pickRandomCity(cities, 6, exclude);
      expect(exclude.has(c.id)).toBe(false);
    }
  });

  it('falls back to ignoring exclusion when it would empty the pool', () => {
    const exclude = new Set(['aaa-aa', 'bbb-bb', 'ccc-cc', 'ddd-dd']);
    // All recognition≥6 are excluded → fallback to the recognition pool ignoring exclusion.
    const c = pickRandomCity(cities, 6, exclude);
    expect(['aaa-aa', 'bbb-bb', 'ccc-cc', 'ddd-dd']).toContain(c.id);
  });

  it('falls back to full catalogue when recognition gate empties pool', () => {
    const lowOnly: City[] = [
      mkCity({ id: 'aaa-aa', recognitionScore: 2 }),
      mkCity({ id: 'bbb-bb', recognitionScore: 1 }),
    ];
    const c = pickRandomCity(lowOnly, 9);
    expect(['aaa-aa', 'bbb-bb']).toContain(c.id);
  });

  it('is non-deterministic across calls (mock Math.random to verify)', () => {
    const rng = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    const a = pickRandomCity(cities, 6);
    const b = pickRandomCity(cities, 6);
    expect(a.id).not.toBe(b.id);
    expect(rng).toHaveBeenCalled();
  });

  it('throws on empty catalogue', () => {
    expect(() => pickRandomCity([])).toThrow();
  });
});

describe('formatLocalTimePrompt', () => {
  it('returns 12-hour format with AM/PM', () => {
    const s = formatLocalTimePrompt('Asia/Tokyo', new Date('2026-05-22T12:00:00Z'));
    expect(s).toMatch(/^9:00\s?PM$/);
  });
  it('handles fractional offsets like Kathmandu (+5:45)', () => {
    const s = formatLocalTimePrompt('Asia/Kathmandu', new Date('2026-05-22T00:00:00Z'));
    expect(s).toMatch(/^5:45\s?AM$/);
  });
});
