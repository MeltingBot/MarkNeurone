// ─── Reference of a document ─────────────────────────────────
//
// Stored with the dossier (pluginData `ref:<sha256>`), set by the user only.

import { getHostAPI } from '../hostAPI.ts';
import { cleanReference } from '../core/reference.ts';
import { isReadable, type DocumentAsset } from './documentAssets.ts';

const key = (hash: string) => `ref:${hash}`;

// Views showing references (reader title, Marqueur tab) follow changes.
const listeners = new Set<() => void>();
let version = 0;

export function subscribeReferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReferencesVersion(): number {
  return version;
}

/** The document's reference, or '' when none was given. */
export async function loadReference(dossierId: string, hash: string): Promise<string> {
  return cleanReference(await getHostAPI().pluginData.get(dossierId, key(hash)));
}

export async function saveReference(dossierId: string, hash: string, reference: string): Promise<void> {
  const value = cleanReference(reference);
  if (value) await getHostAPI().pluginData.set(dossierId, key(hash), value);
  else await getHostAPI().pluginData.remove(dossierId, key(hash));
  version++;
  listeners.forEach((fn) => fn());
}

/**
 * References of the readable documents each element carries (the element
 * ZN creates for a dropped file), by element id. Documents without a
 * reference are left out.
 */
export async function referencesOfElements(
  dossierId: string,
  elements: { id: string; assetIds?: string[] }[],
  assets: DocumentAsset[],
): Promise<Map<string, string[]>> {
  const readable = new Map(assets.filter(isReadable).map((a) => [a.id, a]));
  const hashes = [...new Set([...readable.values()].map((a) => a.hash))];
  const refs = new Map(await Promise.all(hashes.map(async (hash) => [hash, await loadReference(dossierId, hash)] as const)));
  const out = new Map<string, string[]>();
  for (const el of elements) {
    const found = (el.assetIds ?? []).map((id) => refs.get(readable.get(id)?.hash ?? '')).filter((r): r is string => !!r);
    if (found.length) out.set(el.id, [...new Set(found)]);
  }
  return out;
}
