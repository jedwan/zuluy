// Latitude/longitude → IANA timezone resolver.
//
// Wraps `tz-lookup` (5MB on-disk tz boundary data, ~2 MB after minification)
// with a tiny memo so repeat calls on the same rounded coordinates are free.
//
// Server-only. The tz-lookup table is too big to ship to the browser;
// client-side code receives the tz string already resolved (it's stored in
// each row of `data/cities.json`).
//
// Ported from eSalah's `src/lib/timezone.ts` with no logic changes — see the
// plan at ~/.claude/plans/all-five-let-s-do-breezy-waffle.md.

import tzlookup from 'tz-lookup';

/**
 * IANA timezone name for the given point. Always returns a string; throws
 * only for extreme invalid inputs (lat out of range, NaN).
 *
 * Round lat/lng to 3 decimal places (~110 m) to keep the memo key small;
 * timezone boundaries don't jitter on smaller scales.
 */
export function timezoneForLatLng(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new RangeError(`invalid coordinates: ${lat},${lng}`);
  }
  const key = `${lat.toFixed(3)}|${lng.toFixed(3)}`;
  const cached = memo.get(key);
  if (cached) return cached;
  const tz = tzlookup(lat, lng);
  memo.set(key, tz);
  return tz;
}

const memo = new Map<string, string>();

/**
 * Check whether a timezone string looks valid to the runtime. Useful for
 * sanity-checking input before we put it in the catalogue.
 *
 * Constructing a DateTimeFormat with an invalid tz throws RangeError; valid
 * zones (including legacy aliases like `Asia/Kolkata` → `Asia/Calcutta`)
 * all succeed.
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
