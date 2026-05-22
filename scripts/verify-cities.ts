// Verification checks for data/cities.json.
//
// Run after the eSalah export: `pnpm verify:cities`.
// Reports the nine checks listed in the plan; exits non-zero on red flags.

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { City } from '../src/lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CITIES_PATH = join(__dirname, '..', 'public', 'cities.json');
const OVERRIDES_PATH = join(__dirname, '..', 'data', 'recognition-overrides.json');

interface Issue {
  level: 'warn' | 'error';
  msg: string;
}

async function main() {
  const cities = JSON.parse(await readFile(CITIES_PATH, 'utf8')) as City[];
  const overrides = JSON.parse(await readFile(OVERRIDES_PATH, 'utf8')) as Record<string, number>;
  const issues: Issue[] = [];

  console.log(`\n— Zuluy cities.json verification — ${cities.length} entries —\n`);

  // 1. Count check
  if (cities.length < 400 || cities.length > 600) {
    issues.push({ level: 'warn', msg: `count ${cities.length} outside expected 400–600 band` });
  } else {
    console.log(`[1] count ............... ${cities.length} ✓`);
  }

  // 2. Capital completeness — we don't have a "capital" flag in the output,
  //    so we can only spot-check: for each country, does the dataset include
  //    AT LEAST ONE city with the typical capital recognition profile?
  //    Surface countries with only 1 city as candidate gaps.
  const byCountry = new Map<string, City[]>();
  for (const c of cities) {
    if (!byCountry.has(c.country)) byCountry.set(c.country, []);
    byCountry.get(c.country)!.push(c);
  }
  console.log(`[2] countries represented . ${byCountry.size}`);

  // 3. Timezone coverage — distinct utcOffsetMinutes values and a representative city
  const offsets = new Map<number, string>();
  for (const c of cities) {
    if (!offsets.has(c.utcOffsetMinutes)) {
      offsets.set(c.utcOffsetMinutes, `${c.name}, ${c.country}`);
    }
  }
  const sortedOffsets = [...offsets.entries()].sort(([a], [b]) => a - b);
  console.log(`[3] distinct UTC offsets .. ${offsets.size}`);
  console.log('     ' + sortedOffsets.map(([o, c]) => `${fmtOffset(o)}:${c.split(',')[0]}`).join('  '));
  // Flag unusual offsets that are absent
  const unusual: [number, string][] = [
    [345, 'Kathmandu (+5:45)'],
    [570, 'Adelaide (+9:30)'],
    [330, 'Kolkata (+5:30)'],
    [-210, "St. John's (-3:30)"],
    [780, 'Apia / Nukuʻalofa (+13)'],
  ];
  for (const [off, label] of unusual) {
    if (!offsets.has(off)) issues.push({ level: 'warn', msg: `unusual offset ${fmtOffset(off)} (${label}) has no cities` });
  }

  // 4. Hemisphere balance
  const north = cities.filter((c) => c.hemisphere === 'north').length;
  const south = cities.length - north;
  const pctNorth = Math.round((100 * north) / cities.length);
  console.log(`[4] hemisphere split ..... ${north} N / ${south} S (${pctNorth}% N)`);
  if (pctNorth > 85) {
    issues.push({ level: 'warn', msg: `northern hemisphere is ${pctNorth}% — boost southern cities before launch` });
  }

  // 5. utcOffsetMinutes integrity — assert against Intl on the city's tz
  let offsetMismatches = 0;
  for (const c of cities) {
    const ref =
      c.hemisphere === 'north' ? new Date(Date.UTC(2026, 0, 15)) : new Date(Date.UTC(2026, 6, 15));
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: c.tz, timeZoneName: 'longOffset' });
    const offsetStr = fmt.formatToParts(ref).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const m = offsetStr.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    const sign = m ? (m[1] === '+' ? 1 : -1) : 1;
    const expected = m ? sign * (parseInt(m[2]!, 10) * 60 + parseInt(m[3] ?? '0', 10)) : 0;
    if (expected !== c.utcOffsetMinutes) {
      offsetMismatches++;
      if (offsetMismatches <= 5) {
        issues.push({
          level: 'error',
          msg: `utcOffsetMinutes mismatch for ${c.id}: stored ${c.utcOffsetMinutes}, Intl says ${expected}`,
        });
      }
    }
  }
  if (offsetMismatches === 0) console.log(`[5] utcOffsetMinutes ...... all ${cities.length} match Intl ✓`);

  // 6. recognitionScore histogram + override sanity
  const histo = new Map<number, number>();
  for (const c of cities) histo.set(c.recognitionScore, (histo.get(c.recognitionScore) ?? 0) + 1);
  const histoLine = [...histo.entries()]
    .sort(([a], [b]) => a - b)
    .map(([k, v]) => `${k}:${v}`)
    .join('  ');
  console.log(`[6] recognitionScore hist . ${histoLine}`);
  for (const c of cities) {
    if (c.recognitionScore < 1 || c.recognitionScore > 10) {
      issues.push({ level: 'error', msg: `recognitionScore out of range for ${c.id}: ${c.recognitionScore}` });
    }
  }
  const idSet = new Set(cities.map((c) => c.id));
  for (const [k, v] of Object.entries(overrides)) {
    if (!idSet.has(k)) {
      issues.push({ level: 'warn', msg: `recognition override "${k}" → ${v} has no matching city in the dataset` });
    } else {
      const actual = cities.find((c) => c.id === k)!.recognitionScore;
      if (actual !== v) {
        issues.push({ level: 'error', msg: `override for ${k} should be ${v} but dataset has ${actual}` });
      }
    }
  }

  // 7. Lifted tests pass — informational only; run via `pnpm test`
  console.log(`[7] (run "pnpm test" to verify lifted tests)`);

  // 8. Spot-check 10 cities — print local time at each
  const sample = pickSample(cities, 10);
  console.log(`[8] spot-check local times:`);
  for (const c of sample) {
    const local = new Intl.DateTimeFormat('en-US', { timeZone: c.tz, timeStyle: 'short' }).format(new Date());
    console.log(`     ${c.name}, ${c.country} (${c.tz}) → ${local}`);
  }

  // 9. Determinism — only enforceable by re-running the export and comparing.
  console.log(`[9] (re-run the export script and diff to verify determinism)`);

  // Summary
  console.log('');
  if (issues.length === 0) {
    console.log('✓ no issues');
    process.exit(0);
  }
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  for (const i of issues) console.log(`  [${i.level}] ${i.msg}`);
  console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);
  process.exit(errors.length > 0 ? 1 : 0);
}

function fmtOffset(min: number): string {
  const sign = min >= 0 ? '+' : '-';
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function pickSample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  const step = arr.length / n;
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]!);
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
