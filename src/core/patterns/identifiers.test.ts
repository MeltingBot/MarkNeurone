import { describe, expect, it } from 'vitest';
import { extractIdentifiers } from './identifiers.ts';

const kinds = (text: string) => extractIdentifiers(text).map((m) => [m.kind, m.value]);

describe('extractIdentifiers', () => {
  it('finds French phone numbers in several formats', () => {
    expect(kinds('Tél. 06 12 34 56 78, fixe 01.45.67.89.10 ou +33 (0)7 11 22 33 44')).toEqual([
      ['phone', '0612345678'],
      ['phone', '0145678910'],
      ['phone', '0711223344'],
    ]);
  });

  it('finds SIV and FNI plates', () => {
    expect(kinds('véhicule immatriculé AB-123-CD puis 1234 XY 75')).toEqual([
      ['plate', 'AB-123-CD'],
      ['plate', '1234 XY 75'],
    ]);
  });

  it('finds an IBAN and flags its checksum', () => {
    const [ok] = extractIdentifiers('compte FR76 3000 6000 0112 3456 7890 189 ouvert');
    expect(ok.kind).toBe('iban');
    expect(ok.checksumOk).toBe(true);
    const [bad] = extractIdentifiers('compte FR76 3000 6000 0112 3456 7890 188 ouvert');
    expect(bad.checksumOk).toBe(false);
  });

  it('finds a SIRET without mistaking it for a phone', () => {
    expect(kinds('SIRET 732 829 320 00074')).toEqual([['siret', '73282932000074']]);
  });

  it('keeps offsets pointing to the raw text', () => {
    const text = 'appel au 06 12 34 56 78.';
    const [m] = extractIdentifiers(text);
    expect(text.slice(m.start, m.end)).toBe(m.raw);
  });

  it('tolerates doubled spaces and line breaks inside an identifier', () => {
    expect(kinds('au 04  60 48 05\n02, SIRET 732 829 320\n00074')).toEqual([
      ['phone', '0460480502'],
      ['siret', '73282932000074'],
    ]);
  });

  it('does not match inside longer digit runs', () => {
    expect(kinds('réf 1234567890123')).toEqual([]);
  });
});
