// annotations.json in the dossier ZIP (next to dossier.json), and the rewiring
// needed on import: ZN gives new ids to every element, link and asset.

import type { Annotation } from './model.ts';
import { anchorIds, shortId } from './anchors.ts';

export const EXPORT_FILE = 'annotations.json';
export const EXPORT_FORMAT = 'markneurone-annotations';
export const EXPORT_VERSION = 1;

export interface DocumentAnnotations {
  /** SHA-256 of the PDF: the only identifier that survives an import. */
  hash: string;
  annotations: Annotation[];
}

export interface AnnotationExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  documents: DocumentAnnotations[];
}

export function buildExport(documents: DocumentAnnotations[], exportedAt = new Date().toISOString()): AnnotationExport | null {
  const kept = documents.filter((d) => d.annotations.length > 0);
  return kept.length ? { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt, documents: kept } : null;
}

const KINDS = new Set(['element', 'property', 'event', 'location', 'link', 'suggestion']);

function isAnnotation(a: unknown): a is Annotation {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.documentHash === 'string' &&
    typeof x.page === 'number' &&
    Array.isArray(x.quads) &&
    typeof x.text === 'string' &&
    typeof x.kind === 'string' &&
    KINDS.has(x.kind)
  );
}

/** Checks the file; malformed annotations are dropped, a foreign file is refused. */
export function parseExport(json: unknown): AnnotationExport | null {
  if (!json || typeof json !== 'object') return null;
  const x = json as Record<string, unknown>;
  if (x.format !== EXPORT_FORMAT || typeof x.version !== 'number' || x.version > EXPORT_VERSION || !Array.isArray(x.documents)) return null;
  const documents: DocumentAnnotations[] = [];
  for (const d of x.documents as unknown[]) {
    if (!d || typeof d !== 'object') continue;
    const doc = d as Record<string, unknown>;
    if (typeof doc.hash !== 'string' || !Array.isArray(doc.annotations)) continue;
    documents.push({ hash: doc.hash, annotations: (doc.annotations as unknown[]).filter(isAnnotation) });
  }
  return { format: EXPORT_FORMAT, version: x.version, exportedAt: String(x.exportedAt ?? ''), documents };
}

export interface ImportedGraph {
  elements: { id: string; source?: string; events?: { id: string; source?: string }[] }[];
  links: { id: string; source?: string; fromId: string; toId: string }[];
  assets: { id: string; hash: string }[];
}

/**
 * Points imported annotations at the new ids, through the anchor tokens kept
 * in `source` fields and the document hash. An annotation whose object cannot
 * be found is kept and flagged orphan: the reading work is not lost.
 */
export function rewire(annotations: Annotation[], graph: ImportedGraph): Annotation[] {
  const elementsByToken = new Map<string, string[]>();
  for (const el of graph.elements) {
    for (const token of anchorIds(el.source)) elementsByToken.set(token, [...(elementsByToken.get(token) ?? []), el.id]);
  }
  const linkByToken = new Map<string, ImportedGraph['links'][number]>();
  for (const link of graph.links) for (const token of anchorIds(link.source)) linkByToken.set(token, link);
  const assetByHash = new Map(graph.assets.map((a) => [a.hash, a.id]));

  return annotations.map((a) => {
    const token = shortId(a.id);
    const { orphan: _orphan, ...base } = a;
    const out: Annotation = { ...base, documentId: assetByHash.get(a.documentHash) ?? a.documentId };
    // A rejected suggestion has no graph object to find.
    if (a.kind === 'suggestion') return out;

    if (a.kind === 'link') {
      const link = linkByToken.get(token);
      return link ? { ...out, targetId: link.id, linkEnds: [link.fromId, link.toId] } : { ...out, orphan: true };
    }

    const elementIds = elementsByToken.get(token) ?? [];
    if (a.kind === 'event') {
      const eventIds: Record<string, string> = {};
      for (const elementId of elementIds) {
        const el = graph.elements.find((e) => e.id === elementId);
        const ev = el?.events?.find((e) => anchorIds(e.source).includes(token));
        if (ev) eventIds[elementId] = ev.id;
      }
      const ids = Object.keys(eventIds);
      return ids.length ? { ...out, targetId: ids[0], eventIds } : { ...out, eventIds: {}, orphan: true };
    }

    return elementIds.length ? { ...out, targetId: elementIds[0] } : { ...out, orphan: true };
  });
}

/** Adds imported annotations to those already stored, without duplicating ids. */
export function mergeAnnotations(existing: Annotation[], imported: Annotation[]): Annotation[] {
  const ids = new Set(existing.map((a) => a.id));
  return [...existing, ...imported.filter((a) => !ids.has(a.id))];
}
