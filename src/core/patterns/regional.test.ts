// Fictitious numbers. Valid keys were cross-checked with python-stdnum 1.20
// (be.nn, be.bis, be.vat, ch.ssn, ch.uid, lu.tva), except the Luxembourg
// matricule, which stdnum does not cover.

import { describe, expect, it } from 'vitest';
import { extractPatterns } from './patterns.ts';
import {
  avsValid,
  beEnterpriseValid,
  beNationalValid,
  ideValid,
  luNationalValid,
  luVatValid,
  verhoeffValid,
} from './checksums.ts';

const found = (text: string) =>
  extractPatterns(text).map((m) => ({ kind: m.kind, text: text.slice(m.start, m.end), ...(m.checksumOk !== undefined ? { ok: m.checksumOk } : {}) }));

describe('Belgian check digits', () => {
  it('checks national and BIS numbers, before and after 2000', () => {
    expect(beNationalValid('85.07.30-033.28')).toBe(true);
    expect(beNationalValid('90051412324')).toBe(true);
    expect(beNationalValid('90051412325')).toBe(false);
    expect(beNationalValid('01.02.03-456.03')).toBe(true);
    expect(beNationalValid('90.45.14-123.13')).toBe(true);
    expect(beNationalValid('90.13.14-123.24')).toBe(false);
  });

  it('checks enterprise numbers, the former 9-digit form included', () => {
    expect(beEnterpriseValid('BE 0403.019.261')).toBe(true);
    expect(beEnterpriseValid('BE403019261')).toBe(true);
    expect(beEnterpriseValid('0456.789.034')).toBe(true);
    expect(beEnterpriseValid('1023.456.797')).toBe(true);
    expect(beEnterpriseValid('0403.019.262')).toBe(false);
  });
});

describe('Swiss and Luxembourg check digits', () => {
  it('checks AVS numbers', () => {
    expect(avsValid('756.9217.0769.85')).toBe(true);
    expect(avsValid('756.1234.5678.97')).toBe(true);
    expect(avsValid('756.9217.0769.84')).toBe(false);
    expect(avsValid('757.9217.0769.85')).toBe(false);
  });

  it('checks IDE numbers, none valid when the key would be 10', () => {
    expect(ideValid('CHE-100.155.212')).toBe(true);
    expect(ideValid('CHE-123.456.788')).toBe(true);
    expect(ideValid('CHE-100.155.213')).toBe(false);
    for (let c = 0; c <= 9; c++) expect(ideValid(`CHE-100.000.16${c}`)).toBe(false);
  });

  it('checks Luxembourg VAT numbers', () => {
    expect(luVatValid('LU 150 274 42')).toBe(true);
    expect(luVatValid('LU12345613')).toBe(true);
    expect(luVatValid('LU15027443')).toBe(false);
  });

  it('checks Verhoeff digits and Luxembourg matricules', () => {
    expect(verhoeffValid('2363')).toBe(true);
    expect(verhoeffValid('2364')).toBe(false);
    expect(luNationalValid('1985 07 30 123 41')).toBe(true);
    expect(luNationalValid('2001020304551')).toBe(true);
    expect(luNationalValid('1985 07 30 123 42')).toBe(false);
    expect(luNationalValid('1985 07 30 123 51')).toBe(false);
    expect(luNationalValid('1985 13 30 123 41')).toBe(false);
  });
});

describe('Belgian identifiers in text', () => {
  it('keeps a grouped national number even with a wrong key, a bare one only with a valid key', () => {
    expect(found('NN 85.07.30-033.28.')).toEqual([{ kind: 'be_nn', text: '85.07.30-033.28', ok: true }]);
    expect(found('NN 85.07.30-033.29.')).toEqual([{ kind: 'be_nn', text: '85.07.30-033.29', ok: false }]);
    expect(found('n° 90051412324 et n° 90051412325')).toEqual([{ kind: 'be_nn', text: '90051412324', ok: true }]);
  });

  it('does not read a misread French NIR as a Belgian national number', () => {
    expect(found('sécurité sociale 1 71 03 10 245 77')).toEqual([]);
  });

  it('finds enterprise and VAT numbers', () => {
    expect(found('BCE 0456.789.034, TVA BE 0403.019.261, ancienne forme BE 403.019.261')).toEqual([
      { kind: 'be_bce', text: '0456.789.034', ok: true },
      { kind: 'be_bce', text: 'BE 0403.019.261', ok: true },
      { kind: 'be_bce', text: 'BE 403.019.261', ok: true },
    ]);
    expect(found('BCE 0456.789.035')).toEqual([{ kind: 'be_bce', text: '0456.789.035', ok: false }]);
  });

  it('keeps a spaced enterprise number on a valid key, a mobile number first when both apply', () => {
    expect(found('entreprise 0403 019 261')).toEqual([{ kind: 'be_bce', text: '0403 019 261', ok: true }]);
    expect(found('entreprise 0403 019 262')).toEqual([]);
    expect(found('GSM 0456 789 034')).toEqual([{ kind: 'phone', text: '0456 789 034' }]);
  });

  it('finds Belgian phone numbers', () => {
    expect(found('fixe 02 123 45 67, 081 23 45 67 ou 010/12.34.56, GSM 0475 12 34 56 ou 0475 123 456')).toEqual([
      { kind: 'phone', text: '02 123 45 67' },
      { kind: 'phone', text: '081 23 45 67' },
      { kind: 'phone', text: '010/12.34.56' },
      { kind: 'phone', text: '0475 12 34 56' },
      { kind: 'phone', text: '0475 123 456' },
    ]);
  });

  it('does not read a date as a phone number', () => {
    expect(found('le 04/12/2023 et le 02.03.2024')).toEqual([
      { kind: 'date', text: '04/12/2023' },
      { kind: 'date', text: '02.03.2024' },
    ]);
  });

  it('finds Belgian plates', () => {
    expect(found('véhicule 1-ABC-234, ancienne plaque ABC-123')).toEqual([
      { kind: 'plate', text: '1-ABC-234' },
      { kind: 'plate', text: 'ABC-123' },
    ]);
  });
});

describe('Swiss identifiers in text', () => {
  it('finds AVS and IDE numbers', () => {
    expect(found('AVS 756.1234.5678.97, IDE CHE-123.456.788 TVA, CHE-100.155.213')).toEqual([
      { kind: 'ch_avs', text: '756.1234.5678.97', ok: true },
      { kind: 'ch_ide', text: 'CHE-123.456.788', ok: true },
      { kind: 'ch_ide', text: 'CHE-100.155.213', ok: false },
    ]);
  });

  it('finds Swiss phone numbers and plates', () => {
    expect(found('tél. 021 312 34 56 ou 079 123 45 67, véhicule VD 123 456 et GE 12345')).toEqual([
      { kind: 'phone', text: '021 312 34 56' },
      { kind: 'phone', text: '079 123 45 67' },
      { kind: 'plate', text: 'VD 123 456' },
      { kind: 'plate', text: 'GE 12345' },
    ]);
  });

  it('finds amounts in Swiss francs', () => {
    expect(found("CHF 1'250.50, 1'250.– CHF, 120 fr., Fr. 80.- et 350 francs")).toEqual([
      { kind: 'amount', text: "CHF 1'250.50" },
      { kind: 'amount', text: "1'250.– CHF" },
      { kind: 'amount', text: '120 fr.' },
      { kind: 'amount', text: 'Fr. 80.-' },
      { kind: 'amount', text: '350 francs' },
    ]);
  });
});

describe('Luxembourg identifiers in text', () => {
  it('finds matricules, a bare one only with valid keys', () => {
    expect(found('matricule 1985 07 30 123 41')).toEqual([{ kind: 'lu_nin', text: '1985 07 30 123 41', ok: true }]);
    expect(found('matricule 1985 07 30 123 42')).toEqual([{ kind: 'lu_nin', text: '1985 07 30 123 42', ok: false }]);
    expect(found('n° 1985073012341 et 1985073012342')).toEqual([{ kind: 'lu_nin', text: '1985073012341', ok: true }]);
  });

  it('finds VAT and RCS numbers', () => {
    expect(found('TVA LU 150 274 42, RCS Luxembourg B 123456, R.C.S. Luxembourg n° B12345')).toEqual([
      { kind: 'lu_tva', text: 'LU 150 274 42', ok: true },
      { kind: 'lu_rcs', text: 'B 123456' },
      { kind: 'lu_rcs', text: 'B12345' },
    ]);
  });

  it('finds Luxembourg phones in international form', () => {
    expect(found('tél. +352 26 12 34 56')).toEqual([{ kind: 'phone', text: '+352 26 12 34 56' }]);
  });
});
