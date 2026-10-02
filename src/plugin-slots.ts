// ─── MarkNeurone Slot Registration ───────────────────────────
//
// Registers all UI slots. Called once from plugin-external.ts
// (or plugin.ts in workspace mode) after hostAPI init.

import { getHostAPI } from './hostAPI.ts';
import { PLUGIN_ID, I18N_NS, MN_PLUGIN_VERSION } from './constants.ts';
import { MarkReaderModal } from './components/MarkReaderModal.tsx';
import { openReader, setReaderOpener, type ReaderTarget } from './readerLauncher.ts';
import { readableAssetsOfElements } from './services/documentAssets.ts';
import { exportAnnotations, importAnnotations, type ZipLike } from './services/transfer.ts';

export async function registerSlots(): Promise<void> {
  const api = getHostAPI();
  const React = api.React;
  const { useState: useReactState, useEffect: useReactEffect, useCallback: useReactCallback } = React;

  // ─── i18n ────────────────────────────────────────────────
  const locales = ['fr', 'en'] as const;
  const bundles = await Promise.all(
    locales.map(lang => import(`./locales/${lang}/mark.json`).then(m => [lang, m.default] as const)),
  );
  for (const [lang, bundle] of bundles) {
    api.i18n.addResourceBundle(lang, I18N_NS, bundle, true, true);
  }

  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });

  // ─── home:card ───────────────────────────────────────────
  api.registerPlugin('home:card', {
    id: PLUGIN_ID,
    name: 'MarkNeurone',
    description: t('card_description'),
    icon: 'Highlighter',
    version: MN_PLUGIN_VERSION,
    license: 'MIT',
    features: [],
    actions: [],
  }, PLUGIN_ID);

  // ─── app:global ──────────────────────────────────────────
  function MarkGlobalOverlay() {
    const [target, setTarget] = useReactState(null as ReaderTarget | null);
    const [minimized, setMinimized] = useReactState(false);
    const currentDossierId = api.stores.useDossierStore(
      (s: { currentDossier: { id: string } | null }) => s.currentDossier?.id ?? null,
    );

    useReactEffect(() => {
      setReaderOpener((next: ReaderTarget) => {
        setTarget(next);
        setMinimized(false);
      });
      return () => setReaderOpener(null);
    }, []);

    // The reader belongs to one dossier: leaving it closes the reader.
    useReactEffect(() => {
      if (target && currentDossierId !== target.dossierId) setTarget(null);
    }, [currentDossierId, target]);

    const onMinimize = useReactCallback(() => setMinimized(true), []);
    const onRestore = useReactCallback(() => setMinimized(false), []);
    const onClose = useReactCallback(() => setTarget(null), []);

    return target
      ? React.createElement(MarkReaderModal, {
          dossierId: target.dossierId,
          assetId: target.assetId,
          minimized,
          onMinimize,
          onRestore,
          onClose,
        })
      : null;
  }
  api.registerPlugin('app:global', MarkGlobalOverlay, PLUGIN_ID);

  // ─── export:hooks / import:hooks ─────────────────────────
  // annotations.json travels in the dossier ZIP, next to dossier.json.
  api.registerPlugin('export:hooks', {
    name: 'mark-neurone-annotations',
    pluginId: PLUGIN_ID,
    onExport: (zip: ZipLike, dossierId: string) => exportAnnotations(zip, dossierId),
  });
  api.registerPlugin('import:hooks', {
    name: 'mark-neurone-annotations',
    pluginId: PLUGIN_ID,
    onImport: async (zip: ZipLike, dossierId: string) => {
      try {
        const { orphans } = await importAnnotations(zip, dossierId);
        if (orphans > 0) api.toast.warning(t('import_orphans', { count: orphans }));
      } catch (err) {
        console.error('MarkNeurone: annotations import failed', err);
        api.toast.error(t('import_error'));
      }
    },
  });

  // ─── contextMenu:element ─────────────────────────────────
  // One document: the entry opens it. Several: ZN shows them as a submenu.
  // ZN replaces the entry label by a single child's label, so children are
  // only returned when there is an actual choice to make.
  api.registerPlugin('contextMenu:element', {
    id: 'mark-open-reader',
    get label() { return t('menu_read'); },
    icon: 'Highlighter',
    pluginId: PLUGIN_ID,
    visible: (ctx: { elementIds: string[] }) => readableAssetsOfElements(ctx.elementIds).length > 0,
    action: (ctx: { elementIds: string[]; dossierId: string }) => {
      const [first] = readableAssetsOfElements(ctx.elementIds);
      if (first) openReader({ dossierId: ctx.dossierId, assetId: first.id });
    },
    children: async (ctx: { elementIds: string[]; dossierId: string }) => {
      const assets = readableAssetsOfElements(ctx.elementIds);
      if (assets.length < 2) return [];
      return assets.map(asset => ({
        id: `mark-open-${asset.id}`,
        label: asset.filename,
        icon: 'FileText',
        action: () => openReader({ dossierId: ctx.dossierId, assetId: asset.id }),
      }));
    },
  });
}
