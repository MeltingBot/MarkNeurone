// Accuracy metrics for the OCR bench.

import { extractIdentifiers, type IdentifierKind } from '../../src/core/patterns/identifiers.ts';

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
  /** Identifiers extracted by the regex with exactly the expected value. */
  found: number;
  /** Extracted values not present in the truth. */
  falsePositives: number;
  /** Extracted values whose check digit fails (only IBAN and SIRET carry one). */
  checksumFlagged: number;
  /** Wrong values that the checksum did NOT catch. */
  checksumMissed: number;
  /** Sum of per-identifier character error rates, see bestSubstringDistance. */
  cerSum: number;
}

export type IdentifierTruth = Record<'phones' | 'plates' | 'ibans' | 'sirets', string[]>;

const TRUTH_KEY: Record<IdentifierKind, keyof IdentifierTruth> = {
  phone: 'phones',
  plate: 'plates',
  iban: 'ibans',
  siret: 'sirets',
};

export function emptyScore(): KindScore {
  return { expected: 0, found: 0, falsePositives: 0, checksumFlagged: 0, checksumMissed: 0, cerSum: 0 };
}

export function scoreIdentifiers(truth: IdentifierTruth, ocrText: string): Record<IdentifierKind, KindScore> {
  const extracted = extractIdentifiers(ocrText);
  const haystack = compact(ocrText);
  const result = {} as Record<IdentifierKind, KindScore>;
  for (const kind of Object.keys(TRUTH_KEY) as IdentifierKind[]) {
    const expected = truth[TRUTH_KEY[kind]] ?? [];
    const got = extracted.filter((m) => m.kind === kind);
    const gotValues = new Set(got.map((m) => m.value));
    const expectedSet = new Set(expected);
    const score = emptyScore();
    score.expected = expected.length;
    score.found = expected.filter((v) => gotValues.has(v)).length;
    for (const m of got) {
      const wrong = !expectedSet.has(m.value);
      if (wrong) score.falsePositives++;
      if (m.checksumOk === false) score.checksumFlagged++;
      if (wrong && m.checksumOk === true) score.checksumMissed++;
    }
    for (const v of expected) {
      const needle = compact(v);
      score.cerSum += bestSubstringDistance(needle, haystack) / needle.length;
    }
    result[kind] = score;
  }
  return result;
}
