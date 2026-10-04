// annotations.json in the dossier ZIP (next to dossier.json), and the rewiring
// needed on import: ZN gives new ids to every element, link and asset.

import type { Annotation, Quad } from './model.ts';
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

// annotations.json comes from a file the user received: every field is
// checked and copied one by one, unknown fields are dropped.

const HASH_RE = /^[0-9a-f]{64}$/;
const KINDS = new Set<string>(['element', 'property', 'event', 'location', 'link', 'suggestion']);
const STATUSES = new Set<string>(['suggested', 'validated', 'rejected']);
const ORIGINS = new Set<string>(['manual', 'pattern', 'dictionary', 'profile', 'oneneurone']);

const isString = (v: unknown): v is string => typeof v === 'string';
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function asQuad(v: unknown): Quad | null {
  return Array.isArray(v) && v.length === 4 && v.every(isFiniteNumber) ? [v[0], v[1], v[2], v[3]] : null;
}

function asPair<T>(v: unknown, check: (x: unknown) => x is T): [T, T] | undefined {
  return Array.isArray(v) && v.length === 2 && check(v[0]) && check(v[1]) ? [v[0], v[1]] : undefined;
}

const isStringOrNull = (v: unknown): v is string | null => v === null || isString(v);
const isOffset = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function asEventIds(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => isString(e[1])));
}

function asOcr(v: unknown): Annotation['ocr'] {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  return isString(o.rawText) && isFiniteNumber(o.confidence) && typeof o.corrected === 'boolean'
    ? { rawText: o.rawText, confidence: o.confidence, corrected: o.corrected }
    : undefined;
}

/** A well-formed annotation of the document `hash`, rebuilt field by field; null otherwise. */
export function sanitizeAnnotation(raw: unknown, hash: string): Annotation | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  if (!isString(x.id) || !x.id || x.documentHash !== hash || !Number.isInteger(x.page) || (x.page as number) < 1) return null;
  if (!isString(x.text) || !isString(x.kind) || !KINDS.has(x.kind) || !Array.isArray(x.quads)) return null;
  if (!isString(x.status) || !STATUSES.has(x.status) || !isString(x.origin) || !ORIGINS.has(x.origin)) return null;
  const quads = x.quads.map(asQuad);
  if (quads.some((q) => q === null)) return null;

  const a: Annotation = {
    id: x.id,
    documentId: isString(x.documentId) ? x.documentId : '',
    documentHash: hash,
    page: x.page as number,
    quads: quads as Quad[],
    text: x.text,
    kind: x.kind as Annotation['kind'],
    status: x.status as Annotation['status'],
    origin: x.origin as Annotation['origin'],
    createdAt: isString(x.createdAt) ? x.createdAt : '',
  };
  const textRange = asPair(x.textRange, isOffset);
  if (textRange && textRange[0] <= textRange[1]) a.textRange = textRange;
  if (isString(x.context)) a.context = x.context;
  if (isString(x.extractor)) a.extractor = x.extractor;
  if (isString(x.targetId)) a.targetId = x.targetId;
  if (isString(x.propertyKey)) a.propertyKey = x.propertyKey;
  const linkEnds = asPair(x.linkEnds, isString);
  if (linkEnds) a.linkEnds = linkEnds;
  const linkAnchors = asPair(x.linkAnchors, isStringOrNull);
  if (linkAnchors) a.linkAnchors = linkAnchors;
  const eventIds = asEventIds(x.eventIds);
  if (eventIds) a.eventIds = eventIds;
  const ocr = asOcr(x.ocr);
  if (ocr) a.ocr = ocr;
  return a;
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
    // The hash becomes a storage key: nothing but a SHA-256 is accepted.
    if (!isString(doc.hash) || !HASH_RE.test(doc.hash) || !Array.isArray(doc.annotations)) continue;
    const hash = doc.hash;
    const annotations = doc.annotations.map((a) => sanitizeAnnotation(a, hash)).filter((a): a is Annotation => a !== null);
    documents.push({ hash, annotations });
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
    const { orphan: _orphan, targetId: _target, linkEnds: _ends, eventIds: _events, ...base } = a;
    const out: Annotation = { ...base, documentId: assetByHash.get(a.documentHash) ?? a.documentId };
    // Ids of the exporting dossier mean nothing here: an orphan keeps none.
    const orphan: Annotation = { ...out, orphan: true };
    // A rejected suggestion has no graph object to find.
    if (a.kind === 'suggestion') return out;

    if (a.kind === 'link') {
      const link = linkByToken.get(token);
      return link ? { ...out, targetId: link.id, linkEnds: [link.fromId, link.toId] } : orphan;
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
      return ids.length ? { ...out, targetId: ids[0], eventIds } : { ...orphan, eventIds: {} };
    }

    return elementIds.length ? { ...out, targetId: elementIds[0] } : orphan;
  });
}

/** Adds imported annotations to those already stored, without duplicating ids. */
export function mergeAnnotations(existing: Annotation[], imported: Annotation[]): Annotation[] {
  const ids = new Set(existing.map((a) => a.id));
  return [...existing, ...imported.filter((a) => !ids.has(a.id))];
}
