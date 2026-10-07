// Anchor written in the native `source` field of elements, links and events.
//
// ZN gives new ids to every object on import and emits nothing on merge.
// The anchor lets the plugin find the object an annotation points to again:
// it survives export/import and `mergeElements`, which concatenates sources.
//
// A source field holds one source per line (ZN joins merged sources with a
// line break). Fields written earlier separate them with " ; ": both
// separators are read, and kept as they are.
//
// It is a Markdown link, `[pv.pdf p.3](mn:1a2b3c4d)`, which ZN (2.62 and
// later) shows as a link opening the passage (slot `source:scheme`).

// End of the link: "](" keeps a free "(mn:…)" out.
const TOKEN_RE = /\]\(mn:([0-9a-f]{8})\)/g;

// Captured, so that split() keeps the separators between the parts.
const PART_SEPARATOR = /(\r?\n| ; )/;

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
 * token), the " ; " that used to separate sources, nor a line break.
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

/** Short ids of all anchors found in a source field. */
export function anchorIds(source: string | undefined | null): string[] {
  return [...(source ?? '').matchAll(TOKEN_RE)].map((m) => m[1]);
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
  return `${current}\n${label}`;
}

/** Removes the anchor of one annotation from a source field, keeping the rest. */
export function removeAnchor(source: string | undefined | null, annotationId: string): string {
  const id = shortId(annotationId);
  // Parts at even indices, separators at odd ones. The part after a removed
  // one takes the separator that came before the removed one: "B\n<anchor> ; C"
  // gives "B\nC", C stays on its own line.
  const pieces = (source ?? '').split(PART_SEPARATOR);
  const kept: string[] = [];
  let separator: string | null = null;
  for (let i = 0; i < pieces.length; i += 2) {
    if (separator === null && i > 0) separator = pieces[i - 1];
    if (hasAnchor(pieces[i], id)) continue;
    if (kept.length) kept.push(separator ?? '');
    kept.push(pieces[i]);
    separator = null;
  }
  return kept.join('').trim();
}

/** Whether a source part is exactly what the plugin wrote for this annotation. */
function writtenByPlugin(part: string, id: string): boolean {
  return /^\[[^\]]*\]\(mn:[0-9a-f]{8}\)$/.test(part) && part.endsWith(`(mn:${id})`);
}

/**
 * Replaces the label of one annotation's anchor, e.g. after the document's
 * reference changed. Only a part the plugin wrote is replaced: the link
 * alone. A part the user edited around the anchor, and every other part,
 * are left as they are.
 * Null when nothing changes.
 */
export function relabelAnchor(source: string | undefined | null, annotationId: string, label: string): string | null {
  const id = shortId(annotationId);
  let changed = false;
  const pieces = (source ?? '').split(PART_SEPARATOR).map((piece, i) => {
    if (i % 2 === 1) return piece;
    const trimmed = piece.trim();
    if (!writtenByPlugin(trimmed, id) || trimmed === label) return piece;
    changed = true;
    return label;
  });
  return changed ? pieces.join('') : null;
}
