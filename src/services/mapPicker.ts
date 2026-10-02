// ─── Map picker ──────────────────────────────────────────────
//
// Opens ZN's map picker over the reader. Map tiles and address search are
// ZN's own network calls; the plugin makes none.

import { getHostAPI } from '../hostAPI.ts';
import type { LatLng } from '../core/geo.ts';

let open = false;

/** True while ZN's picker is shown: the reader leaves the keyboard to it. */
export function isMapPickerOpen(): boolean {
  return open;
}

/** Whether this ZN version lends its picker to plugins. */
export function canPickOnMap(): boolean {
  return typeof getHostAPI().ui?.openGeoPicker === 'function';
}

/** `query` pre-fills ZN's search field; ZN searches only when the user asks. */
export async function pickOnMap(initial?: LatLng, query?: string): Promise<LatLng | null> {
  const ui = getHostAPI().ui;
  if (!ui) return null;
  open = true;
  try {
    return await ui.openGeoPicker(initial, query ? { query } : undefined);
  } finally {
    open = false;
  }
}
