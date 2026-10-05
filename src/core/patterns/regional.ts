// Identifiers of Belgium, Switzerland and Luxembourg, alongside the French
// ones: a French dossier often holds Belgian, Swiss or Luxembourg documents.
//
// A number written in its usual grouping (85.07.30-033.28) is kept even when
// its key fails, which then signals a probable misreading. Written otherwise it
// could be anything, so it is kept only when its key holds.

import {
  avsValid,
  beEnterpriseValid,
  beNationalPlausible,
  beNationalValid,
  ideValid,
  luNationalPlausible,
  luNationalValid,
  luVatValid,
} from './checksums.ts';

export type RegionalKind = 'be_nn' | 'be_bce' | 'ch_avs' | 'ch_ide' | 'lu_nin' | 'lu_tva' | 'lu_rcs';

/** Countries whose identifiers are looked for besides the French ones, on the user's choice. */
export type Country = 'be' | 'ch' | 'lu';
export const COUNTRIES: Country[] = ['be', 'ch', 'lu'];

export const KIND_COUNTRY: Record<RegionalKind, Country> = {
  be_nn: 'be', be_bce: 'be', ch_avs: 'ch', ch_ide: 'ch', lu_nin: 'lu', lu_tva: 'lu', lu_rcs: 'lu',
};

export interface RegionalMatch {
  kind: RegionalKind | 'phone' | 'plate' | 'amount';
  start: number;
  end: number;
  checksumOk?: boolean;
}

const SEP = '[\\s./\\-]{0,2}';

// Belgian national number: 85.07.30-033.28, 85073003328.
const BE_NN = /(?<![\d.])\d{2}[.\s]?\d{2}[.\s]?\d{2}[-\s.]?\d{3}[.\s-]?\d{2}(?![\d])/g;
// Enterprise number, BE prefix (also the VAT number), the former 9-digit form included.
const BE_BCE_PREFIXED = /(?<![A-Za-z0-9])BE[\s.:-]{0,2}(?:[01]\d{3}|\d{3})[.\s]?\d{3}[.\s]?\d{3}(?!\d)/g;
const BE_BCE_DOTTED = /(?<![\w.])[01]\d{3}\.\d{3}\.\d{3}(?![\d.])/g;
// 0403 019 261 could be any number: kept on a valid key only. In the range of
// mobile numbers (0456 789 034), the phone, listed before, wins the tie.
const BE_BCE_SPACED = /(?<![\w.])[01]\d{3} \d{3} \d{3}(?!\d)/g;

// Belgian phones: 02 123 45 67 (one-digit zones), 081 23 45 67, 010/12.34.56,
// mobiles 0475 12 34 56 or 0475 123 456. Swiss: 021 312 34 56.
const BE_PHONE_ZONE1 = new RegExp(`(?<![\\d+./])0[2349]${SEP}\\d{3}${SEP}\\d{2}${SEP}\\d{2}(?![\\d/])`, 'g');
const BE_PHONE_ZONE2 = new RegExp(`(?<![\\d+./])0[1-9]\\d${SEP}\\d{2}${SEP}\\d{2}${SEP}\\d{2}(?![\\d/])`, 'g');
const BE_MOBILE = new RegExp(`(?<![\\d+./])04[5-9]\\d${SEP}\\d{3}${SEP}\\d{3}(?![\\d/])`, 'g');
const CH_PHONE = new RegExp(`(?<![\\d+./])0[1-9]\\d${SEP}\\d{3}${SEP}\\d{2}${SEP}\\d{2}(?![\\d/])`, 'g');

// Belgian plates: 1-ABC-234 since 2010, ABC-123 and 123-ABC before (hyphen required).
const BE_PLATE = /(?<![A-Z0-9-])[1-9][\s-]?[A-Z]{3}[\s-]?\d{3}(?![A-Z0-9])/g;
const BE_PLATE_OLD = /(?<![A-Z0-9-])(?:[A-Z]{3}-\d{3}|\d{3}-[A-Z]{3})(?![A-Z0-9-])/g;
// Swiss plates: canton code, a space and up to 6 digits (VD 123 456, GE 12345).
// The space is required: FR42 or BE68 begin an IBAN. No further group of
// digits: LU 150 274 42 is a Luxembourg VAT number, not a Lucerne plate.
const CANTONS = 'AG|AI|AR|BE|BL|BS|FR|GE|GL|GR|JU|LU|NE|NW|OW|SG|SH|SO|SZ|TG|TI|UR|VD|VS|ZG|ZH';
const CH_PLATE = new RegExp(`(?<![A-Za-z0-9])(?:${CANTONS})[  ]\\d{1,3}(?:[\\s']?\\d{3})?(?![\\d.,'’A-Za-z]|[\\s']\\d)`, 'g');

// Swiss AVS number 756.1234.5678.97, IDE CHE-123.456.788.
const CH_AVS = /(?<![\d.])756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}(?!\d)/g;
const CH_IDE = /(?<![A-Za-z0-9])CHE[-\s.]?\d{3}[.\s]?\d{3}[.\s]?\d{3}(?!\d)/g;
// Swiss francs: CHF 1'250.50, 1'250.– CHF, 120 fr., Fr. 80.-
const CH_NUMBER = String.raw`(?:\d{1,3}(?:['’  ]\d{3})+|\d+)(?:[.,]\d{2}|[.,][-–—]{1,2})?`;
const CHF_AFTER = new RegExp(String.raw`(?<![\d'’.,])${CH_NUMBER}[  ]?(?:CHF|francs?(?![\p{L}])|[Ff]r\.)`, 'gu');
const CHF_BEFORE = new RegExp(String.raw`(?<![\p{L}])(?:CHF|Fr\.)[  ]?${CH_NUMBER}(?![\d'’])`, 'gu');

// Luxembourg: matricule 1985 0730 123 41, VAT LU 150 274 42, RCS Luxembourg B 123456.
const LU_NIN = /(?<![\d.])(?:19|20)\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{3}[\s.]?\d{2}(?!\d)/g;
const LU_TVA = /(?<![A-Za-z0-9])LU[\s:-]{0,2}(?:\d[\s.]?){7}\d(?!\d)/g;
const LU_RCS = /(?<=R\.?\s?C\.?\s?S\.?\s+[Ll]uxembourg[\s,:]*(?:n[°º]\s*)?)[A-Z]\s?\d{1,6}(?!\d)/g;

// Belgian national numbers are written with dots and a dash; grouped by spaces
// only they look like a French NIR misread by the OCR (1 71 03 10 245 77...).
const BE_NN_GROUPING = /[.\-]/;
const LU_NIN_GROUPING = /[\s.]/;

function collect(
  text: string,
  re: RegExp,
  kind: RegionalMatch['kind'],
  accept?: (raw: string) => boolean | { checksumOk: boolean },
): RegionalMatch[] {
  const out: RegionalMatch[] = [];
  for (const m of text.matchAll(re)) {
    const verdict = accept ? accept(m[0]) : true;
    if (verdict === false) continue;
    out.push({ kind, start: m.index, end: m.index + m[0].length, ...(typeof verdict === 'object' ? verdict : {}) });
  }
  return out;
}

/** In its usual grouping: kept with its key checked. Otherwise: kept on a valid key only. */
function keyed(plausible: (raw: string) => boolean, valid: (raw: string) => boolean, grouping: RegExp) {
  return (raw: string) => {
    if (!plausible(raw)) return false;
    const ok = valid(raw);
    if (!ok && !grouping.test(raw)) return false;
    return { checksumOk: ok };
  };
}

export function extractRegional(text: string, countries: readonly Country[]): RegionalMatch[] {
  const out: RegionalMatch[] = [];
  if (countries.includes('be')) {
    out.push(
      ...collect(text, BE_NN, 'be_nn', keyed(beNationalPlausible, beNationalValid, BE_NN_GROUPING)),
      ...collect(text, BE_BCE_PREFIXED, 'be_bce', (raw) => ({ checksumOk: beEnterpriseValid(raw) })),
      ...collect(text, BE_BCE_DOTTED, 'be_bce', (raw) => ({ checksumOk: beEnterpriseValid(raw) })),
      ...collect(text, BE_PHONE_ZONE1, 'phone'),
      ...collect(text, BE_PHONE_ZONE2, 'phone'),
      ...collect(text, BE_MOBILE, 'phone'),
      ...collect(text, BE_BCE_SPACED, 'be_bce', (raw) => (beEnterpriseValid(raw) ? { checksumOk: true } : false)),
      ...collect(text, BE_PLATE, 'plate'),
      ...collect(text, BE_PLATE_OLD, 'plate'),
    );
  }
  if (countries.includes('ch')) {
    out.push(
      ...collect(text, CH_PHONE, 'phone'),
      ...collect(text, CH_PLATE, 'plate'),
      ...collect(text, CH_AVS, 'ch_avs', (raw) => ({ checksumOk: avsValid(raw) })),
      ...collect(text, CH_IDE, 'ch_ide', (raw) => ({ checksumOk: ideValid(raw) })),
      ...collect(text, CHF_AFTER, 'amount'),
      ...collect(text, CHF_BEFORE, 'amount'),
    );
  }
  if (countries.includes('lu')) {
    out.push(
      ...collect(text, LU_NIN, 'lu_nin', keyed(luNationalPlausible, luNationalValid, LU_NIN_GROUPING)),
      ...collect(text, LU_TVA, 'lu_tva', (raw) => ({ checksumOk: luVatValid(raw) })),
      ...collect(text, LU_RCS, 'lu_rcs'),
    );
  }
  return out;
}
