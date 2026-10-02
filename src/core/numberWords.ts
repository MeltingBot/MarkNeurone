// French numbers written in words, 1 to 99, as found in hearing reports
// ("le vingt-quatre septembre", "à onze heures dix-neuf").

const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS: Record<number, string> = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };

/** Canonical spellings of n (1-99); several when usage varies. */
function spellings(n: number): string[] {
  if (n <= 16) return [UNITS[n]];
  if (n < 20) return [`dix-${UNITS[n - 10]}`];
  if (n < 70) {
    const tens = TENS[Math.floor(n / 10) * 10];
    const unit = n % 10;
    if (unit === 0) return [tens];
    if (unit === 1) return [`${tens} et un`, `${tens}-et-un`, `${tens}-un`];
    return [`${tens}-${UNITS[unit]}`];
  }
  if (n < 80) {
    const rest = n - 60;
    if (rest === 11) return ['soixante et onze', 'soixante-et-onze', 'soixante-onze'];
    return rest <= 16 ? [`soixante-${UNITS[rest]}`] : [`soixante-dix-${UNITS[rest - 10]}`];
  }
  if (n === 80) return ['quatre-vingts', 'quatre-vingt'];
  const rest = n - 80;
  return rest <= 16 ? [`quatre-vingt-${UNITS[rest]}`] : [`quatre-vingt-dix-${UNITS[rest - 10]}`];
}

/** Hyphens and spaces are interchangeable in practice. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s-]+/g, ' ').trim();
}

const VALUES = new Map<string, number>();
for (let n = 1; n <= 99; n++) for (const s of spellings(n)) VALUES.set(normalize(s), n);

/** Regex source matching any number word from 1 to 99, longest first. */
export const NUMBER_WORDS = [...VALUES.keys()]
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/ /g, '[\\s-]+'))
  .join('|');

/** Value of a number written in digits or in words; null if neither. */
export function numberValue(text: string): number | null {
  const t = text.trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (/^(?:1er|premier)$/i.test(t)) return 1;
  return VALUES.get(normalize(t)) ?? null;
}

/** "deux mille vingt-cinq" → 2025, "mil neuf cent quatre-vingt-dix" → 1990, "2024" → 2024. */
export function yearValue(text: string): number | null {
  const t = normalize(text);
  if (/^\d{4}$/.test(t)) return Number(t);
  let m = /^deux mille(?: (.+))?$/.exec(t);
  if (m) return m[1] ? (VALUES.has(m[1]) ? 2000 + VALUES.get(m[1])! : null) : 2000;
  m = /^(?:mil|mille) neuf cents?(?: (.+))?$/.exec(t);
  if (m) return m[1] ? (VALUES.has(m[1]) ? 1900 + VALUES.get(m[1])! : null) : 1900;
  return null;
}

/** Regex source for a year in digits or words. */
export const YEAR_WORDS = String.raw`\d{4}|deux[\s-]+mille(?:[\s-]+(?:${NUMBER_WORDS}))?|mil(?:le)?[\s-]+neuf[\s-]+cents?(?:[\s-]+(?:${NUMBER_WORDS}))?`;
