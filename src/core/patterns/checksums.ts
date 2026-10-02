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
