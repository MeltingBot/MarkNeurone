import { describe, expect, it } from 'vitest';
import { findDateRange, findDates, toDateInputValue } from './dates.ts';

const ymd = (d: Date) => toDateInputValue(d);

describe('findDates', () => {
  it('reads numeric dates as native PDF text layers hold them', () => {
    for (const text of ['07 / 07 / 2004', '07/ 07 /2004', '07\u22157\u20442004', '07\u200B/07/2004', '\uFF10\uFF17/07/2004', '07\u201107\u20112004']) {
      expect(findDates(text).map((m) => ymd(m.date))).toEqual(['2004-07-07']);
    }
    const [m] = findDates('circulation 07 / 07 / 2004 Puissance');
    expect([m.raw, m.start, m.end]).toEqual(['07 / 07 / 2004', 12, 26]);
    expect(findDates('art. 1 - 2 - 24 et 3 . 4 . 2024')).toEqual([]);
  });

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

describe('findDateRange', () => {
  it('takes the first two dates of the passage, with their times', () => {
    const r = findDateRange(findDates('Entre le 02/07/2026 20:00 et le 03/07/2026 07:00'));
    expect(r && [toDateInputValue(r.start.date), r.start.date.getHours(), toDateInputValue(r.end.date), r.end.date.getHours()]).toEqual(['2026-07-02', 20, '2026-07-03', 7]);
  });

  it('proposes no period with a single date, or an end before the start', () => {
    expect(findDateRange(findDates('le 02/07/2026'))).toBeNull();
    expect(findDateRange(findDates('entre le 05/07/2026 et le 02/07/2026'))).toBeNull();
  });
});
