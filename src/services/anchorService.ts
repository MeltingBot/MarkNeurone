// ─── Passages for another plugin ─────────────────────────────
//
// Service 'mark-neurone:anchors': OneNeurone accepted an element, a link or
// an event read in a document; MarkNeurone finds its passage, records the
// highlight (origin 'oneneurone') and returns the source link to write.
// Nothing is written to the graph here: the caller writes its own source.
// Accepted one by one: 'validated'; accepted all at once: 'suggested', to be
// checked in the reader.

import { getHostAPI } from '../hostAPI.ts';
import type { Annotation } from '../core/model.ts';
import { anchorLabel } from '../core/anchors.ts';
import { locatePassage, type LocateRequest } from '../core/locate.ts';
import { sentenceAt } from '../core/sentences.ts';
import { TEXT_EXTRACTOR_ID } from '../core/textDocument.ts';
import { findAssetByHash, isPdf } from './documentAssets.ts';
import { documentPageTexts } from './documentPages.ts';
import { loadAnnotations, saveAnnotation } from './annotationStore.ts';
import { loadReference } from './documentRef.ts';

export const ANCHORS_SERVICE = 'mark-neurone:anchors';

export interface AnchorRequest extends LocateRequest {
  dossierId: string;
  /** SHA-256 of the document (OneNeurone's source key). */
  documentHash: string;
  /** Element, link or (for an event) its first element. */
  targetId: string;
  /** Event: event id per element. */
  eventIds?: Record<string, string>;
  /** Link: its ends [from, to]. */
  linkEnds?: [string, string];
  status: 'validated' | 'suggested';
}

export interface AnchorResult {
  /** Source line to write, e.g. `[PV n° 347 p.3](mn:1a2b3c4d)`. */
  sourcePart: string;
  annotationId: string;
  page: number;
}

export async function anchorPassage(req: AnchorRequest): Promise<AnchorResult | null> {
  const asset = findAssetByHash(req.documentHash);
  if (!asset || !req.targetId) return null;
  const pages = await documentPageTexts(req.dossierId, req.documentHash);
  const found = pages ? locatePassage(pages, req) : null;
  if (!found || !pages) return null;

  const pdf = isPdf(asset);
  const label = (a: Annotation, reference: string) => anchorLabel(reference || asset.filename, pdf ? a.page : null, a.id);
  const reference = await loadReference(req.dossierId, req.documentHash);

  // The same passage of the same object: the highlight already exists.
  const existing = (await loadAnnotations(req.dossierId, req.documentHash)).find(
    (a) => a.kind === req.kind && a.targetId === req.targetId && a.page === found.page
      && a.textRange?.[0] === found.start && a.textRange?.[1] === found.end && a.status !== 'rejected',
  );
  if (existing) {
    // Accepted again one by one: no longer to be checked.
    if (existing.status === 'suggested' && req.status === 'validated') await saveAnnotation(req.dossierId, { ...existing, status: 'validated' });
    return { sourcePart: label(existing, reference), annotationId: existing.id, page: existing.page };
  }

  const text = pages[found.page - 1];
  const context = sentenceAt(text, found.start, found.end)?.text;
  const annotation: Annotation = {
    id: getHostAPI().generateUUID(),
    documentId: asset.id,
    documentHash: req.documentHash,
    page: found.page,
    // Drawn once the reader shows the page (offsets are enough until then).
    quads: [],
    text: text.slice(found.start, found.end),
    textRange: [found.start, found.end],
    ...(context ? { context } : {}),
    ...(pdf ? {} : { extractor: TEXT_EXTRACTOR_ID }),
    kind: req.kind,
    status: req.status,
    origin: 'oneneurone',
    targetId: req.targetId,
    ...(req.eventIds ? { eventIds: req.eventIds } : {}),
    ...(req.linkEnds ? { linkEnds: req.linkEnds } : {}),
    createdAt: new Date().toISOString(),
  };
  await saveAnnotation(req.dossierId, annotation);
  return { sourcePart: label(annotation, reference), annotationId: annotation.id, page: annotation.page };
}

/** The service as offered to other plugins. */
export const markAnchorsV1 = {
  version: 1,
  anchorPassage,
};
