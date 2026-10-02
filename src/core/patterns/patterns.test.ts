import { describe, expect, it } from 'vitest';
import { extractPatterns, type PatternKind } from './patterns.ts';

const found = (text: string) => extractPatterns(text).map((m) => ({ kind: m.kind, text: text.slice(m.start, m.end), ...(m.checksumOk !== undefined ? { ok: m.checksumOk } : {}) }));
const kinds = (text: string): PatternKind[] => extractPatterns(text).map((m) => m.kind);

describe('extractPatterns', () => {
  it('finds identifiers with their check digits', () => {
    expect(found("joignable au 04 60 48 05 02, IBAN FR76 3000 6000 0112 3456 7890 189 et NIR 1 85 05 78 006 084 91.")).toEqual([
      { kind: 'phone', text: '04 60 48 05 02' },
      { kind: 'iban', text: 'FR76 3000 6000 0112 3456 7890 189', ok: true },
      { kind: 'nir', text: '1 85 05 78 006 084 91', ok: true },
    ]);
    expect(found('NIR 1 85 05 78 006 084 92')).toEqual([{ kind: 'nir', text: '1 85 05 78 006 084 92', ok: false }]);
  });

  it('finds phone numbers written together, with dots, or with a country code', () => {
    const text = '0612345678, 06.12.34.56.78, 06-12-34-56-78, +33 6 12 34 56 78, +33 (0)6 12 34 56 78, 0033612345678, ' +
      '+32 470 12 34 56, +44 7700 900123, 0041 79 123 45 67, +1 415-555-0123.';
    expect(found(text)).toEqual([
      '0612345678', '06.12.34.56.78', '06-12-34-56-78', '+33 6 12 34 56 78', '+33 (0)6 12 34 56 78', '0033612345678',
      '+32 470 12 34 56', '+44 7700 900123', '0041 79 123 45 67', '+1 415-555-0123',
    ].map((t) => ({ kind: 'phone', text: t })));
  });

  it('finds an international number wrapped after its country code', () => {
    expect(found('et le +41\n74 647 39 38.')).toEqual([{ kind: 'phone', text: '+41\n74 647 39 38' }]);
  });

  it('checks Bitcoin addresses and flags the usual OCR confusions', () => {
    const valid = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    expect(found(`adresse ${valid}.`)).toEqual([{ kind: 'btc', text: valid, ok: true }]);
    expect(found('adresse bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5.')).toEqual([{ kind: 'btc', text: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5', ok: false }]);
    const misread = extractPatterns('adresse bclqw5O8d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4.');
    expect(misread).toMatchObject([{ kind: 'btc', checksumOk: true, suspect: true }]);
  });

  it('does not read a short number with a plus sign as a phone', () => {
    expect(kinds('score +12 34, total +3 points')).toEqual([]);
  });

  it('finds contact and network identifiers, without trailing punctuation', () => {
    expect(found('Écrire à jules.terrier+pv@exemple.test, voir https://exemple.test/a?b=1). IP 192.168.1.20 ou 2001:db8::8a2e:370:7334.')).toEqual([
      { kind: 'email', text: 'jules.terrier+pv@exemple.test' },
      { kind: 'url', text: 'https://exemple.test/a?b=1' },
      { kind: 'ipv4', text: '192.168.1.20' },
      { kind: 'ipv6', text: '2001:db8::8a2e:370:7334' },
    ]);
  });

  it('does not read times or version-like dates as addresses', () => {
    expect(kinds('à 11:19, le 24.09.2025, version 1.2.3')).toEqual(['date']);
  });

  it('finds crypto addresses but not long words', () => {
    expect(kinds('portefeuille bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh et 0x52908400098527886E0F7030069857D2E4169EE7')).toEqual(['btc', 'eth']);
    expect(kinds('mot 1abcdefghijkmnopqrstuvwxyzABCDEF')).toEqual([]);
  });

  it('finds amounts in euros, not plain numbers', () => {
    expect(found('la somme de 1 200 €, puis 1.250,50 euros et 500 EUR, soit 3 versements.')).toEqual([
      { kind: 'amount', text: '1 200 €' },
      { kind: 'amount', text: '1.250,50 euros' },
      { kind: 'amount', text: '500 EUR' },
    ]);
  });

  it('includes dates, written in digits or in words', () => {
    expect(found("Le 16 février 2025, puis l'an deux mille vingt-cinq, le vingt-quatre septembre")).toEqual([
      { kind: 'date', text: '16 février 2025' },
      { kind: 'date', text: "l'an deux mille vingt-cinq, le vingt-quatre septembre" },
    ]);
  });

  it('keeps one match where patterns overlap', () => {
    expect(kinds('immatriculée WM-834-AB stationnée')).toEqual(['plate']);
  });
});
