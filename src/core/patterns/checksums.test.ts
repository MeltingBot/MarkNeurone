import { describe, expect, it } from 'vitest';
import { ibanValid, luhnValid, nirValid, sirenValid, siretValid } from './checksums.ts';

describe('luhn', () => {
  it('accepts a valid sequence and rejects a single-digit change', () => {
    expect(luhnValid('79927398713')).toBe(true);
    expect(luhnValid('79927398710')).toBe(false);
  });
  it('rejects non digits', () => {
    expect(luhnValid('7992O398713')).toBe(false);
  });
});

describe('SIREN / SIRET', () => {
  it('validates a SIREN', () => {
    expect(sirenValid('732 829 320')).toBe(true);
    expect(sirenValid('732 829 321')).toBe(false);
  });
  it('validates a SIRET', () => {
    expect(siretValid('732 829 320 00074')).toBe(true);
    expect(siretValid('732 829 320 00075')).toBe(false);
  });
  it('applies the La Poste digit-sum rule', () => {
    expect(siretValid('35600000000001')).toBe(true);
    expect(siretValid('35600000000002')).toBe(false);
  });
});

describe('IBAN', () => {
  it('validates a French IBAN with spaces', () => {
    expect(ibanValid('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
  });
  it('rejects a misread character', () => {
    expect(ibanValid('FR76 3000 6000 0112 3456 7890 188')).toBe(false);
    expect(ibanValid('FR76 3000 6000 0112 3456 789O 189')).toBe(false);
  });
  it('rejects a wrong length for the country', () => {
    expect(ibanValid('FR76 3000 6000 0112 3456 7890 18')).toBe(false);
  });
  it('validates a German IBAN', () => {
    expect(ibanValid('DE89 3704 0044 0532 0130 00')).toBe(true);
  });
});

describe('NIR', () => {
  it('validates a NIR and its key', () => {
    expect(nirValid('1 85 05 78 006 084 91')).toBe(true);
    expect(nirValid('1 85 05 78 006 084 92')).toBe(false);
  });
  it('handles Corsica departments', () => {
    // 2A is mapped to 19 for the key: body 2850 52A 006 084 -> 2850519006084
    const key = 97 - Number(2850519006084n % 97n);
    expect(nirValid(`2 85 05 2A 006 084 ${String(key).padStart(2, '0')}`)).toBe(true);
  });
});
