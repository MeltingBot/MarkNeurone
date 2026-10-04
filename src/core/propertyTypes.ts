// ZN's property types (types/index.ts PropertyType) and what a passage can
// be read as for each. Countries are stored as ISO 3166-1 alpha-2 codes, as
// ZN's CountryPicker does; their names come from Intl, not from a list.

import { normalizeName } from './dictionary.ts';

export const PROPERTY_TYPES = ['text', 'number', 'date', 'datetime', 'boolean', 'choice', 'country', 'link'] as const;
export type PropertyTypeName = (typeof PROPERTY_TYPES)[number];

/**
 * Region codes that are not current countries in Intl's region names:
 * groupings, pseudo-regions, codes of former countries (DD, SU, YU...) and
 * exceptionally reserved codes (AC, IC, TA...).
 */
const NOT_COUNTRIES = new Set([
  'EU', 'EZ', 'UN', 'QO', 'ZZ', 'XA', 'XB',
  'AN', 'BU', 'CS', 'DD', 'FX', 'NT', 'QU', 'SU', 'TP', 'YD', 'YU', 'ZR',
  'AC', 'CP', 'CQ', 'DG', 'EA', 'IC', 'TA',
]);

let cache: { code: string; fr: string; en: string }[] | null = null;

/** ISO 3166-1 alpha-2 codes known to Intl, with French and English names, sorted by French name. */
export function countries(): { code: string; fr: string; en: string }[] {
  if (cache) return cache;
  const fr = new Intl.DisplayNames(['fr'], { type: 'region', fallback: 'none' });
  const en = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
  const out: { code: string; fr: string; en: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (NOT_COUNTRIES.has(code)) continue;
      const nameFr = fr.of(code);
      const nameEn = en.of(code);
      if (nameFr && nameEn && nameFr !== code) out.push({ code, fr: nameFr, en: nameEn });
    }
  }
  cache = out.sort((x, y) => x.fr.localeCompare(y.fr, 'fr'));
  return cache;
}

export function countryName(code: string): string {
  return countries().find((c) => c.code === code.toUpperCase())?.fr ?? code;
}

/** Code of the country a passage names ("France", "france", "FR"), or null. */
export function matchCountry(text: string): string | null {
  const n = normalizeName(text);
  if (!n) return null;
  const hit = countries().find((c) => normalizeName(c.fr) === n || normalizeName(c.en) === n || c.code.toLowerCase() === n);
  return hit?.code ?? null;
}

/** The option a passage names, case and accents aside, or null. */
export function matchChoice(text: string, choices: string[]): string | null {
  const n = normalizeName(text);
  return (n && choices.find((c) => normalizeName(c) === n)) || null;
}

/** "a, b ,, c" to ["a", "b", "c"], without duplicates. */
export function parseChoices(raw: string): string[] {
  return [...new Set(raw.split(',').map((c) => c.trim()).filter(Boolean))];
}
