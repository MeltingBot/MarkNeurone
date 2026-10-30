// ─── Qualification actions ───────────────────────────────────
//
// Each gesture writes to the graph through graphWriter, then records the
// annotation with its anchor. Deleting an annotation removes the highlight
// and its anchor token, never the graph object: the user decides in ZN.

import { getHostAPI } from '../hostAPI.ts';
import type { Annotation, AnnotationKind, AnnotationOrigin } from '../core/model.ts';
import { anchorLabel, relabelAnchor } from '../core/anchors.ts';
import type { Passage } from './selectionCapture.ts';
import { isPdf, type DocumentAsset } from './documentAssets.ts';
import { TEXT_EXTRACTOR_ID } from '../core/textDocument.ts';
import { removeAnnotation, saveAnnotation } from './annotationStore.ts';
import * as graph from './graphWriter.ts';
import type { ZnElement, ZnElementEvent, ZnGeo, ZnProperty } from './znTypes.ts';

export interface DocumentContext {
  dossierId: string;
  asset: DocumentAsset;
  /** Reference given by the user; the file name otherwise. */
  reference?: string;
}

function draft(ctx: DocumentContext, passage: Passage, kind: AnnotationKind): Annotation {
  return {
    id: getHostAPI().generateUUID(),
    documentId: ctx.asset.id,
    documentHash: ctx.asset.hash,
    page: passage.page,
    quads: passage.quads,
    text: passage.text,
    ...(passage.area ? { area: true as const } : {}),
    ...(passage.context ? { context: passage.context } : {}),
    ...(passage.textRange ? { textRange: passage.textRange } : {}),
    ...(isPdf(ctx.asset) ? {} : { extractor: TEXT_EXTRACTOR_ID }),
    ...(passage.ocr ? { ocr: { ...passage.ocr, corrected: false } } : {}),
    kind,
    status: 'validated',
    origin: passage.origin ?? 'manual',
    createdAt: new Date().toISOString(),
  };
}

/** The user dismissed a suggestion: it is not shown again on this passage. */
export async function rejectSuggestion(ctx: DocumentContext, passage: Passage): Promise<void> {
  await saveAnnotation(ctx.dossierId, { ...draft(ctx, passage, 'suggestion'), status: 'rejected' });
}

const anchorOf = (ctx: DocumentContext, a: Annotation) => anchorLabel(ctx.reference || ctx.asset.filename, isPdf(ctx.asset) ? a.page : null, a.id);

/**
 * On a scanned page the user may correct what the OCR read: the annotation
 * then keeps the validated text, and the raw OCR text next to it.
 */
function withValidatedText(a: Annotation, validated: string): Annotation {
  if (!a.ocr || validated === a.ocr.rawText) return a;
  return { ...a, text: validated, ocr: { ...a.ocr, corrected: true } };
}

/** For a framed picture: attach it to the element. */
export interface ElementOptions {
  attachImage?: boolean;
}

/** The framed picture as a file named after the document and page, e.g. "PV n° 347 p.3.jpg". */
export function areaFile(ctx: DocumentContext, passage: Passage): File | null {
  const url = passage.area ? passage.preview?.image : undefined;
  const match = url?.match(/^data:([^;,]+);base64,(.*)$/);
  if (!match) return null;
  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const name = `${ctx.reference || ctx.asset.filename.replace(/\.[^.]+$/, '')} p.${passage.page}`.replace(/[\\/:*?"<>|]/g, '_');
  return new File([bytes], `${name}.${match[1] === 'image/png' ? 'png' : 'jpg'}`, { type: match[1] });
}

async function attachArea(ctx: DocumentContext, passage: Passage, elementId: string, options: ElementOptions): Promise<void> {
  const file = options.attachImage ? areaFile(ctx, passage) : null;
  if (file) await graph.attachImage(elementId, file);
}

export async function qualifyAsNewElement(ctx: DocumentContext, passage: Passage, label: string, tags: string[], options: ElementOptions = {}): Promise<string> {
  const drafted = draft(ctx, passage, 'element');
  // A picture has no text: its passage is the name given to it.
  const a = passage.area ? { ...drafted, text: label } : withValidatedText(drafted, label);
  const el = await graph.createElement(label, tags, anchorOf(ctx, a));
  await saveAnnotation(ctx.dossierId, { ...a, targetId: el.id });
  await attachArea(ctx, passage, el.id, options);
  return el.id;
}

export async function qualifyAsExistingElement(ctx: DocumentContext, passage: Passage, elementId: string, options: ElementOptions = {}): Promise<string> {
  const drafted = draft(ctx, passage, 'element');
  const a = passage.area ? { ...drafted, text: graph.getElement(elementId)?.label ?? '' } : drafted;
  await graph.attachAnchor(elementId, anchorOf(ctx, a));
  await saveAnnotation(ctx.dossierId, { ...a, targetId: elementId });
  await attachArea(ctx, passage, elementId, options);
  return elementId;
}

export async function qualifyAsProperty(ctx: DocumentContext, passage: Passage, elementId: string, property: ZnProperty): Promise<void> {
  const a = typeof property.value === 'string' ? withValidatedText(draft(ctx, passage, 'property'), property.value) : draft(ctx, passage, 'property');
  await graph.addProperty(elementId, property, anchorOf(ctx, a));
  await saveAnnotation(ctx.dossierId, { ...a, targetId: elementId, propertyKey: property.key });
}

/** Property of one of the element's events; the annotation keeps the event in eventIds. */
export async function qualifyAsEventProperty(ctx: DocumentContext, passage: Passage, elementId: string, eventId: string, property: ZnProperty): Promise<void> {
  const a = typeof property.value === 'string' ? withValidatedText(draft(ctx, passage, 'property'), property.value) : draft(ctx, passage, 'property');
  await graph.addEventProperty(elementId, eventId, property, anchorOf(ctx, a));
  await saveAnnotation(ctx.dossierId, { ...a, targetId: elementId, propertyKey: property.key, eventIds: { [elementId]: eventId } });
}

/**
 * Passage of a property the element, or one of its events, already has:
 * the property is left as it is, the passage only points to it.
 */
export async function qualifyAsExistingProperty(ctx: DocumentContext, passage: Passage, elementId: string, key: string, eventId?: string): Promise<void> {
  const a = draft(ctx, passage, 'property');
  if (eventId) await graph.attachEventAnchor(elementId, eventId, anchorOf(ctx, a));
  else await graph.attachAnchor(elementId, anchorOf(ctx, a));
  await saveAnnotation(ctx.dossierId, { ...a, targetId: elementId, propertyKey: key, ...(eventId ? { eventIds: { [elementId]: eventId } } : {}) });
}

/** Place read in the document (an address), located on the element. */
export async function qualifyAsLocation(ctx: DocumentContext, passage: Passage, elementId: string, geo: ZnGeo): Promise<void> {
  const a = draft(ctx, passage, 'location');
  await graph.setLocation(elementId, geo, anchorOf(ctx, a));
  await saveAnnotation(ctx.dossierId, { ...a, targetId: elementId });
}

export async function qualifyAsEvent(
  ctx: DocumentContext,
  passage: Passage,
  elementIds: string[],
  event: Omit<ZnElementEvent, 'id'>,
): Promise<void> {
  const a = draft(ctx, passage, 'event');
  const eventIds = await graph.addEvent(elementIds, event, anchorOf(ctx, a));
  await saveAnnotation(ctx.dossierId, { ...a, targetId: elementIds[0], eventIds });
}

/** Where a link was read: the words between its ends, or just a page. */
export type LinkPlace = { passage: Passage } | { page: number; text: string; context?: string; origin?: AnnotationOrigin };

/**
 * Link between two elements. When both ends sit in one sentence the words
 * between them are highlighted; otherwise the link is recorded without a
 * highlight, on the page of the first click.
 */
export async function qualifyAsLink(
  ctx: DocumentContext,
  place: LinkPlace,
  fromId: string,
  toId: string,
  label: string,
  anchors: [string | null, string | null] = [null, null],
): Promise<string> {
  const a: Annotation =
    'passage' in place
      ? draft(ctx, place.passage, 'link')
      : {
          id: getHostAPI().generateUUID(),
          documentId: ctx.asset.id,
          documentHash: ctx.asset.hash,
          page: place.page,
          quads: [],
          text: place.text,
          ...(place.context ? { context: place.context } : {}),
          kind: 'link',
          status: 'validated',
          origin: place.origin ?? 'manual',
          createdAt: new Date().toISOString(),
        };
  const link = await graph.createLink(fromId, toId, label, anchorOf(ctx, a));
  // A passage comes only from the verb mode: the words the user selected as the relation.
  await saveAnnotation(ctx.dossierId, { ...a, targetId: link.id, linkEnds: [fromId, toId], linkAnchors: anchors, ...('passage' in place ? { relationWords: true } : {}) });
  return link.id;
}

/** Elements carrying the anchor of an annotation (links carry their own). */
export function anchoredElements(a: Annotation): string[] {
  if (a.kind === 'link') return [];
  const ids = new Set<string>();
  if (a.targetId) ids.add(a.targetId);
  for (const id of Object.keys(a.eventIds ?? {})) ids.add(id);
  return [...ids];
}

/** Elements an annotation is about: its anchors, or both ends of a link. */
export function concernedElements(a: Annotation): string[] {
  return a.kind === 'link' ? [...(a.linkEnds ?? [])] : anchoredElements(a);
}

export async function deleteAnnotation(ctx: DocumentContext, a: Annotation): Promise<void> {
  await removePassage(ctx.dossierId, a);
}

/** The highlight and its anchor in the graph object's source; never the object. */
async function removePassage(dossierId: string, a: Annotation): Promise<void> {
  if (a.kind === 'link' && a.targetId) await graph.detachLinkAnchor(a.targetId, a.id);
  for (const elementId of anchoredElements(a)) await graph.detachAnchor(elementId, a.id);
  await removeAnnotation(dossierId, a.documentHash, a.id);
}

/** Removes highlights whose graph object is gone (orphans), on the user's request. */
export async function removeOrphans(dossierId: string, annotations: Annotation[]): Promise<void> {
  for (const a of annotations) if (a.orphan) await removePassage(dossierId, a);
}

/** A passage found by OneNeurone and accepted all at once, checked by the user. */
export async function validatePassage(ctx: DocumentContext, a: Annotation): Promise<void> {
  await saveAnnotation(ctx.dossierId, { ...a, status: 'validated' });
}

// ─── Reattaching an orphan ───────────────────────────────────
// Always a user's choice: the element is picked in the sheet, never guessed.

function attached(a: Annotation, changes: Partial<Annotation>): Annotation {
  const { orphan: _orphan, ...rest } = a;
  return { ...rest, ...changes };
}

/** Element, location or property passage, onto an element chosen by the user. */
export async function reattachToElement(
  ctx: DocumentContext,
  a: Annotation,
  elementId: string,
  options: { recreateProperty?: { key: string; value: string } } = {},
): Promise<void> {
  const anchor = anchorOf(ctx, a);
  if (a.kind === 'property' && options.recreateProperty) {
    await graph.addProperty(elementId, { key: options.recreateProperty.key, value: options.recreateProperty.value, type: 'text' }, anchor);
  } else {
    await graph.attachAnchor(elementId, anchor);
  }
  await saveAnnotation(ctx.dossierId, attached(a, { targetId: elementId }));
}

/** The event was lost with its element: it is created again on the chosen elements. */
export async function reattachEvent(ctx: DocumentContext, a: Annotation, elementIds: string[], date: Date): Promise<void> {
  const eventIds = await graph.addEvent(
    elementIds,
    { date, label: a.text, ...(a.context ? { description: a.context } : {}) },
    anchorOf(ctx, a),
  );
  await saveAnnotation(ctx.dossierId, attached(a, { targetId: elementIds[0], eventIds }));
}

/** The link was lost: it is created again between the chosen elements. */
export async function reattachLink(ctx: DocumentContext, a: Annotation, fromId: string, toId: string, label: string): Promise<void> {
  const link = await graph.createLink(fromId, toId, label, anchorOf(ctx, a));
  await saveAnnotation(ctx.dossierId, attached(a, { targetId: link.id, linkEnds: [fromId, toId] }));
}


// ─── Reference of the document changed ───────────────────────
// Offered to the user, never automatic: only the parts of `source` the
// plugin wrote for this document are rewritten (see relabelAnchor).

export interface RelabelPlan {
  elements: Map<string, Pick<ZnElement, 'source' | 'events'>>;
  links: Map<string, string>;
}

/** Sources that would change if the document's anchors took ctx.reference. */
export function planRelabel(ctx: DocumentContext, annotations: Annotation[]): RelabelPlan {
  const plan: RelabelPlan = { elements: new Map(), links: new Map() };
  for (const a of annotations) {
    if (a.kind === 'suggestion' || a.orphan || !a.targetId) continue;
    const label = anchorOf(ctx, a);
    if (a.kind === 'link') {
      const current = plan.links.get(a.targetId) ?? graph.getLink(a.targetId)?.source;
      const next = relabelAnchor(current, a.id, label);
      if (next !== null) plan.links.set(a.targetId, next);
      continue;
    }
    for (const elementId of anchoredElements(a)) {
      const el = graph.getElement(elementId);
      if (!el) continue;
      const pending = plan.elements.get(elementId) ?? { source: el.source ?? '', events: el.events };
      const source = relabelAnchor(pending.source, a.id, label);
      let eventsChanged = false;
      const events = pending.events.map((ev) => {
        const next = relabelAnchor(ev.source, a.id, label);
        if (next === null) return ev;
        eventsChanged = true;
        return { ...ev, source: next };
      });
      if (source !== null || eventsChanged || plan.elements.has(elementId)) {
        plan.elements.set(elementId, { source: source ?? pending.source, events });
      }
    }
  }
  return plan;
}

export function relabelCount(plan: RelabelPlan): number {
  return plan.elements.size + plan.links.size;
}

export async function applyRelabel(plan: RelabelPlan): Promise<void> {
  for (const [id, changes] of plan.elements) await graph.updateElement(id, changes);
  for (const [id, source] of plan.links) await graph.updateLink(id, { source });
}
