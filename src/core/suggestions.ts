// ─── Pre-highlighting suggestions ────────────────────────────
//
// Computed from the page texts each time, never stored: only the user's
// answer is (a validated annotation keeps origin 'pattern' or 'dictionary',
// a rejection is kept as a 'suggestion' annotation with status 'rejected').
//
// Two sources: generic patterns, and the names of the dossier's elements
// (labels and aliases), tolerant to case, accents, reversed order and an
// initial for the first name. No fuzzy matching beyond that.

import type { Annotation } from './model.ts';
import type { MatchKind, NamedElement } from './dictionary.ts';
import { extractPatterns, type PatternKind } from './patterns/patterns.ts';

export type SuggestionKind = PatternKind | 'name';

/** Pattern kinds in the order of the settings, those of one country together. */
export const SUGGESTION_KINDS: SuggestionKind[] = [
  'phone', 'plate', 'iban', 'siret', 'nir',
  'be_bce', 'be_nn', 'ch_ide', 'ch_avs', 'lu_rcs', 'lu_tva', 'lu_nin',
  'email', 'url', 'ipv4', 'ipv6', 'btc', 'eth', 'amount', 'date',
];

export interface Suggestion {
  /** Stable for a given text: page:start:end:kind. */
  key: string;
  page: number;
  start: number;
  end: number;
  source: 'pattern' | 'dictionary';
  kind: SuggestionKind;
  checksumOk?: boolean;
  suspect?: boolean;
  /** Dictionary: elements whose name matches (several when homonyms). */
  elementIds?: string[];
  match?: MatchKind;
}

export interface NameMatch {
  start: number;
  end: number;
  elementIds: string[];
  match: MatchKind;
}

interface Word {
  norm: string;
  start: number;
  end: number;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function words(text: string): Word[] {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ norm: fold(m[0]), start: m.index, end: m.index + m[0].length }));
}

/** Between two words of one name: spaces, a line break, a hyphen, a comma or a dot. */
const GAP = /^[\s.,'’-]{1,3}$/;

interface Variant {
  tokens: string[];
  elementId: string;
  match: MatchKind;
}

const RANK: Record<MatchKind, number> = { exact: 0, reordered: 1, initials: 2 };

function variants(elements: NamedElement[]): Map<string, Variant[]> {
  const byFirst = new Map<string, Variant[]>();
  const add = (tokens: string[], elementId: string, match: MatchKind) => {
    const list = byFirst.get(tokens[0]) ?? [];
    list.push({ tokens, elementId, match });
    byFirst.set(tokens[0], list);
  };
  for (const el of elements) {
    for (const name of [el.label, ...el.aliases]) {
      const tokens = words(name).map((w) => w.norm);
      // Too short to be told apart from ordinary words.
      if (!tokens.length || tokens.join('').length < 3) continue;
      add(tokens, el.id, 'exact');
      if (tokens.length >= 2) add([...tokens].reverse(), el.id, 'reordered');
      if (tokens.length === 2 && tokens[0].length > 1) {
        add([tokens[0][0], tokens[1]], el.id, 'initials');
        add([tokens[1], tokens[0][0]], el.id, 'initials');
      }
    }
  }
  return byFirst;
}

/** Names of elements found in a text, one match per span (homonyms share it). */
export function scanNames(text: string, elements: NamedElement[]): NameMatch[] {
  const index = variants(elements);
  if (!index.size) return [];
  const ws = words(text);
  const bySpan = new Map<string, NameMatch>();
  for (let i = 0; i < ws.length; i++) {
    for (const v of index.get(ws[i].norm) ?? []) {
      let ok = i + v.tokens.length <= ws.length;
      for (let k = 1; ok && k < v.tokens.length; k++) {
        ok = ws[i + k].norm === v.tokens[k] && GAP.test(text.slice(ws[i + k - 1].end, ws[i + k].start));
      }
      if (!ok) continue;
      const start = ws[i].start;
      const end = ws[i + v.tokens.length - 1].end;
      const key = `${start}:${end}`;
      const found = bySpan.get(key);
      if (!found) bySpan.set(key, { start, end, elementIds: [v.elementId], match: v.match });
      else {
        if (!found.elementIds.includes(v.elementId)) found.elementIds.push(v.elementId);
        if (RANK[v.match] < RANK[found.match]) found.match = v.match;
      }
    }
  }
  // A longer name wins over a shorter one inside it ("Jules TERRIER" over "TERRIER").
  const sorted = [...bySpan.values()].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: NameMatch[] = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

/**
 * Suggestions of every page, without what the user already answered: a
 * passage already highlighted, or a suggestion already rejected.
 */
export function buildSuggestions(pages: string[], elements: NamedElement[], annotations: Annotation[]): Suggestion[] {
  const out: Suggestion[] = [];
  pages.forEach((text, i) => {
    const page = i + 1;
    const mine = annotations.filter((a) => a.page === page && a.textRange);
    const answered = (range: [number, number]) =>
      mine.some((a) =>
        a.kind === 'suggestion' ? a.textRange![0] === range[0] && a.textRange![1] === range[1] : a.status !== 'rejected' && overlaps(a.textRange!, range),
      );
    const names = scanNames(text, elements);
    for (const n of names) {
      if (answered([n.start, n.end])) continue;
      out.push({ key: `${page}:${n.start}:${n.end}:name`, page, start: n.start, end: n.end, source: 'dictionary', kind: 'name', elementIds: n.elementIds, match: n.match });
    }
    for (const p of extractPatterns(text)) {
      // A known element (a phone number already in the graph) says more than its pattern.
      if (names.some((n) => overlaps([n.start, n.end], [p.start, p.end]))) continue;
      if (answered([p.start, p.end])) continue;
      out.push({
        key: `${page}:${p.start}:${p.end}:${p.kind}`,
        page,
        start: p.start,
        end: p.end,
        source: 'pattern',
        kind: p.kind,
        ...(p.checksumOk !== undefined ? { checksumOk: p.checksumOk } : {}),
        ...(p.suspect ? { suspect: true } : {}),
      });
    }
  });
  return out;
}
