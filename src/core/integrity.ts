// Keeps annotations pointing at the graph as it changes.
//
// ZN emits no event on merge: the merged element is just gone, and the target
// gets the concatenated sources (with their anchor tokens), the events and the
// retargeted links. Following the token follows the merge the user made; it
// never attaches a passage to an element the user did not choose.

import type { Annotation } from './model.ts';
import { anchorIds, shortId } from './anchors.ts';

export interface LiveGraph {
  elements: { id: string; source?: string; events?: { id: string; source?: string }[] }[];
  links: { id: string; source?: string; fromId: string; toId: string }[];
}

export interface Reconciled {
  annotations: Annotation[];
  /** Annotations whose target, ends or orphan flag changed. */
  changed: number;
  /** Elements that disappeared and where their passages went (merge): old id → new id. */
  moved: Record<string, string>;
}

function sameEnds(a?: [string, string], b?: [string, string]): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

function sameIds(a: Record<string, string> = {}, b: Record<string, string> = {}): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * The current target is kept while it carries the anchor token. Otherwise the
 * element carrying the token is taken (merge, or undo of a merge); if no
 * element carries it, an existing target is kept (the user may have edited
 * the source field). Failing all that, the annotation is flagged orphan and
 * keeps its last target, so that an undo of a deletion restores it.
 */
export function reconcile(annotations: Annotation[], graph: LiveGraph): Reconciled {
  const elementIds = new Set(graph.elements.map((e) => e.id));
  const byToken = new Map<string, string[]>();
  for (const el of graph.elements) for (const t of anchorIds(el.source)) byToken.set(t, [...(byToken.get(t) ?? []), el.id]);

  let changed = 0;
  const moved: Record<string, string> = {};
  const out = annotations.map((a) => {
    // A rejected suggestion has no graph object to follow.
    if (a.kind === 'suggestion') return a;
    const token = shortId(a.id);
    let next: Annotation = a;

    if (a.kind === 'link') {
      const link =
        graph.links.find((l) => l.id === a.targetId) ?? graph.links.find((l) => anchorIds(l.source).includes(token));
      next = link
        ? { ...a, targetId: link.id, linkEnds: [link.fromId, link.toId], orphan: undefined }
        : { ...a, orphan: true };
    } else if (a.kind === 'event') {
      const eventIds: Record<string, string> = {};
      for (const el of graph.elements) {
        const known = a.eventIds?.[el.id];
        const ev = el.events?.find((e) => e.id === known) ?? el.events?.find((e) => anchorIds(e.source).includes(token));
        if (ev) eventIds[el.id] = ev.id;
      }
      const ids = Object.keys(eventIds);
      next = ids.length
        ? { ...a, eventIds, targetId: a.targetId && eventIds[a.targetId] ? a.targetId : ids[0], orphan: undefined }
        : { ...a, orphan: true };
    } else {
      const carriers = byToken.get(token) ?? [];
      const current = a.targetId && elementIds.has(a.targetId) ? a.targetId : null;
      const target = current && carriers.includes(current) ? current : (carriers[0] ?? current);
      next = target
        ? target === a.targetId && !a.orphan
          ? a
          : { ...a, targetId: target, orphan: undefined }
        : { ...a, orphan: true };
    }

    if (next.orphan === undefined) delete next.orphan;
    const differs =
      next.targetId !== a.targetId ||
      !!next.orphan !== !!a.orphan ||
      (a.kind === 'link' && !sameEnds(next.linkEnds, a.linkEnds)) ||
      (a.kind === 'event' && !sameIds(next.eventIds, a.eventIds));
    if (differs) changed++;
    if (a.kind !== 'link' && a.targetId && next.targetId && next.targetId !== a.targetId && !elementIds.has(a.targetId)) {
      moved[a.targetId] = next.targetId;
    }
    return differs ? next : a;
  });
  return { annotations: out, changed, moved };
}
