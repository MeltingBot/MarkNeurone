// ─── Annotation store ────────────────────────────────────────
//
// Annotations of one dossier, grouped by document hash and persisted in
// ZN's pluginData (`ann:<sha256>`), plus an index of annotated documents
// (`ann-index`) used by the ZIP export. Small pub/sub so React views can
// follow changes with useSyncExternalStore.

import { getHostAPI } from '../hostAPI.ts';
import type { Annotation } from '../core/model.ts';

const INDEX_KEY = 'ann-index';
const docKey = (hash: string) => `ann:${hash}`;
const cacheKey = (dossierId: string, hash: string) => `${dossierId}|${hash}`;

const cache = new Map<string, Annotation[]>();
const loading = new Map<string, Promise<Annotation[]>>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version++;
  listeners.forEach((fn) => fn());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

const EMPTY: Annotation[] = [];

/** Cached annotations of a document; empty until `loadAnnotations` resolved. */
export function getAnnotations(dossierId: string, hash: string): Annotation[] {
  return cache.get(cacheKey(dossierId, hash)) ?? EMPTY;
}

export function loadAnnotations(dossierId: string, hash: string): Promise<Annotation[]> {
  const key = cacheKey(dossierId, hash);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  let pending = loading.get(key);
  if (!pending) {
    pending = getHostAPI()
      .pluginData.get(dossierId, docKey(hash))
      .then((stored: Annotation[] | undefined) => {
        const list = Array.isArray(stored) ? stored : [];
        cache.set(key, list);
        loading.delete(key);
        notify();
        return list;
      })
      .catch((err: unknown) => {
        loading.delete(key);
        throw err;
      });
    loading.set(key, pending);
  }
  return pending;
}

async function persist(dossierId: string, hash: string, list: Annotation[]): Promise<void> {
  const api = getHostAPI();
  await api.pluginData.set(dossierId, docKey(hash), list);
  const index: string[] = (await api.pluginData.get(dossierId, INDEX_KEY)) ?? [];
  if (!index.includes(hash)) await api.pluginData.set(dossierId, INDEX_KEY, [...index, hash]);
}

/** Inserts or replaces an annotation, then persists the document's list. */
export async function saveAnnotation(dossierId: string, annotation: Annotation): Promise<void> {
  const current = await loadAnnotations(dossierId, annotation.documentHash);
  const next = current.some((a) => a.id === annotation.id)
    ? current.map((a) => (a.id === annotation.id ? annotation : a))
    : [...current, annotation];
  cache.set(cacheKey(dossierId, annotation.documentHash), next);
  notify();
  await persist(dossierId, annotation.documentHash, next);
}

/** Hashes of the dossier's annotated documents. */
export async function annotatedDocuments(dossierId: string): Promise<string[]> {
  const index = await getHostAPI().pluginData.get(dossierId, INDEX_KEY);
  return Array.isArray(index) ? index : [];
}

/** Stored annotations of a document, bypassing the cache (export, import). */
export async function readDocument(dossierId: string, hash: string): Promise<Annotation[]> {
  const stored = await getHostAPI().pluginData.get(dossierId, docKey(hash));
  return Array.isArray(stored) ? stored : [];
}

/** Replaces a document's annotations, and refreshes any open view of it. */
export async function writeDocument(dossierId: string, hash: string, list: Annotation[]): Promise<void> {
  await persist(dossierId, hash, list);
  if (cache.has(cacheKey(dossierId, hash))) {
    cache.set(cacheKey(dossierId, hash), list);
    notify();
  }
}

export async function removeAnnotation(dossierId: string, hash: string, annotationId: string): Promise<void> {
  const current = await loadAnnotations(dossierId, hash);
  const next = current.filter((a) => a.id !== annotationId);
  cache.set(cacheKey(dossierId, hash), next);
  notify();
  await persist(dossierId, hash, next);
}

/** Removes all annotations of a document (deleted document, on request). */
export async function deleteDocument(dossierId: string, hash: string): Promise<void> {
  const api = getHostAPI();
  await api.pluginData.remove(dossierId, docKey(hash));
  const index = await annotatedDocuments(dossierId);
  if (index.includes(hash)) await api.pluginData.set(dossierId, INDEX_KEY, index.filter((h) => h !== hash));
  cache.delete(cacheKey(dossierId, hash));
  notify();
}
