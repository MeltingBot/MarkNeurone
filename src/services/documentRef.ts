// ─── Reference of a document ─────────────────────────────────
//
// Stored with the dossier (pluginData `ref:<sha256>`), set by the user only.

import { getHostAPI } from '../hostAPI.ts';
import { cleanReference } from '../core/reference.ts';

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
