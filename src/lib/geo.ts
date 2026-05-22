// Geographic primitives for the puzzle's hint logic.
//
// Kept in a separate file from search.ts because these CAN inform the puzzle
// (after a guess, we want to tell the player how far and in what direction
// the answer city is) but MUST NOT inform autocomplete ranking — see the
// comment at the top of search.ts. Separation by file makes the rule visible.

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * Great-circle distance in kilometres between two points.
 * Symmetric — order of arguments doesn't matter.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Initial bearing (forward azimuth) in degrees from point A to point B,
 * normalized to [0, 360). 0° = North, 90° = East, 180° = South, 270° = West.
 *
 * Note: this is the initial bearing along the great-circle path, not the
 * constant rhumb-line bearing. For Zuluy's hint UX (showing "this direction
 * from your guess"), great-circle is correct — it's the shortest path on a
 * sphere and matches the player's mental model when they think "if I go
 * northeast from here, do I find the answer?"
 */
export function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Compass label for a bearing in degrees. Eight points so the hint reads
 * naturally ("northeast" not "47°"). The hint UI can also render an arrow
 * rotated by the raw degrees if it wants a finer visual signal.
 */
export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export function compassPoint(bearing: number): CompassPoint {
  // 8 sectors of 45° centred on each cardinal/intercardinal direction.
  // North is the wraparound case: 337.5° to 22.5° → N.
  const sectors: CompassPoint[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const i = Math.round(((bearing + 360) % 360) / 45) % 8;
  return sectors[i]!;
}
