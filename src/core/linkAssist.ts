// Link assistance, both optional (settings): the "verb" mode and the
// co-occurrence marks (scoping note, sections 4.2 and 4.3). Nothing is
// created here: both only prefill the link form.

import type { Annotation } from './model.ts';
import { paragraphRanges, sentenceRanges } from './sentences.ts';

/** A validated highlight of an element, with its offsets in the page text. */
export interface ElementHighlight {
  annotation: Annotation;
  elementId: string;
  range: [number, number];
}

/** Highlights of elements (links, suggestions, rejected and orphans aside) of one page. */
export function elementHighlights(annotations: Annotation[], page: number): ElementHighlight[] {
  return annotations
    .filter((a) => a.page === page && a.kind !== 'link' && a.kind !== 'suggestion' && a.status === 'validated' && !a.orphan && a.targetId && a.textRange)
    .map((a) => ({ annotation: a, elementId: a.targetId!, range: a.textRange! }))
    .sort((x, y) => x.range[0] - y.range[0]);
}

/**
 * Verb mode: the element highlighted nearest before the words of the
 * relation, and the one nearest after, within the sentence. Either may be
 * missing; the user confirms or corrects both.
 */
export function verbEnds(
  highlights: ElementHighlight[],
  relation: [number, number],
  sentence: [number, number],
): { from: ElementHighlight | null; to: ElementHighlight | null } {
  const inside = highlights.filter((h) => h.range[0] >= sentence[0] && h.range[1] <= sentence[1]);
  const before = inside.filter((h) => h.range[1] <= relation[0]);
  const after = inside.filter((h) => h.range[0] >= relation[1]);
  return { from: before[before.length - 1] ?? null, to: after[0] ?? null };
}

export interface Cooccurrence {
  /** Unordered pair of element ids, sorted: "a|b". */
  key: string;
  page: number;
  /** First highlight of each element in the sentence or paragraph, in reading order. */
  from: Annotation;
  to: Annotation;
}

export const pairKey = (a: string, b: string): string => [a, b].sort().join('|');

/**
 * Two elements highlighted in one sentence (or paragraph) of a page that are
 * not linked in the graph, in either direction, and whose pair the user did
 * not dismiss. One mark per pair and page.
 */
export function cooccurrences(
  pageTexts: string[],
  annotations: Annotation[],
  scope: 'sentence' | 'paragraph',
  linked: Set<string>,
  dismissed: Set<string>,
): Cooccurrence[] {
  const out: Cooccurrence[] = [];
  pageTexts.forEach((text, i) => {
    const page = i + 1;
    const highlights = elementHighlights(annotations, page);
    if (highlights.length < 2) return;
    const seen = new Set<string>();
    const units = scope === 'sentence' ? sentenceRanges(text) : paragraphRanges(text);
    for (const [start, end] of units) {
      const inside = highlights.filter((h) => h.range[0] >= start && h.range[1] <= end);
      for (let a = 0; a < inside.length; a++) {
        for (let b = a + 1; b < inside.length; b++) {
          const x = inside[a];
          const y = inside[b];
          if (x.elementId === y.elementId) continue;
          const key = pairKey(x.elementId, y.elementId);
          if (seen.has(key) || linked.has(key) || dismissed.has(key)) continue;
          seen.add(key);
          out.push({ key, page, from: x.annotation, to: y.annotation });
        }
      }
    }
  });
  return out;
}
