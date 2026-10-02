import { describe, expect, it } from 'vitest';
import { findDates, toDateInputValue } from './dates.ts';

const ymd = (d: Date) => toDateInputValue(d);

describe('findDates', () => {
  it('reads numeric French dates', () => {
    const [m] = findDates('immatriculée le 12/03/2019 au greffe');
    expect(ymd(m.date)).toBe('2019-03-12');
    expect(m.raw).toBe('12/03/2019');
    expect(m.hasYear).toBe(true);
  });

  it('reads literal dates and the first of the month', () => {
    expect(findDates('le 1er février 2024').map((m) => ymd(m.date))).toEqual(['2024-02-01']);
    expect(findDates('réunion du 4 mai 2023 à Lyon').map((m) => ymd(m.date))).toEqual(['2023-05-04']);
  });

  it('takes the reference year when the year is missing, and says so', () => {
    const [m] = findDates('réunion du 4 mai à Lyon', 2025);
    expect(ymd(m.date)).toBe('2025-05-04');
    expect(m.hasYear).toBe(false);
  });

  it('reads the time when given', () => {
    const [m] = findDates('le 24 septembre 2025 à 11 heures 19');
    expect(m.hasTime).toBe(true);
    expect(m.date.getHours()).toBe(11);
    expect(m.date.getMinutes()).toBe(19);
  });

  it('reads ISO dates and two-digit years', () => {
    expect(findDates('2024-01-15').map((m) => ymd(m.date))).toEqual(['2024-01-15']);
    expect(findDates('le 03/04/21').map((m) => ymd(m.date))).toEqual(['2021-04-03']);
  });

  it('reads dates written in words', () => {
    const [m] = findDates('Le vingt-quatre septembre deux mille vingt-cinq, à onze heures dix-neuf');
    expect(ymd(m.date)).toBe('2025-09-24');
    expect(m.date.getHours()).toBe(11);
    expect(m.date.getMinutes()).toBe(19);
    expect(m.hasYear).toBe(true);
  });

  it('reads the report header formula, year first', () => {
    const dates = findDates("L'an deux mille vingt-cinq, le premier octobre, à neuf heures");
    expect(dates).toHaveLength(1);
    expect(ymd(dates[0].date)).toBe('2025-10-01');
    expect(dates[0].date.getHours()).toBe(9);
  });

  it('mixes digits and words', () => {
    expect(findDates('le 24 septembre deux mille vingt-cinq').map((m) => ymd(m.date))).toEqual(['2025-09-24']);
    expect(findDates('le trente et un mars mil neuf cent quatre-vingt-dix-neuf').map((m) => ymd(m.date))).toEqual(['1999-03-31']);
  });

  it('rejects impossible dates', () => {
    expect(findDates('le 31/02/2024 et le 31 avril 2024')).toEqual([]);
  });

  it('does not take a month word inside another word', () => {
    expect(findDates('12 maisons')).toEqual([]);
  });
});
