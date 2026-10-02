// ─── Reader preferences per document ─────────────────────────
//
// Suggestions are off when a document is first read (analysis, section 3:
// a first reading without pre-highlighting avoids confirmation bias), and
// stay as the user leaves them for that document.

import { getHostAPI } from '../hostAPI.ts';

export interface ViewPrefs {
  suggestions: boolean;
}

const key = (hash: string) => `view:${hash}`;

export async function loadViewPrefs(dossierId: string, hash: string): Promise<ViewPrefs> {
  const stored = await getHostAPI().pluginData.get(dossierId, key(hash));
  return { suggestions: !!(stored && typeof stored === 'object' && stored.suggestions) };
}

export async function saveViewPrefs(dossierId: string, hash: string, prefs: ViewPrefs): Promise<void> {
  await getHostAPI().pluginData.set(dossierId, key(hash), prefs);
}
