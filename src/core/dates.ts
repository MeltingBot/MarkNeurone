// French date extraction for the event gesture: digits, month names, and
// the words of hearing reports ("L'an deux mille vingt-cinq, le vingt-quatre
// septembre, à onze heures dix-neuf").

import { NUMBER_WORDS, YEAR_WORDS, numberValue, yearValue } from './numberWords.ts';

export interface DateMatch {
  date: Date;
  raw: string;
  start: number;
  end: number;
  /** false when the year was missing and taken from `referenceYear`. */
  hasYear: boolean;
  hasTime: boolean;
}

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
  janv: 1, fevr: 2, févr: 2, avr: 4, juil: 7, sept: 9, oct: 10, nov: 11, dec: 12, déc: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const NUM = String.raw`\d{1,2}|${NUMBER_WORDS}`;
const DAY = String.raw`1er|premier|\d{1,2}|${NUMBER_WORDS}`;

// "à 11 heures 19", "à 11h19", "11:19", "à onze heures dix-neuf"
const TIME = String.raw`(?:,?\s*(?:à\s+)?(${NUM})\s*(?:heures?|h|:)\s*(${String.raw`\d{2}|${NUMBER_WORDS}`})?)?`;

// A space may come around a slash: text layers of native PDFs often hold
// one between glyphs. Not around dots and dashes ("1 - 2 - 24").
const SEP = String.raw`(?:\s?/\s?|[.\-])`;
const NUMERIC = new RegExp(String.raw`(?<!\d)(\d{1,2})${SEP}(\d{1,2})${SEP}(\d{4}|\d{2})(?!\d)` + TIME, 'giu');
const ISO = new RegExp(String.raw`(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)` + TIME, 'giu');
const LITERAL = new RegExp(
  String.raw`(?<![\p{L}\d])(${DAY})\s+(${MONTH_NAMES})\.?(?:\s+(${YEAR_WORDS}))?(?![\p{L}])` + TIME,
  'giu',
);
// Report header: the year comes first.
const REPORT_HEADER = new RegExp(
  String.raw`l['’]an\s+(${YEAR_WORDS}),?\s+le\s+(${DAY})\s+(${MONTH_NAMES})(?![\p{L}])` + TIME,
  'giu',
);

const SLASHES = /[\u2044\u2215\u29F8\uFF0F]/g;
const DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
const WIDE_DIGITS = /[\uFF10-\uFF19]/g;

/**
 * Text of a PDF as the patterns expect it, one character for one so that
 * offsets stay valid: Unicode slashes and dashes, full-width digits, and
 * invisible characters (soft hyphen, zero-width space) as a space.
 */
function normalize(text: string): string {
  return text
    .replace(SLASHES, '/')
    .replace(DASHES, '-')
    .replace(INVISIBLE, ' ')
    .replace(WIDE_DIGITS, (d) => String(d.charCodeAt(0) - 0xff10));
}

function build(year: number | null, month: number, day: number | null, hour?: string, minute?: string): Date | null {
  if (year === null || day === null || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const h = hour !== undefined ? numberValue(hour) : 0;
  const m = minute !== undefined ? numberValue(minute) : 0;
  if (h === null || m === null || h > 23 || m > 59) return null;
  const date = new Date(year, month - 1, day, h, m);
  // Rejects 31/02 and the like, which Date silently rolls over.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function expandYear(y: string): number {
  if (y.length === 4) return Number(y);
  const n = Number(y);
  return n < 50 ? 2000 + n : 1900 + n;
}

/**
 * Every date found in the text, in order. A date without year takes
 * `referenceYear` and is flagged so the form can ask for confirmation.
 */
export function findDates(source: string, referenceYear = new Date().getFullYear()): DateMatch[] {
  const text = normalize(source);
  const out: DateMatch[] = [];
  const push = (m: RegExpExecArray, date: Date | null, hasYear: boolean, hour?: string) => {
    if (!date) return;
    out.push({ date, raw: source.slice(m.index, m.index + m[0].trimEnd().length).trim(), start: m.index, end: m.index + m[0].trimEnd().length, hasYear, hasTime: hour !== undefined });
  };
  for (const m of text.matchAll(NUMERIC)) {
    push(m, build(expandYear(m[3]), Number(m[2]), Number(m[1]), m[4], m[5]), true, m[4]);
  }
  for (const m of text.matchAll(ISO)) {
    push(m, build(Number(m[1]), Number(m[2]), Number(m[3]), m[4], m[5]), true, m[4]);
  }
  for (const m of text.matchAll(REPORT_HEADER)) {
    push(m, build(yearValue(m[1]), MONTHS[m[3].toLowerCase()], numberValue(m[2]), m[4], m[5]), true, m[4]);
  }
  for (const m of text.matchAll(LITERAL)) {
    // Already read as part of a report header.
    if (out.some((d) => m.index >= d.start && m.index < d.end)) continue;
    const month = MONTHS[m[2].toLowerCase()];
    const hasYear = m[3] !== undefined;
    push(m, build(hasYear ? yearValue(m[3]) : referenceYear, month, numberValue(m[1]), m[4], m[5]), hasYear, m[4]);
  }
  return out.sort((a, b) => a.start - b.start);
}

/** yyyy-mm-dd for <input type="date">, in local time. */
export function toDateInputValue(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}


/**
 * Period of an event: the first two dates of the passage, when the second
 * comes after the first.
 */
export function findDateRange(dates: DateMatch[]): { start: DateMatch; end: DateMatch } | null {
  const [start, end] = dates;
  return start && end && end.date.getTime() > start.date.getTime() ? { start, end } : null;
}
