// Elements highlighted in a document, in reading order, for the sheet's list.

import type { Annotation } from './model.ts';

export interface IndexEntry {
  elementId: string;
  /** Passages of the document that carry the element's anchor. */
  count: number;
  /** First of them in reading order. */
  first: Annotation;
}

/** Reading order within a page: text offset, else top of the first box (PDF y grows upwards). */
const position = (a: Annotation): [number, number] => [a.page, a.textRange?.[0] ?? -(a.quads[0]?.[3] ?? 0)];

function before(a: Annotation, b: Annotation): boolean {
  const [pa, oa] = position(a);
  const [pb, ob] = position(b);
  return pa < pb || (pa === pb && oa < ob);
}

/** Elements anchored by validated highlights (links and suggestions aside), by first appearance. */
export function documentIndex(annotations: Annotation[]): IndexEntry[] {
  const byElement = new Map<string, IndexEntry>();
  for (const a of annotations) {
    if (a.kind === 'link' || a.kind === 'suggestion' || a.status !== 'validated' || a.orphan) continue;
    const ids = new Set([...(a.targetId ? [a.targetId] : []), ...Object.keys(a.eventIds ?? {})]);
    for (const id of ids) {
      const entry = byElement.get(id);
      if (!entry) byElement.set(id, { elementId: id, count: 1, first: a });
      else {
        entry.count++;
        if (before(a, entry.first)) entry.first = a;
      }
    }
  }
  return [...byElement.values()].sort((x, y) => (before(x.first, y.first) ? -1 : before(y.first, x.first) ? 1 : 0));
}
