import { describe, it, expect } from 'vitest';
import {
  squaresFromDistance,
  arrowForBearing,
  buildShareGrid,
} from '../src/lib/share.js';
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
    recognitionScore: 5,
    alternateNames: [],
    ...overrides,
  };
}

describe('squaresFromDistance', () => {
  it('< 500km → 5 squares', () => {
    expect(squaresFromDistance(0)).toBe(5);
    expect(squaresFromDistance(499)).toBe(5);
  });
  it('500-1500km → 4 squares', () => {
    expect(squaresFromDistance(500)).toBe(4);
    expect(squaresFromDistance(1499)).toBe(4);
  });
  it('1500-5000km → 3 squares', () => {
    expect(squaresFromDistance(2147)).toBe(3); // London→Chișinău
    expect(squaresFromDistance(4999)).toBe(3);
  });
  it('5000-12000km → 2 squares', () => {
    expect(squaresFromDistance(8534)).toBe(2); // Tokyo→Chișinău
    expect(squaresFromDistance(11999)).toBe(2);
  });
  it('12000-20000km → 1 square', () => {
    expect(squaresFromDistance(15000)).toBe(1);
    expect(squaresFromDistance(19999)).toBe(1);
  });
  it('antipode → 0 squares', () => {
    expect(squaresFromDistance(20015)).toBe(0);
  });
});

describe('arrowForBearing', () => {
  it('cardinals', () => {
    expect(arrowForBearing(0)).toBe('⬆️');
    expect(arrowForBearing(90)).toBe('➡️');
    expect(arrowForBearing(180)).toBe('⬇️');
    expect(arrowForBearing(270)).toBe('⬅️');
  });
  it('intercardinals', () => {
    expect(arrowForBearing(45)).toBe('↗️');
    expect(arrowForBearing(135)).toBe('↘️');
    expect(arrowForBearing(225)).toBe('↙️');
    expect(arrowForBearing(315)).toBe('↖️');
  });
  it('wraps around', () => {
    expect(arrowForBearing(359)).toBe('⬆️');
    expect(arrowForBearing(720)).toBe('⬆️');
    expect(arrowForBearing(-45)).toBe('↖️');
  });
});

describe('buildShareGrid', () => {
  const answer = mkCity({ id: 'chisinau-md', name: 'Chișinău', lat: 47.005, lng: 28.857 });
  const tokyo = mkCity({ id: 'tokyo-jp', name: 'Tokyo', lat: 35.6895, lng: 139.6917 });
  const london = mkCity({ id: 'london-gb', name: 'London', lat: 51.5074, lng: -0.1278 });

  it('won in 1 — single line + 🎯, no date in header', () => {
    const out = buildShareGrid(answer, [answer], 'won');
    expect(out).toBe(['zuluy. 1/5', '', '🟩🟩🟩🟩🟩 🎯', '', 'zuluy.com'].join('\n'));
  });

  it('won in 3 — wrong wrong hit', () => {
    const out = buildShareGrid(answer, [tokyo, london, answer], 'won');
    expect(out).toBe(
      [
        'zuluy. 3/5',
        '',
        '🟩🟩⬜⬜⬜ ↖️',
        '🟩🟩🟩⬜⬜ ➡️',
        '🟩🟩🟩🟩🟩 🎯',
        '',
        'zuluy.com',
      ].join('\n'),
    );
  });

  it('lost — X/5 + no 🎯', () => {
    const out = buildShareGrid(answer, [tokyo, london, tokyo, london, tokyo], 'lost');
    expect(out.startsWith('zuluy. X/5')).toBe(true);
    expect(out).not.toContain('🎯');
    expect(out.endsWith('zuluy.com')).toBe(true);
  });
});
