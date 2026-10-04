// Accuracy metrics for the OCR bench.

import { buildSuggestions } from '../../src/core/suggestions.ts';
import type { NamedElement } from '../../src/core/dictionary.ts';
import { TRUTH_KINDS, type TruthItem, type TruthKind } from './gen/fiction.ts';

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Uint32Array(b.length + 1);
  let curr = new Uint32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Smallest edit distance between `needle` and any substring of `haystack`
 * (Sellers algorithm). Measures how badly an identifier was read even when
 * the regex no longer recognises it.
 */
export function bestSubstringDistance(needle: string, haystack: string): number {
  if (!needle.length) return 0;
  let prev = new Uint32Array(needle.length + 1);
  let curr = new Uint32Array(needle.length + 1);
  for (let i = 0; i <= needle.length; i++) prev[i] = i;
  let best = needle.length;
  for (let j = 1; j <= haystack.length; j++) {
    curr[0] = 0; // a match may start anywhere in the haystack
    const ch = haystack.charCodeAt(j - 1);
    for (let i = 1; i <= needle.length; i++) {
      const cost = needle.charCodeAt(i - 1) === ch ? 0 : 1;
      curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
    }
    if (curr[needle.length] < best) best = curr[needle.length];
    [prev, curr] = [curr, prev];
  }
  return best;
}

const normalizeSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();
const compact = (s: string) => s.replace(/[\s.\-]/g, '').toUpperCase();

/** Character error rate on the whole page, whitespace-insensitive. */
export function pageCer(truth: string, ocr: string): number {
  const t = normalizeSpaces(truth);
  return t.length ? levenshtein(t, normalizeSpaces(ocr)) / t.length : 0;
}

export interface KindScore {
  expected: number;
  /** Expected texts suggested with exactly the expected value. */
  found: number;
  /** Suggested values not present in the truth. */
  falsePositives: number;
  /** Suggested values flagged as probably misread: failing check digit (IBAN, SIRET, NIR, Bitcoin) or OCR confusion. */
  checksumFlagged: number;
  /** Wrong values that nothing flagged although the kind carries a check digit. */
  checksumMissed: number;
  /** Sum of per-item character error rates, see bestSubstringDistance. */
  cerSum: number;
}

export function emptyScore(): KindScore {
  return { expected: 0, found: 0, falsePositives: 0, checksumFlagged: 0, checksumMissed: 0, cerSum: 0 };
}

/** Comparison key: accents, case, spaces and punctuation do not count. */
const key = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}@€]/gu, '').toUpperCase();

/**
 * Scores the plugin's suggestions on a page text against the expected ones,
 * kind by kind. The dictionary holds the names the dossier would know.
 */
export function scoreSuggestions(items: TruthItem[], text: string, dictionary: NamedElement[]): Record<TruthKind, KindScore> {
  const suggested = buildSuggestions([text], dictionary, []);
  const haystack = compact(text);
  const result = {} as Record<TruthKind, KindScore>;
  for (const kind of TRUTH_KINDS) {
    const expected = items.filter((i) => i.kind === kind).map((i) => key(i.value));
    const got = suggested.filter((s) => s.kind === kind);
    const score = emptyScore();
    score.expected = expected.length;
    const remaining = [...expected];
    for (const s of got) {
      const raw = text.slice(s.start, s.end);
      // A Bitcoin address read with an OCR confusion is suggested as the corrected value.
      const read = s.suspect && kind === 'btc' ? `bc1${raw.slice(3).replace(/O/g, '0')}` : raw;
      const at = remaining.indexOf(key(read));
      if (at >= 0) {
        remaining.splice(at, 1);
        score.found++;
      } else {
        score.falsePositives++;
        if (s.checksumOk === true && !s.suspect) score.checksumMissed++;
      }
      if (s.checksumOk === false || s.suspect) score.checksumFlagged++;
    }
    for (const i of items.filter((x) => x.kind === kind)) {
      const needle = compact(i.value);
      score.cerSum += bestSubstringDistance(needle, haystack) / needle.length;
    }
    result[kind] = score;
  }
  return result;
}

/** Dictionary of a report: every name it mentions, as the graph would hold it. */
export function dictionaryOf(items: TruthItem[]): NamedElement[] {
  const names = [...new Set(items.filter((i) => i.kind === 'name').map((i) => i.canonical ?? i.value))];
  return names.map((label, i) => ({ id: `n${i}`, label, aliases: [] }));
}
