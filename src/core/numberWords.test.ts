import { describe, expect, it } from 'vitest';
import { numberValue, yearValue } from './numberWords.ts';

describe('numberValue', () => {
  it('reads digits and words', () => {
    expect(numberValue('12')).toBe(12);
    expect(numberValue('premier')).toBe(1);
    expect(numberValue('dix-neuf')).toBe(19);
    expect(numberValue('vingt et un')).toBe(21);
    expect(numberValue('Vingt-Quatre')).toBe(24);
    expect(numberValue('soixante et onze')).toBe(71);
    expect(numberValue('quatre-vingts')).toBe(80);
    expect(numberValue('quatre vingt dix neuf')).toBe(99);
  });

  it('reads the Belgian and Swiss tens', () => {
    expect(numberValue('septante')).toBe(70);
    expect(numberValue('septante et un')).toBe(71);
    expect(numberValue('septante-cinq')).toBe(75);
    expect(numberValue('huitante')).toBe(80);
    expect(numberValue('octante-deux')).toBe(82);
    expect(numberValue('nonante-neuf')).toBe(99);
    expect(yearValue('mille neuf cent septante-cinq')).toBe(1975);
  });

  it('rejects anything else', () => {
    expect(numberValue('cent')).toBeNull();
    expect(numberValue('vingtaine')).toBeNull();
  });
});

describe('yearValue', () => {
  it('reads years in words', () => {
    expect(yearValue('deux mille vingt-cinq')).toBe(2025);
    expect(yearValue('deux mille')).toBe(2000);
    expect(yearValue('mil neuf cent quatre-vingt-dix')).toBe(1990);
    expect(yearValue('2019')).toBe(2019);
  });
});
