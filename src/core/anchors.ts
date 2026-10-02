// Anchor token written in the native `source` field of elements and links.
//
// ZN gives new ids to every object on import and emits nothing on merge.
// The token lets the plugin find the object an annotation points to again:
// it survives export/import and `mergeElements`, which concatenates sources
// with " ; ".

const TOKEN_RE = /\[mn:([0-9a-f]{8})\]/g;

/** Short, readable form of an annotation id (first 8 hex digits of its UUID). */
export function shortId(annotationId: string): string {
  return annotationId.replace(/-/g, '').slice(0, 8).toLowerCase();
}

export function anchorToken(annotationId: string): string {
  return `[mn:${shortId(annotationId)}]`;
}

/**
 * Human-readable source line, e.g. `PV_audition.pdf p.3 [mn:1a2b3c4d]`.
 * Without page for a text document, whose pages are not the original ones.
 */
export function anchorLabel(filename: string, page: number | null, annotationId: string): string {
  return page === null ? `${filename} ${anchorToken(annotationId)}` : `${filename} p.${page} ${anchorToken(annotationId)}`;
}

/** Appends an anchor to an existing source, without duplicating it. */
export function appendAnchor(source: string | undefined | null, label: string): string {
  const current = (source ?? '').trim();
  if (!current) return label;
  const token = label.match(TOKEN_RE)?.[0];
  if (token && current.includes(token)) return current;
  return `${current} ; ${label}`;
}

/** Short ids of all anchors found in a source field. */
export function anchorIds(source: string | undefined | null): string[] {
  return [...(source ?? '').matchAll(TOKEN_RE)].map((m) => m[1]);
}

/** Removes the anchor of one annotation from a source field, keeping the rest. */
export function removeAnchor(source: string | undefined | null, annotationId: string): string {
  const token = anchorToken(annotationId);
  return (source ?? '')
    .split(' ; ')
    .filter((part) => !part.includes(token))
    .join(' ; ')
    .trim();
}
