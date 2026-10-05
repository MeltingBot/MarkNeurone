// Check-digit validators for identifiers that carry one.
// A failed check after OCR usually means a misread character.

/** Luhn check over a string of digits (SIREN, SIRET, card numbers). */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function sirenValid(value: string): boolean {
  const digits = value.replace(/\s/g, '');
  return digits.length === 9 && luhnValid(digits);
}

// La Poste SIRET (356 000 000 xxxxx) uses a digit-sum rule instead of Luhn.
const LA_POSTE_SIREN = '356000000';

export function siretValid(value: string): boolean {
  const digits = value.replace(/\s/g, '');
  if (digits.length !== 14 || !/^\d+$/.test(digits)) return false;
  if (digits.startsWith(LA_POSTE_SIREN)) {
    let sum = 0;
    for (const c of digits) sum += c.charCodeAt(0) - 48;
    return sum % 5 === 0;
  }
  return luhnValid(digits);
}

/** Expected IBAN length per country (subset covering Europe and frequent cases). */
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20,
  ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26,
  IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28,
  PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27, MA: 28, TN: 24, TR: 26, AE: 23,
};

export function normalizeIban(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/** ISO 13616 mod-97 check. */
export function ibanValid(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const c of rearranged) {
    const code = c.charCodeAt(0);
    const chunk = code >= 65 ? String(code - 55) : c;
    for (const d of chunk) remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

/**
 * French NIR (social security number), 13 digits + 2-digit key.
 * Corsica departments 2A/2B are mapped to 19/18 for the key computation.
 */
export function nirValid(value: string): boolean {
  const nir = value.replace(/\s/g, '').toUpperCase();
  if (!/^[12378]\d{4}(\d{2}|2A|2B)\d{6}\d{2}$/.test(nir)) return false;
  let body = nir.slice(0, 13);
  if (body.slice(5, 7) === '2A') body = body.slice(0, 5) + '19' + body.slice(7);
  else if (body.slice(5, 7) === '2B') body = body.slice(0, 5) + '18' + body.slice(7);
  const key = Number(nir.slice(13));
  const expected = 97 - Number(BigInt(body) % 97n);
  return key === expected;
}

// ─── Bech32 (Bitcoin segwit addresses, BIP 173 and BIP 350) ──

export const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32M_CONST = 0x2bc830a3;

function polymod(values: number[]): number {
  const gen = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= gen[i];
  }
  return chk >>> 0;
}

const hrpExpand = (hrp: string) => [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];

/** Valid bech32 or bech32m string (checksum over the human-readable part and the data). */
export function bech32Valid(address: string): boolean {
  const a = address.toLowerCase();
  const sep = a.lastIndexOf('1');
  if (sep < 1 || sep + 7 > a.length) return false;
  const data = [...a.slice(sep + 1)].map((c) => BECH32_CHARSET.indexOf(c));
  if (data.some((d) => d < 0)) return false;
  const check = polymod([...hrpExpand(a.slice(0, sep)), ...data]);
  return check === 1 || check === BECH32M_CONST;
}

/** The six checksum characters for a human-readable part and 5-bit data (bech32, version 0). */
export function bech32Checksum(hrp: string, data: number[]): string {
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  return [0, 1, 2, 3, 4, 5].map((p) => BECH32_CHARSET[(mod >>> (5 * (5 - p))) & 31]).join('');
}

// ─── Belgium, Switzerland, Luxembourg ─────────────────────────

const digitsOf = (value: string) => value.replace(/[\s.\-/]/g, '');

/** Month of a Belgian national or BIS number: 0 when unknown, +20 or +40 for BIS numbers. */
const beMonthPlausible = (m: number) => m <= 12 || (m >= 20 && m <= 32) || (m >= 40 && m <= 52);

/** Birth date part of a Belgian national number is plausible (day 0 when unknown). */
export function beNationalPlausible(value: string): boolean {
  const d = digitsOf(value);
  return /^\d{11}$/.test(d) && beMonthPlausible(Number(d.slice(2, 4))) && Number(d.slice(4, 6)) <= 31;
}

/**
 * Belgian national number (registre national) or BIS number, 9 digits + key:
 * key = 97 - (first 9 digits mod 97), the digits preceded by 2 for people born from 2000.
 */
export function beNationalValid(value: string): boolean {
  const d = digitsOf(value);
  if (!beNationalPlausible(d)) return false;
  const key = Number(d.slice(9));
  return [d.slice(0, 9), `2${d.slice(0, 9)}`].some((body) => 97 - Number(BigInt(body) % 97n) === key);
}

/** Belgian enterprise number (BCE/KBO, also the VAT number after BE): 8 digits + key mod 97. */
export function beEnterpriseValid(value: string): boolean {
  let d = digitsOf(value).toUpperCase().replace(/^BE/, '');
  if (d.length === 9) d = `0${d}`; // former 9-digit form
  if (!/^[01]\d{9}$/.test(d)) return false;
  return (Number(d.slice(0, 8)) + Number(d.slice(8))) % 97 === 0;
}

/** Swiss AVS/AHV number: 756 then 9 digits and an EAN-13 check digit. */
export function avsValid(value: string): boolean {
  const d = digitsOf(value);
  if (!/^756\d{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (d.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === d.charCodeAt(12) - 48;
}

/** Swiss enterprise identification number (IDE/UID): CHE, 8 digits and a weighted mod-11 check digit. */
export function ideValid(value: string): boolean {
  const d = digitsOf(value).toUpperCase().replace(/^CHE/, '');
  if (!/^\d{9}$/.test(d)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  const sum = weights.reduce((s, w, i) => s + w * (d.charCodeAt(i) - 48), 0);
  // A remainder giving 10 is never issued.
  return (11 - (sum % 11)) % 11 === d.charCodeAt(8) - 48;
}

/** Luxembourg VAT number: LU, 6 digits and their remainder mod 89. */
export function luVatValid(value: string): boolean {
  const d = digitsOf(value).toUpperCase().replace(/^LU/, '');
  return /^\d{8}$/.test(d) && Number(d.slice(0, 6)) % 89 === Number(d.slice(6));
}

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Verhoeff check over a string of digits, check digit last. */
export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits.charCodeAt(digits.length - 1 - i) - 48]];
  }
  return c === 0;
}

/** Birth date part (YYYYMMDD) of a Luxembourg national identification number is plausible. */
export function luNationalPlausible(value: string): boolean {
  const d = digitsOf(value);
  if (!/^(?:19|20)\d{11}$/.test(d)) return false;
  const month = Number(d.slice(4, 6));
  const day = Number(d.slice(6, 8));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Luxembourg national identification number (matricule), 13 digits: birth date
 * YYYYMMDD, 3 digits, then a Luhn and a Verhoeff check digit, both computed
 * over the first 11 digits.
 */
export function luNationalValid(value: string): boolean {
  const d = digitsOf(value);
  if (!luNationalPlausible(d)) return false;
  return luhnValid(d.slice(0, 12)) && verhoeffValid(d.slice(0, 11) + d[12]);
}
