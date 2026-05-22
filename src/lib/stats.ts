// Player stats — localStorage-backed, additive on game completion.
//
// Post-pivot (2026-05-22, unlimited model): streak is consecutive WINS
// (resets on loss), not consecutive days. lastPlayedDate is gone — every
// game is its own event.

const STORAGE_KEY = 'zuluy.stats';

export interface Stats {
  gamesPlayed: number;
  wins: number;
  /** Consecutive wins. Resets to 0 on a loss; increments on each win. */
  currentStreak: number;
  maxStreak: number;
  /** Index 0 = win in 1 guess, index 4 = win in 5. Losses not counted here. */
  guessDistribution: number[];
}

export function defaultStats(): Stats {
  return {
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: [0, 0, 0, 0, 0],
  };
}

/**
 * Read stats from localStorage. Missing keys backfill to defaults so a
 * schema bump doesn't crash an older saved state.
 */
export function loadStats(storage: Pick<Storage, 'getItem'> = localStorage): Stats {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return { ...defaultStats(), ...parsed };
  } catch {
    return defaultStats();
  }
}

/**
 * Record a game end and return the updated stats. Each call increments
 * gamesPlayed — no idempotency gate. The unlimited model relies on the
 * caller to invoke this once per completed puzzle.
 */
export function recordGameEnd(
  status: 'won' | 'lost',
  guessCount: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): Stats {
  const stats = loadStats(storage);
  stats.gamesPlayed++;

  if (status === 'won') {
    stats.wins++;
    if (guessCount >= 1 && guessCount <= 5) stats.guessDistribution[guessCount - 1]++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
  } else {
    stats.currentStreak = 0;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* storage off; in-memory only */
  }
  return stats;
}

/**
 * Render a one-line stats summary in the brand voice:
 *   "23 played · 78% · streak 4 (best 7)"
 * Returns empty string when there's nothing to show (zero games).
 */
export function formatStatsLine(stats: Stats): string {
  if (stats.gamesPlayed === 0) return '';
  const pct = Math.round((stats.wins / stats.gamesPlayed) * 100);
  const streak = stats.currentStreak;
  const best = stats.maxStreak;
  const streakPart = streak > 0 && streak !== best ? `streak ${streak} (best ${best})` : `streak ${best}`;
  return `${stats.gamesPlayed} played · ${pct}% · ${streakPart}`;
}
