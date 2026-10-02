// Extraction of structured identifiers from plain text.
// Each match keeps its offsets in the source text so it can be anchored later.

import { ibanValid, normalizeIban, siretValid } from './checksums.ts';

export type IdentifierKind = 'phone' | 'plate' | 'iban' | 'siret';

export interface IdentifierMatch {
  kind: IdentifierKind;
  /** Text exactly as found in the source. */
  raw: string;
  /** Canonical form used for comparison and deduplication. */
  value: string;
  start: number;
  end: number;
  /** false when the identifier carries a check digit and the check fails. */
  checksumOk?: boolean;
}

// Up to two separator characters, line breaks included: text layers often double
// spaces or wrap an identifier over two lines.
const SEP = '[\\s.\\-]{0,2}';

// French numbers: 0X XX XX XX XX or +33 (0)X XX XX XX XX.
const PHONE_FR = new RegExp(
  `(?<![\\d+])(?:\\+33${SEP}(?:\\(0\\)${SEP})?|0033${SEP}|0)[1-9](?:${SEP}\\d{2}){4}(?!\\d)`,
  'g',
);

// SIV plates (since 2009): AA-123-AA. I, O and U are not used in letter blocks.
const PLATE_SIV = /(?<![A-Z0-9])[A-HJ-NP-TV-Z]{2}[\s-]?\d{3}[\s-]?[A-HJ-NP-TV-Z]{2}(?![A-Z0-9])/g;
// FNI plates (before 2009): 1234 AB 56, department may be 2A/2B or 3 digits overseas.
const PLATE_FNI = /(?<![A-Z0-9])\d{1,4}[\s-]?[A-HJ-NP-Z]{1,3}[\s-]?(?:\d{2,3}|2A|2B)(?![A-Z0-9])/g;

const IBAN = /(?<![A-Z0-9])[A-Z]{2}\d{2}(?:\s{0,2}[A-Z0-9]{4}){2,7}(?:\s{0,2}[A-Z0-9]{1,3})?(?![A-Z0-9])/g;

const SIRET = /(?<!\d)\d{3}\s{0,2}\d{3}\s{0,2}\d{3}\s{0,2}\d{5}(?!\d)/g;

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\(0\)/, '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+33')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('0033')) digits = '0' + digits.slice(4);
  return digits;
}

export function normalizePlate(raw: string): string {
  const compact = raw.replace(/[\s-]/g, '').toUpperCase();
  const siv = /^([A-Z]{2})(\d{3})([A-Z]{2})$/.exec(compact);
  if (siv) return `${siv[1]}-${siv[2]}-${siv[3]}`;
  return raw.replace(/[\s-]+/g, ' ').trim().toUpperCase();
}

export function normalizeSiret(raw: string): string {
  return raw.replace(/\s/g, '');
}

function collect(
  text: string,
  re: RegExp,
  kind: IdentifierKind,
  normalize: (raw: string) => string,
  check?: (value: string) => boolean,
): IdentifierMatch[] {
  const out: IdentifierMatch[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const value = normalize(m[0]);
    out.push({
      kind,
      raw: m[0],
      value,
      start: m.index,
      end: m.index + m[0].length,
      ...(check ? { checksumOk: check(value) } : {}),
    });
  }
  return out;
}

/** Drops matches fully contained in an earlier, longer match (e.g. FNI plate inside an IBAN). */
function dropOverlaps(matches: IdentifierMatch[]): IdentifierMatch[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out: IdentifierMatch[] = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}

export function extractIdentifiers(text: string): IdentifierMatch[] {
  return dropOverlaps([
    ...collect(text, IBAN, 'iban', normalizeIban, ibanValid),
    ...collect(text, SIRET, 'siret', normalizeSiret, siretValid),
    ...collect(text, PHONE_FR, 'phone', normalizePhone),
    ...collect(text, PLATE_SIV, 'plate', normalizePlate),
    ...collect(text, PLATE_FNI, 'plate', normalizePlate),
  ]);
}
