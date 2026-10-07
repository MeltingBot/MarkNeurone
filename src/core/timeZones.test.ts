import { describe, expect, it } from 'vitest';
import { dateFromInputKeys, dateInputKeys, timeZoneCity } from './timeZones.ts';

describe('time zones', () => {
  it('reads the typed hours in the source zone', () => {
    // Beirut is UTC+3 in July.
    expect(dateFromInputKeys('2026-07-02', '20:00', 'Asia/Beirut').toISOString()).toBe('2026-07-02T17:00:00.000Z');
    expect(dateFromInputKeys('2026-01-15', '08:30', 'Europe/Paris').toISOString()).toBe('2026-01-15T07:30:00.000Z');
    expect(dateFromInputKeys('2026-07-15', '08:30', 'Europe/Paris').toISOString()).toBe('2026-07-15T06:30:00.000Z');
  });

  it('shows an instant as the wall clock of the zone, across midnight', () => {
    expect(dateInputKeys(new Date('2026-07-02T22:30:00Z'), 'Asia/Beirut')).toEqual({ date: '2026-07-03', time: '01:30' });
  });

  it('round-trips, including on a DST change day', () => {
    for (const [d, t] of [['2026-03-29', '04:00'], ['2026-10-25', '01:30'], ['2026-07-02', '00:00']]) {
      expect(dateInputKeys(dateFromInputKeys(d, t, 'Europe/Paris'), 'Europe/Paris')).toEqual({ date: d, time: t });
    }
  });

  it('names a zone by its city', () => {
    expect(timeZoneCity('America/New_York')).toBe('New York');
  });
});
