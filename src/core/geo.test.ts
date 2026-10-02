import { describe, expect, it } from 'vitest';
import { formatCoordinate, parseCoordinate, parseLatLng } from './geo.ts';

describe('parseCoordinate', () => {
  it('reads decimal degrees, comma or dot', () => {
    expect(parseCoordinate('48.8566', 90)).toBe(48.8566);
    expect(parseCoordinate(' 2,3522 ', 180)).toBe(2.3522);
    expect(parseCoordinate('-0.57', 180)).toBe(-0.57);
  });

  it('rejects out of range or malformed values', () => {
    expect(parseCoordinate('91', 90)).toBeNull();
    expect(parseCoordinate('181', 180)).toBeNull();
    expect(parseCoordinate('48°51', 90)).toBeNull();
    expect(parseCoordinate('', 90)).toBeNull();
  });
});

describe('parseLatLng', () => {
  it('needs both values', () => {
    expect(parseLatLng('48.85', '2.35')).toEqual({ lat: 48.85, lng: 2.35 });
    expect(parseLatLng('48.85', '')).toBeNull();
  });
});

describe('formatCoordinate', () => {
  it('rounds to 6 decimals', () => {
    expect(formatCoordinate(48.856613789)).toBe('48.856614');
  });
});
