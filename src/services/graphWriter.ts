// ─── Graph writer ────────────────────────────────────────────
//
// The only module that writes to ZN's graph. Every write goes through
// useDossierStore (the Y.Doc), never through repositories, and stamps the
// anchor of the annotation in the native `source` field.

import { getHostAPI } from '../hostAPI.ts';
import { appendAnchor, removeAnchor } from '../core/anchors.ts';
import type { ZnElement, ZnElementEvent, ZnGeo, ZnLink, ZnProperty, ZnTagSet } from './znTypes.ts';

function store() {
  return getHostAPI().stores.useDossierStore.getState();
}

export function getElement(id: string): ZnElement | undefined {
  return store().elements.find((e: ZnElement) => e.id === id);
}

// Room taken by a node on the canvas, generous enough for labels and documents.
const NODE_W = 160;
const NODE_H = 110;

/** First free spot on a spiral around the centre of the visible canvas. */
export function freePosition(
  center: { x: number; y: number },
  occupied: { x: number; y: number }[],
): { x: number; y: number } {
  const free = (p: { x: number; y: number }) =>
    occupied.every((o) => Math.abs(o.x - p.x) >= NODE_W || Math.abs(o.y - p.y) >= NODE_H);
  if (free(center)) return center;
  for (let ring = 1; ring <= 12; ring++) {
    const steps = ring * 8;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const p = { x: center.x + Math.cos(angle) * ring * NODE_W, y: center.y + Math.sin(angle) * ring * NODE_H };
      if (free(p)) return p;
    }
  }
  return center;
}

/** Near the centre of the visible canvas, away from existing nodes. ZN keeps the canvas size private. */
function placementPosition(): { x: number; y: number } {
  const { viewport } = getHostAPI().stores.useViewStore.getState() as {
    viewport: { x: number; y: number; zoom: number };
  };
  const pane = document.querySelector('.react-flow');
  const width = pane?.clientWidth || window.innerWidth - 350;
  const height = pane?.clientHeight || window.innerHeight;
  const center = {
    x: (-viewport.x + width / 2) / viewport.zoom,
    y: (-viewport.y + height / 2) / viewport.zoom,
  };
  return freePosition(center, store().elements.map((e: ZnElement) => e.position));
}

export async function createElement(label: string, tags: string[], anchor: string): Promise<ZnElement> {
  const el = await store().createElement(label, placementPosition(), { tags, source: anchor });
  await registerTags(tags);
  return el;
}

const tagSetStore = () => getHostAPI().stores.useTagSetStore.getState();

/** New tag names join the dossier's tag list, as ZN's panel does. */
async function registerTags(tags: string[]): Promise<void> {
  const known = new Set<string>([
    ...(store().currentDossier?.settings.existingTags ?? []),
    ...tagSetStore().getAll().map((ts: ZnTagSet) => ts.name),
  ]);
  for (const tag of tags) if (!known.has(tag)) await store().addExistingTag(tag);
}

/** Tag color, shared by every element carrying the tag (ZN TagSet). */
export async function setTagColor(tag: string, color: string | null): Promise<void> {
  const existing: ZnTagSet | undefined = tagSetStore().getAll().find((ts: ZnTagSet) => ts.name.toLowerCase() === tag.toLowerCase());
  if (existing) {
    await tagSetStore().update(existing.id, { defaultVisual: { ...existing.defaultVisual, color } });
  } else if (color) {
    await tagSetStore().create({
      name: tag,
      description: '',
      defaultVisual: { color, shape: null, icon: null },
      suggestedProperties: [],
      isBuiltIn: false,
    });
  }
}

export async function attachAnchor(elementId: string, anchor: string): Promise<void> {
  const el = getElement(elementId);
  if (!el) throw new Error('element not found');
  await store().updateElement(elementId, { source: appendAnchor(el.source, anchor) });
}

export async function addProperty(elementId: string, property: ZnProperty, anchor: string): Promise<void> {
  const el = getElement(elementId);
  if (!el) throw new Error('element not found');
  await store().updateElement(elementId, {
    properties: [...el.properties, property],
    source: appendAnchor(el.source, anchor),
  });
}

export async function setLocation(elementId: string, geo: ZnGeo, anchor: string): Promise<void> {
  const el = getElement(elementId);
  if (!el) throw new Error('element not found');
  await store().updateElement(elementId, { geo, source: appendAnchor(el.source, anchor) });
}

/** Adds the same event to each element; returns the event id created on each. */
export async function addEvent(
  elementIds: string[],
  event: Omit<ZnElementEvent, 'id'>,
  anchor: string,
): Promise<Record<string, string>> {
  const api = getHostAPI();
  const ids: Record<string, string> = {};
  for (const elementId of elementIds) {
    const el = getElement(elementId);
    if (!el) continue;
    const id = api.generateUUID();
    await store().updateElement(elementId, {
      events: [...el.events, { ...event, id, source: anchor }],
      source: appendAnchor(el.source, anchor),
    });
    ids[elementId] = id;
  }
  return ids;
}

export function getLink(id: string): ZnLink | undefined {
  return store().links.find((l: ZnLink) => l.id === id);
}

/** Directed link from → to; `directed` mirrors `direction` for ZN's deprecated field. */
export async function createLink(fromId: string, toId: string, label: string, anchor: string): Promise<ZnLink> {
  return store().createLink(fromId, toId, { label, direction: 'forward', directed: true, source: anchor });
}

export async function updateLink(id: string, changes: Partial<Pick<ZnLink, 'label' | 'fromId' | 'toId' | 'confidence' | 'evaluation' | 'source'>>): Promise<void> {
  if (!getLink(id)) throw new Error('link not found');
  await store().updateLink(id, changes);
}

export async function deleteLink(id: string): Promise<void> {
  await store().deleteLink(id);
}

export async function detachLinkAnchor(linkId: string, annotationId: string): Promise<void> {
  const link = getLink(linkId);
  if (!link) return;
  const source = removeAnchor(link.source, annotationId);
  if (source !== link.source) await store().updateLink(linkId, { source });
}

/** Direct edits from the reader's element sheet. */
export async function updateElement(
  elementId: string,
  changes: Partial<Pick<ZnElement, 'label' | 'tags' | 'properties' | 'events' | 'geo' | 'confidence' | 'evaluation' | 'source'>>,
): Promise<void> {
  if (!getElement(elementId)) throw new Error('element not found');
  await store().updateElement(elementId, changes);
  if (changes.tags) await registerTags(changes.tags);
}

/** Removes the anchor of an annotation from an element, if the element still exists. */
export async function detachAnchor(elementId: string, annotationId: string): Promise<void> {
  const el = getElement(elementId);
  if (!el) return;
  const source = removeAnchor(el.source, annotationId);
  if (source !== el.source) await store().updateElement(elementId, { source });
}

/** Selects the element on the canvas and centres the view on it. */
export function revealOnCanvas(elementId: string): void {
  const api = getHostAPI();
  const el = getElement(elementId);
  if (!el) return;
  api.stores.useSelectionStore.getState().selectElement(elementId);
  const pane = document.querySelector('.react-flow');
  const width = pane?.clientWidth || window.innerWidth - 350;
  const height = pane?.clientHeight || window.innerHeight;
  const zoom = 1;
  // Same centring as ZN's search (components/modals/SearchModal.tsx), default node size.
  const cx = el.position.x + 28;
  const cy = el.position.y + 28;
  api.stores.useViewStore.getState().requestViewportChange({ x: -cx * zoom + width / 2, y: -cy * zoom + height / 2, zoom });
}
