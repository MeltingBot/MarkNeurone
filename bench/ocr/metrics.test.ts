import { describe, expect, it } from 'vitest';
import { bestSubstringDistance, dictionaryOf, levenshtein, pageCer, scoreSuggestions } from './metrics.ts';
import type { TruthItem } from './gen/fiction.ts';

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('bestSubstringDistance', () => {
  it('is zero when the needle appears verbatim', () => {
    expect(bestSubstringDistance('AB123CD', 'xxAB123CDyy')).toBe(0);
  });
  it('counts the misread characters', () => {
    expect(bestSubstringDistance('0612345678', 'telO6l2345678fin')).toBe(2);
  });
});

describe('pageCer', () => {
  it('ignores whitespace differences', () => {
    expect(pageCer('a b\nc', 'a  b c')).toBe(0);
  });
});

describe('scoreSuggestions', () => {
  const items: TruthItem[] = [
    { kind: 'name', value: 'TERRIER Jules', canonical: 'Jules TERRIER' },
    { kind: 'phone', value: '06 12 34 56 78' },
    { kind: 'plate', value: 'AB-123-CD' },
    { kind: 'iban', value: 'FR76 3000 6000 0112 3456 7890 189' },
    { kind: 'email', value: 'terrier.12@exemple.test' },
  ];

  it('counts found, false positives and checksum flags per kind', () => {
    const ocr = 'TERRIER Jules, tel 06 12 34 56 78 plaque AB-123-CO iban FR76 3000 6000 0112 3456 7890 188, terrier.12@exemple.test';
    const s = scoreSuggestions(items, ocr, dictionaryOf(items));
    expect(s.name).toMatchObject({ expected: 1, found: 1, falsePositives: 0 });
    expect(s.phone.found).toBe(1);
    expect(s.email.found).toBe(1);
    expect(s.plate).toMatchObject({ found: 0, falsePositives: 0 });
    expect(s.iban).toMatchObject({ found: 0, falsePositives: 1, checksumFlagged: 1, checksumMissed: 0 });
    expect(s.iban.cerSum).toBeCloseTo(1 / 27);
  });

  it('builds the dictionary from canonical names', () => {
    expect(dictionaryOf(items).map((e) => e.label)).toEqual(['Jules TERRIER']);
  });
});
