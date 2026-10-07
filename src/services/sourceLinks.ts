// ─── Anchor links in ZN Source fields ────────────────────────
//
// ZN 2.62 shows `[pv.pdf p.3](mn:1a2b3c4d)` as a link when a plugin
// registers the scheme (slot `source:scheme`): a click opens the reader on
// the passage. After a merge, the source of the element keeps the link of
// every passage, each one clickable.

import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS, PLUGIN_ID } from '../constants.ts';
import { ANCHOR_SCHEME } from '../core/anchors.ts';
import { openReader } from '../readerLauncher.ts';
import { findByAnchor, isDossierLoaded, loadDossier } from './annotationStore.ts';
import { findAssetByHash } from './documentAssets.ts';

interface SchemeContext {
  dossierId: string;
}

function preload(dossierId: string): void {
  loadDossier(dossierId).catch((err: unknown) => console.error('MarkNeurone: cannot load highlights', err));
}

function target(value: string, dossierId: string) {
  const annotation = findByAnchor(dossierId, value);
  const asset = annotation ? findAssetByHash(annotation.documentHash) : undefined;
  return annotation && asset ? { annotation, asset } : null;
}

export function registerSourceScheme(): void {
  const api = getHostAPI();
  // Before ZN 2.62 the slot does not exist: the anchors stay plain text.
  if (!api.features?.sourceSchemes) return;

  api.registerPlugin('source:scheme', {
    scheme: ANCHOR_SCHEME,
    pluginId: PLUGIN_ID,
    // Synchronous: until the dossier's highlights are loaded, the link is
    // shown as found, and `open` checks it.
    resolve: (value: string, ctx: SchemeContext) => {
      if (!isDossierLoaded(ctx.dossierId)) {
        preload(ctx.dossierId);
        return true;
      }
      return target(value, ctx.dossierId) !== null;
    },
    open: async (value: string, ctx: SchemeContext) => {
      await loadDossier(ctx.dossierId);
      const found = target(value, ctx.dossierId);
      if (!found) {
        api.toast.warning(api.i18n.t('source_link_missing', { ns: I18N_NS }));
        return;
      }
      openReader({ dossierId: ctx.dossierId, assetId: found.asset.id, annotationId: found.annotation.id });
    },
  }, PLUGIN_ID);

  // Loaded ahead, so that links are resolved at their first display.
  api.events.on('dossier:opened', (event) => preload(event.dossierId));
  const current = api.stores.useDossierStore.getState().currentDossier?.id;
  if (current) preload(current);
}
