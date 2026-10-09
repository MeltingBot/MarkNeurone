// ─── Annotation store ────────────────────────────────────────
//
// Annotations of one dossier, grouped by document hash and persisted in
// ZN's pluginData. Small pub/sub so React views can follow changes with
// useSyncExternalStore.
//
// Two storage formats:
// - ZN 2.63 and later (`features.sharedPluginData`): one key per annotation,
//   `annotation:<sha256>:<id>`, shared with the other members of the dossier.
//   Conflicts are resolved key by key (last write wins), so two analysts
//   annotating the same document do not overwrite each other.
// - Before: one array per document (`ann:<sha256>`) and an index of annotated
//   documents (`ann-index`), kept on the workstation. A dossier stored this
//   way is converted to the first format the first time it is read.

import { getHostAPI } from '../hostAPI.ts';
import type { Annotation } from '../core/model.ts';
import { shortId } from '../core/anchors.ts';

const cacheKey = (dossierId: string, hash: string) => `${dossierId}|${hash}`;

const cache = new Map<string, Annotation[]>();
const loading = new Map<string, Promise<Annotation[]>>();
// Bumped when a key's stored annotations change under a pending load.
const generations = new Map<string, number>();
// Reads started per key, to tell whether one overlapped a write.
const reads = new Map<string, number>();
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

// ─── Storage formats ─────────────────────────────────────────

/** Prefix of the shared annotation keys. `ann:` stays the one of the former arrays. */
export const SHARED_PREFIX = 'annotation:';
const sharedDocPrefix = (hash: string) => `${SHARED_PREFIX}${hash}:`;
const sharedKey = (hash: string, id: string) => `${sharedDocPrefix(hash)}${id}`;

const LEGACY_INDEX_KEY = 'ann-index';
const LEGACY_PREFIX = 'ann:';
const legacyKey = (hash: string) => `${LEGACY_PREFIX}${hash}`;

/** Annotations stored one per key, shared with the dossier's members. */
export function isShared(): boolean {
  const api = getHostAPI();
  return !!api.features?.sharedPluginData && typeof api.pluginData.list === 'function';
}

/** Document hash of a shared annotation key, or null. */
export function hashOfKey(key: string): string | null {
  if (!key.startsWith(SHARED_PREFIX)) return null;
  const rest = key.slice(SHARED_PREFIX.length);
  const end = rest.indexOf(':');
  return end > 0 ? rest.slice(0, end) : null;
}

/** Same order for every member: creation, then id. */
function ordered(list: Annotation[]): Annotation[] {
  return [...list].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id));
}

function isAnnotation(value: unknown): value is Annotation {
  return !!value && typeof (value as Annotation).id === 'string';
}

// Conversion of the former arrays, once per dossier and session. It can run
// again without harm, here or on another member's workstation: annotations
// keep their id, so their keys are the same, and an existing key is never
// overwritten (it may have been changed since).
const migrations = new Map<string, Promise<void>>();

async function migrate(dossierId: string): Promise<void> {
  const pd = getHostAPI().pluginData;
  const arrays = (await pd.list!(dossierId, LEGACY_PREFIX)).filter((e) => Array.isArray(e.value));
  if (arrays.length) {
    const existing = new Set((await pd.list!(dossierId, SHARED_PREFIX)).map((e) => e.key));
    for (const { key, value } of arrays) {
      const hash = key.slice(LEGACY_PREFIX.length);
      for (const a of value as unknown[]) {
        if (!isAnnotation(a)) continue;
        const k = sharedKey(hash, a.id);
        if (!existing.has(k)) await pd.set(dossierId, k, a);
      }
    }
    // Only once every annotation has its own key.
    for (const { key } of arrays) await pd.remove(dossierId, key);
  }
  if ((await pd.get(dossierId, LEGACY_INDEX_KEY)) !== undefined) await pd.remove(dossierId, LEGACY_INDEX_KEY);
}

function ensureMigrated(dossierId: string): Promise<void> {
  let pending = migrations.get(dossierId);
  if (!pending) {
    pending = migrate(dossierId).catch((err: unknown) => {
      migrations.delete(dossierId);
      throw err;
    });
    migrations.set(dossierId, pending);
  }
  return pending;
}

/** Stored annotations of a document, in either format. */
async function readStored(dossierId: string, hash: string): Promise<Annotation[]> {
  const pd = getHostAPI().pluginData;
  if (isShared()) {
    await ensureMigrated(dossierId);
    const entries = await pd.list!(dossierId, sharedDocPrefix(hash));
    return ordered(entries.map((e) => e.value).filter(isAnnotation));
  }
  const stored = await pd.get(dossierId, legacyKey(hash));
  return Array.isArray(stored) ? stored : [];
}

/** Stored annotations of every document of a dossier, by hash (shared format). */
async function readAllShared(dossierId: string): Promise<Map<string, Annotation[]>> {
  await ensureMigrated(dossierId);
  const byHash = new Map<string, Annotation[]>();
  for (const { key, value } of await getHostAPI().pluginData.list!(dossierId, SHARED_PREFIX)) {
    const hash = hashOfKey(key);
    if (!hash || !isAnnotation(value)) continue;
    const list = byHash.get(hash);
    if (list) list.push(value);
    else byHash.set(hash, [value]);
  }
  for (const [hash, list] of byHash) byHash.set(hash, ordered(list));
  return byHash;
}

/** Legacy format: the document's array, then the index. */
async function persistLegacy(dossierId: string, hash: string, list: Annotation[]): Promise<void> {
  const pd = getHostAPI().pluginData;
  await pd.set(dossierId, legacyKey(hash), list);
  const index: string[] = (await pd.get(dossierId, LEGACY_INDEX_KEY)) ?? [];
  if (!index.includes(hash)) await pd.set(dossierId, LEGACY_INDEX_KEY, [...index, hash]);
}

// ─── Cache ───────────────────────────────────────────────────

/** Cached annotations of a document; empty until `loadAnnotations` resolved. */
export function getAnnotations(dossierId: string, hash: string): Annotation[] {
  return cache.get(cacheKey(dossierId, hash)) ?? EMPTY;
}

/** Reads a document into the cache. A read overtaken by a newer change is read again. */
function fetchIntoCache(dossierId: string, hash: string): Promise<Annotation[]> {
  const key = cacheKey(dossierId, hash);
  const generation = generations.get(key) ?? 0;
  reads.set(key, (reads.get(key) ?? 0) + 1);
  const pending = readStored(dossierId, hash)
    .then((list) => {
      if ((generations.get(key) ?? 0) !== generation) return fetchIntoCache(dossierId, hash);
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
  return pending;
}

/** Has the stored annotations read again after `persist`, if a read overlapped it. */
async function writing(dossierId: string, hash: string, persist: () => Promise<void>): Promise<void> {
  const key = cacheKey(dossierId, hash);
  const busy = loading.has(key);
  const started = reads.get(key) ?? 0;
  await persist();
  if (!busy && (reads.get(key) ?? 0) === started) return;
  if (loading.has(key)) generations.set(key, (generations.get(key) ?? 0) + 1);
  else await fetchIntoCache(dossierId, hash);
}

export function loadAnnotations(dossierId: string, hash: string): Promise<Annotation[]> {
  const key = cacheKey(dossierId, hash);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  return loading.get(key) ?? fetchIntoCache(dossierId, hash);
}

/** Inserts or replaces an annotation, then persists it. */
export async function saveAnnotation(dossierId: string, annotation: Annotation): Promise<void> {
  const hash = annotation.documentHash;
  const current = await loadAnnotations(dossierId, hash);
  const next = current.some((a) => a.id === annotation.id)
    ? current.map((a) => (a.id === annotation.id ? annotation : a))
    : [...current, annotation];
  cache.set(cacheKey(dossierId, hash), next);
  notify();
  await writing(dossierId, hash, () =>
    isShared()
      ? getHostAPI().pluginData.set(dossierId, sharedKey(hash, annotation.id), annotation)
      : persistLegacy(dossierId, hash, next),
  );
}

/** Hashes of the dossier's annotated documents. */
export async function annotatedDocuments(dossierId: string): Promise<string[]> {
  if (isShared()) {
    if (loadedDossiers.has(dossierId)) {
      const prefix = `${dossierId}|`;
      return [...cache].filter(([key, list]) => key.startsWith(prefix) && list.length).map(([key]) => key.slice(prefix.length));
    }
    return [...(await readAllShared(dossierId)).keys()];
  }
  const index = await getHostAPI().pluginData.get(dossierId, LEGACY_INDEX_KEY);
  return Array.isArray(index) ? index : [];
}

/** Stored annotations of a document, bypassing the cache (export, import). */
export function readDocument(dossierId: string, hash: string): Promise<Annotation[]> {
  return readStored(dossierId, hash);
}

/**
 * Replaces a document's annotations, and refreshes any view of it. Shared
 * format: only the annotations that changed are written, and those no longer
 * in the list are removed, so that a member does not overwrite another one's
 * changes with an unchanged copy.
 */
export async function writeDocument(dossierId: string, hash: string, list: Annotation[]): Promise<void> {
  cache.set(cacheKey(dossierId, hash), list);
  notify();
  await writing(dossierId, hash, async () => {
    if (!isShared()) return persistLegacy(dossierId, hash, list);
    const pd = getHostAPI().pluginData;
    const stored = new Map((await readStored(dossierId, hash)).map((a) => [a.id, JSON.stringify(a)]));
    const kept = new Set<string>();
    for (const a of list) {
      kept.add(a.id);
      if (stored.get(a.id) !== JSON.stringify(a)) await pd.set(dossierId, sharedKey(hash, a.id), a);
    }
    for (const id of stored.keys()) if (!kept.has(id)) await pd.remove(dossierId, sharedKey(hash, id));
  });
}

export async function removeAnnotation(dossierId: string, hash: string, annotationId: string): Promise<void> {
  const current = await loadAnnotations(dossierId, hash);
  const next = current.filter((a) => a.id !== annotationId);
  cache.set(cacheKey(dossierId, hash), next);
  notify();
  await writing(dossierId, hash, () =>
    isShared() ? getHostAPI().pluginData.remove(dossierId, sharedKey(hash, annotationId)) : persistLegacy(dossierId, hash, next),
  );
}

/** Removes all annotations of a document (deleted document, on request). */
export async function deleteDocument(dossierId: string, hash: string): Promise<void> {
  const pd = getHostAPI().pluginData;
  if (isShared()) {
    for (const a of await readStored(dossierId, hash)) await pd.remove(dossierId, sharedKey(hash, a.id));
  } else {
    await pd.remove(dossierId, legacyKey(hash));
    const index = await annotatedDocuments(dossierId);
    if (index.includes(hash)) await pd.set(dossierId, LEGACY_INDEX_KEY, index.filter((h) => h !== hash));
  }
  cache.delete(cacheKey(dossierId, hash));
  notify();
}

// ─── Changes made by other members ───────────────────────────
// ZN reports each shared key a member changed (one call per key, and many at
// once when a dossier is opened). Documents are read again together, shortly
// after, and only if a view or the anchor lookup holds them.

const REFRESH_DELAY_MS = 50;
const dirty = new Set<string>();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function refresh(): void {
  refreshTimer = null;
  const keys = [...dirty];
  dirty.clear();
  for (const key of keys) {
    const sep = key.indexOf('|');
    const dossierId = key.slice(0, sep);
    const hash = key.slice(sep + 1);
    if (!cache.has(key) && !loading.has(key) && !loadedDossiers.has(dossierId)) continue;
    // A load under way would bring back what was stored before the change.
    if (loading.has(key)) generations.set(key, (generations.get(key) ?? 0) + 1);
    else fetchIntoCache(dossierId, hash).catch((err: unknown) => console.error('MarkNeurone: cannot reload highlights', err));
  }
}

/** A member changed `key` in the dossier's shared data (Dexie is already up to date). */
export function onRemoteChange(change: { dossierId: string; key: string }): void {
  const hash = hashOfKey(change.key);
  if (!hash) return;
  dirty.add(cacheKey(change.dossierId, hash));
  if (!refreshTimer) refreshTimer = setTimeout(refresh, REFRESH_DELAY_MS);
}

/** Shares the annotations with the dossier's members (ZN 2.63 and later). Called at registration. */
export function shareAnnotations(): void {
  if (!isShared()) return;
  const pd = getHostAPI().pluginData;
  pd.shareKeys?.([SHARED_PREFIX]);
  pd.onRemoteChange?.(onRemoteChange);
}

// ─── Lookup by anchor ────────────────────────────────────────
// Source links (`[pv.pdf p.3](mn:1a2b3c4d)`) are resolved synchronously, on
// every render of a Source field: all documents of the dossier are loaded
// once, then looked up in a map rebuilt when the cache changes.

const dossierLoads = new Map<string, Promise<void>>();
const loadedDossiers = new Set<string>();
let byAnchor: { version: number; map: Map<string, Annotation> } | null = null;

/** Loads the annotations of every annotated document of a dossier. */
export function loadDossier(dossierId: string): Promise<void> {
  let pending = dossierLoads.get(dossierId);
  if (!pending) {
    pending = (isShared() ? loadAllShared(dossierId) : loadAllLegacy(dossierId))
      .then(() => {
        loadedDossiers.add(dossierId);
      })
      .catch((err: unknown) => {
        dossierLoads.delete(dossierId);
        throw err;
      });
    dossierLoads.set(dossierId, pending);
  }
  return pending;
}

async function loadAllLegacy(dossierId: string): Promise<void> {
  const hashes = await annotatedDocuments(dossierId);
  await Promise.all(hashes.map((hash) => loadAnnotations(dossierId, hash)));
}

/** One read for the whole dossier; documents already cached are kept as they are. */
async function loadAllShared(dossierId: string): Promise<void> {
  const byHash = await readAllShared(dossierId);
  let added = false;
  for (const [hash, list] of byHash) {
    const key = cacheKey(dossierId, hash);
    if (cache.has(key) || loading.has(key)) continue;
    cache.set(key, list);
    added = true;
  }
  if (added) notify();
}

export function isDossierLoaded(dossierId: string): boolean {
  return loadedDossiers.has(dossierId);
}

/** Annotation of a dossier whose anchor carries this short id. */
export function findByAnchor(dossierId: string, anchorId: string): Annotation | undefined {
  if (byAnchor?.version !== version) {
    const map = new Map<string, Annotation>();
    for (const [key, list] of cache) {
      const dossier = key.slice(0, key.indexOf('|'));
      for (const a of list) map.set(`${dossier}|${shortId(a.id)}`, a);
    }
    byAnchor = { version, map };
  }
  return byAnchor.map.get(`${dossierId}|${anchorId.toLowerCase()}`);
}

/** Forgets every cached state (tests). */
export function resetAnnotationStore(): void {
  cache.clear();
  loading.clear();
  generations.clear();
  reads.clear();
  migrations.clear();
  dirty.clear();
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  dossierLoads.clear();
  loadedDossiers.clear();
  byAnchor = null;
}
