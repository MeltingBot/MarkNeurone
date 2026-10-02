import { describe, expect, it } from 'vitest';
import { bestSubstringDistance, levenshtein, pageCer, scoreIdentifiers } from './metrics.ts';

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

describe('scoreIdentifiers', () => {
  it('counts found, false positives and checksum flags', () => {
    const truth = {
      phones: ['0612345678'],
      plates: ['AB-123-CD'],
      ibans: ['FR7630006000011234567890189'],
      sirets: [],
    };
    const ocr = 'tel 06 12 34 56 78 plaque AB-123-CO iban FR76 3000 6000 0112 3456 7890 188';
    const s = scoreIdentifiers(truth, ocr);
    expect(s.phone.found).toBe(1);
    expect(s.plate.found).toBe(0);
    expect(s.iban.found).toBe(0);
    expect(s.iban.falsePositives).toBe(1);
    expect(s.iban.checksumFlagged).toBe(1);
    expect(s.iban.checksumMissed).toBe(0);
    expect(s.iban.cerSum).toBeCloseTo(1 / 27);
  });
});
