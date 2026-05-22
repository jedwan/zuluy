import { describe, it, expect } from 'vitest';
import { haversineKm, bearingDegrees, compassPoint } from '../src/lib/geo.js';

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(40.7128, -74.006, 40.7128, -74.006)).toBeCloseTo(0, 5);
  });

  it('Mecca → Medina is ~340km', () => {
    const km = haversineKm(21.4225, 39.8262, 24.4686, 39.6142);
    expect(km).toBeGreaterThan(320);
    expect(km).toBeLessThan(360);
  });

  it('New York → Los Angeles is ~3940km', () => {
    const km = haversineKm(40.7128, -74.006, 34.0522, -118.2437);
    expect(km).toBeGreaterThan(3900);
    expect(km).toBeLessThan(3980);
  });

  it('New York → London is ~5570km', () => {
    const km = haversineKm(40.7128, -74.006, 51.5074, -0.1278);
    expect(km).toBeGreaterThan(5550);
    expect(km).toBeLessThan(5600);
  });

  it('Tokyo → Sydney is ~7820km', () => {
    const km = haversineKm(35.6762, 139.6503, -33.8688, 151.2093);
    expect(km).toBeGreaterThan(7780);
    expect(km).toBeLessThan(7860);
  });

  it('is symmetric (a→b == b→a)', () => {
    const ab = haversineKm(35.6762, 139.6503, -33.8688, 151.2093);
    const ba = haversineKm(-33.8688, 151.2093, 35.6762, 139.6503);
    expect(ab).toBeCloseTo(ba, 5);
  });
});

describe('bearingDegrees', () => {
  it('NY → London: roughly NE, around 50°', () => {
    const b = bearingDegrees(40.7128, -74.006, 51.5074, -0.1278);
    expect(b).toBeGreaterThan(40);
    expect(b).toBeLessThan(60);
  });

  it('NY → Sydney: great-circle heads W across the Pacific, ~266°', () => {
    // Counterintuitive — Sydney is south of NY, but the great-circle path
    // is shorter heading west across continental US + Pacific than going
    // south through the Atlantic. Initial bearing is W-ish (~266°), not SW.
    const b = bearingDegrees(40.7128, -74.006, -33.8688, 151.2093);
    expect(b).toBeGreaterThan(260);
    expect(b).toBeLessThan(275);
  });

  it('London → NY: roughly W, around 290°', () => {
    const b = bearingDegrees(51.5074, -0.1278, 40.7128, -74.006);
    expect(b).toBeGreaterThan(285);
    expect(b).toBeLessThan(295);
  });

  it('Equator due-north → bearing 0', () => {
    const b = bearingDegrees(0, 0, 10, 0);
    expect(b).toBeCloseTo(0, 1);
  });

  it('Equator due-east → bearing 90', () => {
    const b = bearingDegrees(0, 0, 0, 10);
    expect(b).toBeCloseTo(90, 1);
  });

  it('Equator due-west → bearing 270', () => {
    const b = bearingDegrees(0, 0, 0, -10);
    expect(b).toBeCloseTo(270, 1);
  });

  it('always returns a value in [0, 360)', () => {
    // Spot-check a handful of arbitrary pairs.
    const pairs: [number, number, number, number][] = [
      [89, 0, -89, 180],
      [0, 179, 0, -179],
      [60, -120, -60, 60],
      [-45, 45, 45, -45],
    ];
    for (const [a, b, c, d] of pairs) {
      const bearing = bearingDegrees(a, b, c, d);
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThan(360);
    }
  });
});

describe('compassPoint', () => {
  it('cardinals', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
  });
  it('intercardinals', () => {
    expect(compassPoint(45)).toBe('NE');
    expect(compassPoint(135)).toBe('SE');
    expect(compassPoint(225)).toBe('SW');
    expect(compassPoint(315)).toBe('NW');
  });
  it('North wraparound near 360°', () => {
    expect(compassPoint(359)).toBe('N');
    expect(compassPoint(1)).toBe('N');
    expect(compassPoint(355)).toBe('N');
    expect(compassPoint(20)).toBe('N');
  });
  it('handles input outside [0, 360)', () => {
    expect(compassPoint(720)).toBe('N');
    expect(compassPoint(-45)).toBe('NW');
  });
});
