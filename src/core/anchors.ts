// Anchor written in the native `source` field of elements, links and events.
//
// ZN gives new ids to every object on import and emits nothing on merge.
// The anchor lets the plugin find the object an annotation points to again:
// it survives export/import and `mergeElements`, which concatenates sources
// with " ; ".
//
// It is a Markdown link, `[pv.pdf p.3](mn:1a2b3c4d)`, which ZN (2.62 and
// later) shows as a link opening the passage (slot `source:scheme`).
// Sources written by earlier versions carry `pv.pdf p.3 [mn:1a2b3c4d]`;
// both forms are read.

// Legacy token, or the end of a link: "](" keeps a free "(mn:…)" out.
const TOKEN_RE = /\[mn:([0-9a-f]{8})\]|\]\(mn:([0-9a-f]{8})\)/g;

/** Scheme of the anchor links, registered with ZN. */
export const ANCHOR_SCHEME = 'mn';

/** Short, readable form of an annotation id (first 8 hex digits of its UUID). */
export function shortId(annotationId: string): string {
  return annotationId.replace(/-/g, '').slice(0, 8).toLowerCase();
}

/** Target of the anchor link, e.g. `mn:1a2b3c4d`. */
export function anchorTarget(annotationId: string): string {
  return `${ANCHOR_SCHEME}:${shortId(annotationId)}`;
}

/**
 * The link label may not hold brackets (they would end the link or start a
 * token) nor the " ; " that separates sources.
 */
function linkLabel(text: string): string {
  return text
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/\\/g, '/')
    .replace(/;/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Source part of a passage, e.g. `[PV_audition.pdf p.3](mn:1a2b3c4d)`.
 * Without page for a text document, whose pages are not the original ones.
 */
export function anchorLabel(filename: string, page: number | null, annotationId: string): string {
  const text = linkLabel(page === null ? filename : `${filename} p.${page}`) || '?';
  return `[${text}](${anchorTarget(annotationId)})`;
}

/** Short ids of all anchors found in a source field, in either form. */
export function anchorIds(source: string | undefined | null): string[] {
  return [...(source ?? '').matchAll(TOKEN_RE)].map((m) => m[1] ?? m[2]);
}

function hasAnchor(part: string, id: string): boolean {
  return anchorIds(part).includes(id);
}

/** Appends an anchor to an existing source, without duplicating it. */
export function appendAnchor(source: string | undefined | null, label: string): string {
  const current = (source ?? '').trim();
  if (!current) return label;
  const [id] = anchorIds(label);
  if (id && hasAnchor(current, id)) return current;
  return `${current} ; ${label}`;
}

/** Removes the anchor of one annotation from a source field, keeping the rest. */
export function removeAnchor(source: string | undefined | null, annotationId: string): string {
  const id = shortId(annotationId);
  return (source ?? '')
    .split(' ; ')
    .filter((part) => !hasAnchor(part, id))
    .join(' ; ')
    .trim();
}

/** Whether a source part is exactly what the plugin wrote for this annotation. */
function writtenByPlugin(part: string, id: string): boolean {
  if (part.endsWith(` [mn:${id}]`)) return true;
  return /^\[[^\]]*\]\(mn:[0-9a-f]{8}\)$/.test(part) && part.endsWith(`(mn:${id})`);
}

/**
 * Replaces the label of one annotation's anchor, e.g. after the document's
 * reference changed. Only a part the plugin wrote is replaced: a link alone,
 * or a part that ends with a legacy token (rewritten as a link). A part the
 * user edited around the anchor, and every other part, are left as they are.
 * Null when nothing changes.
 */
export function relabelAnchor(source: string | undefined | null, annotationId: string, label: string): string | null {
  const id = shortId(annotationId);
  let changed = false;
  const parts = (source ?? '').split(' ; ').map((part) => {
    const trimmed = part.trim();
    if (!writtenByPlugin(trimmed, id) || trimmed === label) return part;
    changed = true;
    return label;
  });
  return changed ? parts.join(' ; ') : null;
}
