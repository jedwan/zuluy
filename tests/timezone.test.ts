import { describe, it, expect } from 'vitest';
import { timezoneForLatLng, isValidTimezone } from '../src/lib/timezone.js';

describe('timezoneForLatLng', () => {
  it('resolves London to Europe/London', () => {
    expect(timezoneForLatLng(51.5074, -0.1278)).toBe('Europe/London');
  });

  it('resolves Jakarta to Asia/Jakarta', () => {
    expect(timezoneForLatLng(-6.2088, 106.8456)).toBe('Asia/Jakarta');
  });

  it('resolves New York to America/New_York', () => {
    expect(timezoneForLatLng(40.7128, -74.006)).toBe('America/New_York');
  });

  it('resolves Tokyo to Asia/Tokyo', () => {
    expect(timezoneForLatLng(35.6762, 139.6503)).toBe('Asia/Tokyo');
  });

  it('resolves Kathmandu to Asia/Kathmandu (the +5:45 city)', () => {
    expect(timezoneForLatLng(27.7172, 85.324)).toBe('Asia/Kathmandu');
  });

  it('throws on invalid coordinates', () => {
    expect(() => timezoneForLatLng(NaN, 0)).toThrow();
    expect(() => timezoneForLatLng(91, 0)).toThrow();
    expect(() => timezoneForLatLng(0, 181)).toThrow();
  });

  it('memoises repeat calls on rounded coordinates', () => {
    const a = timezoneForLatLng(51.5074, -0.1278);
    const b = timezoneForLatLng(51.5078, -0.1281); // same to 3dp
    expect(a).toBe(b);
  });
});

describe('isValidTimezone', () => {
  it('accepts real IANA names', () => {
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('Asia/Kathmandu')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
  });

  it('rejects garbage', () => {
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone('Not/A/Real/Zone')).toBe(false);
  });
});
