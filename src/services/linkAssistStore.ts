// ─── Dismissed co-occurrence marks ───────────────────────────
//
// Pairs of elements the user asked not to be offered again as a possible
// link in a document (pluginData `cooc-dismissed:<sha256>`).

import { getHostAPI } from '../hostAPI.ts';

const key = (hash: string) => `cooc-dismissed:${hash}`;

export async function loadDismissedPairs(dossierId: string, hash: string): Promise<Set<string>> {
  const stored = await getHostAPI().pluginData.get(dossierId, key(hash));
  return new Set(Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : []);
}

export async function saveDismissedPairs(dossierId: string, hash: string, pairs: Set<string>): Promise<void> {
  await getHostAPI().pluginData.set(dossierId, key(hash), [...pairs]);
}
