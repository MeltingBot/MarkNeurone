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

/** Part of the canvas on screen, in canvas units. */
export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * First free spot on a spiral around the centre of the visible canvas. With
 * `bounds`, the spot stays on screen: zoomed in, the nearest free spot may
 * lie outside the view, and a node appearing off screen looks like nothing
 * happened (reader in a window of its own, canvas watched while reading).
 * A view with no free spot gets the least crowded spot of the view.
 */
export function freePosition(
  center: { x: number; y: number },
  occupied: { x: number; y: number }[],
  bounds?: Bounds,
): { x: number; y: number } {
  const free = (p: { x: number; y: number }) =>
    occupied.every((o) => Math.abs(o.x - p.x) >= NODE_W || Math.abs(o.y - p.y) >= NODE_H);
  if (free(center)) return center;
  if (!bounds) {
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
  // A node is placed by its top-left corner: room for its body inside the view.
  const inView = (p: { x: number; y: number }) =>
    p.x >= bounds.x0 && p.y >= bounds.y0 && p.x + NODE_W * 0.85 <= bounds.x1 && p.y + NODE_H * 0.6 <= bounds.y1;
  const candidates: { x: number; y: number }[] = [];
  for (let ring = 1; ring <= 40; ring++) {
    const steps = ring * 8;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const p = { x: center.x + (Math.cos(angle) * ring * NODE_W) / 2, y: center.y + (Math.sin(angle) * ring * NODE_H) / 2 };
      if (!inView(p)) continue;
      if (free(p)) return p;
      candidates.push(p);
    }
  }
  // Crowded view: the spot farthest from its nearest node.
  const room = (p: { x: number; y: number }) =>
    Math.min(...occupied.map((o) => Math.max(Math.abs(o.x - p.x) / NODE_W, Math.abs(o.y - p.y) / NODE_H)));
  return candidates.reduce((best, p) => (room(p) > room(best) ? p : best), center);
}

/** Near the centre of the visible canvas, away from existing nodes, on screen. ZN keeps the canvas size private. */
function placementPosition(): { x: number; y: number } {
  const { viewport } = getHostAPI().stores.useViewStore.getState() as {
    viewport: { x: number; y: number; zoom: number };
  };
  const pane = document.querySelector('.react-flow');
  const width = pane?.clientWidth || window.innerWidth - 350;
  const height = pane?.clientHeight || window.innerHeight;
  const bounds = {
    x0: -viewport.x / viewport.zoom,
    y0: -viewport.y / viewport.zoom,
    x1: (-viewport.x + width) / viewport.zoom,
    y1: (-viewport.y + height) / viewport.zoom,
  };
  const center = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
  return freePosition(center, store().elements.map((e: ZnElement) => e.position), bounds);
}

export async function createElement(label: string, tags: string[], anchor: string, near?: { x: number; y: number }): Promise<ZnElement> {
  const position = near ? freePosition(near, store().elements.map((e: ZnElement) => e.position)) : placementPosition();
  const el = await store().createElement(label, position, { tags, source: anchor });
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

/** A picture framed in a document goes onto the element, as a file ZN shows on it. */
export async function attachImage(elementId: string, file: File): Promise<void> {
  if (!getElement(elementId)) throw new Error('element not found');
  await store().addAsset(elementId, file);
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
/** A property of one of the element's events; the anchor goes on the event and the element. */
export async function addEventProperty(elementId: string, eventId: string, property: ZnProperty, anchor: string): Promise<void> {
  const el = getElement(elementId);
  const ev = el?.events.find((e) => e.id === eventId);
  if (!el || !ev) throw new Error('event not found');
  await store().updateElement(elementId, {
    events: el.events.map((e) => (e.id === eventId ? { ...e, properties: [...(e.properties ?? []), property], source: appendAnchor(e.source, anchor) } : e)),
    source: appendAnchor(el.source, anchor),
  });
}

/** Anchor on one of the element's events, and on the element, as for a property of the event. */
export async function attachEventAnchor(elementId: string, eventId: string, anchor: string): Promise<void> {
  const el = getElement(elementId);
  if (!el?.events.some((e) => e.id === eventId)) throw new Error('event not found');
  await store().updateElement(elementId, {
    events: el.events.map((e) => (e.id === eventId ? { ...e, source: appendAnchor(e.source, anchor) } : e)),
    source: appendAnchor(el.source, anchor),
  });
}

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

/** ZN removes their links with them. */
export async function deleteElements(ids: string[]): Promise<void> {
  if (ids.length) await store().deleteElements(ids);
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

/**
 * Removes the anchor of an annotation from an element and from its events
 * (event, property of an event), if the element still exists.
 */
export async function detachAnchor(elementId: string, annotationId: string): Promise<void> {
  const el = getElement(elementId);
  if (!el) return;
  const changes: Partial<Pick<ZnElement, 'source' | 'events'>> = {};
  const source = removeAnchor(el.source, annotationId);
  if (source !== el.source) changes.source = source;
  let eventsChanged = false;
  const events = el.events.map((e) => {
    if (!e.source) return e;
    const next = removeAnchor(e.source, annotationId);
    if (next === e.source) return e;
    eventsChanged = true;
    return { ...e, source: next };
  });
  if (eventsChanged) changes.events = events;
  if (Object.keys(changes).length) await store().updateElement(elementId, changes);
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
