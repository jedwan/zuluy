import { describe, it, expect } from 'vitest';
import { defaultStats, loadStats, recordGameEnd, formatStatsLine, type Stats } from '../src/lib/stats.js';

function makeStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    snapshot: () => Object.fromEntries(map),
  };
}

describe('loadStats', () => {
  it('returns defaults for empty storage', () => {
    expect(loadStats(makeStore())).toEqual(defaultStats());
  });
  it('parses saved stats', () => {
    const saved: Stats = {
      gamesPlayed: 5,
      wins: 4,
      currentStreak: 2,
      maxStreak: 3,
      guessDistribution: [1, 0, 2, 1, 0],
    };
    const store = makeStore({ 'zuluy.stats': JSON.stringify(saved) });
    expect(loadStats(store)).toEqual(saved);
  });
  it('backfills missing keys', () => {
    const store = makeStore({ 'zuluy.stats': JSON.stringify({ gamesPlayed: 3, wins: 2 }) });
    const out = loadStats(store);
    expect(out.gamesPlayed).toBe(3);
    expect(out.wins).toBe(2);
    expect(out.guessDistribution).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('recordGameEnd — streak is consecutive wins', () => {
  it('first win → games=1, wins=1, streak=1, dist[2]=1 (3-guess win)', () => {
    const store = makeStore();
    const out = recordGameEnd('won', 3, store);
    expect(out.gamesPlayed).toBe(1);
    expect(out.wins).toBe(1);
    expect(out.currentStreak).toBe(1);
    expect(out.maxStreak).toBe(1);
    expect(out.guessDistribution).toEqual([0, 0, 1, 0, 0]);
  });

  it('consecutive wins extend streak', () => {
    const store = makeStore();
    recordGameEnd('won', 2, store);
    recordGameEnd('won', 4, store);
    const out = recordGameEnd('won', 1, store);
    expect(out.currentStreak).toBe(3);
    expect(out.maxStreak).toBe(3);
  });

  it('a loss resets currentStreak; maxStreak preserved', () => {
    const store = makeStore();
    recordGameEnd('won', 1, store);
    recordGameEnd('won', 1, store);
    recordGameEnd('won', 1, store); // streak 3, max 3
    const afterLoss = recordGameEnd('lost', 5, store);
    expect(afterLoss.currentStreak).toBe(0);
    expect(afterLoss.maxStreak).toBe(3);
    const afterRecovery = recordGameEnd('won', 2, store);
    expect(afterRecovery.currentStreak).toBe(1);
    expect(afterRecovery.maxStreak).toBe(3);
  });

  it('back-to-back games increment gamesPlayed each call (no date idempotency)', () => {
    const store = makeStore();
    recordGameEnd('won', 1, store);
    recordGameEnd('won', 1, store);
    const out = recordGameEnd('won', 1, store);
    expect(out.gamesPlayed).toBe(3);
  });

  it('out-of-range guessCount is ignored in distribution', () => {
    const store = makeStore();
    const out = recordGameEnd('won', 99, store);
    expect(out.wins).toBe(1);
    expect(out.guessDistribution).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('formatStatsLine', () => {
  it('empty for zero games', () => {
    expect(formatStatsLine(defaultStats())).toBe('');
  });
  it('one win', () => {
    const s: Stats = {
      gamesPlayed: 1,
      wins: 1,
      currentStreak: 1,
      maxStreak: 1,
      guessDistribution: [0, 0, 1, 0, 0],
    };
    expect(formatStatsLine(s)).toBe('1 played · 100% · streak 1');
  });
  it('streak diverges from best', () => {
    const s: Stats = {
      gamesPlayed: 10,
      wins: 7,
      currentStreak: 2,
      maxStreak: 5,
      guessDistribution: [1, 1, 2, 2, 1],
    };
    expect(formatStatsLine(s)).toBe('10 played · 70% · streak 2 (best 5)');
  });
  it('current streak at zero shows best only', () => {
    const s: Stats = {
      gamesPlayed: 5,
      wins: 3,
      currentStreak: 0,
      maxStreak: 4,
      guessDistribution: [0, 1, 1, 1, 0],
    };
    expect(formatStatsLine(s)).toBe('5 played · 60% · streak 4');
  });
});
