// Matching a highlighted passage against existing elements.
//
// Merging two homonyms is the worst mistake the plugin can make. Only an
// exact match (after case, accent and punctuation normalization) may be
// offered as the default action; reordered names and initials are shown as
// candidates, never chosen for the user.

export type MatchKind = 'exact' | 'reordered' | 'initials';

export interface NamedElement {
  id: string;
  label: string;
  /** Alternative names, e.g. values of properties whose key is listed as alias. */
  aliases: string[];
}

export interface Candidate {
  elementId: string;
  kind: MatchKind;
  /** Name that matched: the label or one of the aliases. */
  matched: string;
}

export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(text: string): string[] {
  const n = normalizeName(text);
  return n ? n.split(' ') : [];
}

/** "j" matches "jean"; full tokens must be equal. */
function tokenCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1) return b.startsWith(a);
  if (b.length === 1) return a.startsWith(b);
  return false;
}

function initialsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length < 2) return false;
  const sameOrder = a.every((t, i) => tokenCompatible(t, b[i]));
  const reversed = a.every((t, i) => tokenCompatible(t, b[b.length - 1 - i]));
  // At least one full word must be shared: "J. M." alone says nothing.
  const fullShared = a.some((t) => t.length > 1 && b.includes(t));
  return (sameOrder || reversed) && fullShared;
}

export function matchName(passage: string, name: string): MatchKind | null {
  const a = tokens(passage);
  const b = tokens(name);
  if (!a.length || !b.length) return null;
  if (a.join(' ') === b.join(' ')) return 'exact';
  if (a.length === b.length && a.length > 1 && [...a].sort().join(' ') === [...b].sort().join(' ')) return 'reordered';
  if (initialsMatch(a, b)) return 'initials';
  return null;
}

const RANK: Record<MatchKind, number> = { exact: 0, reordered: 1, initials: 2 };

export function findCandidates(passage: string, elements: NamedElement[]): Candidate[] {
  const out: Candidate[] = [];
  for (const el of elements) {
    let best: Candidate | null = null;
    for (const name of [el.label, ...el.aliases]) {
      const kind = matchName(passage, name);
      if (kind && (!best || RANK[kind] < RANK[best.kind])) best = { elementId: el.id, kind, matched: name };
    }
    if (best) out.push(best);
  }
  return out.sort((x, y) => RANK[x.kind] - RANK[y.kind]);
}

/**
 * The element to attach to by default, if any: a single exact match.
 * Several exact matches are homonyms already in the graph; the user decides.
 */
export function defaultAttachment(candidates: Candidate[]): string | null {
  const exact = candidates.filter((c) => c.kind === 'exact');
  return exact.length === 1 ? exact[0].elementId : null;
}
