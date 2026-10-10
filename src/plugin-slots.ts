// ─── MarkNeurone Slot Registration ───────────────────────────
//
// Registers all UI slots. Called once from plugin-external.ts
// (or plugin.ts in workspace mode) after hostAPI init.

import { getHostAPI } from './hostAPI.ts';
import { PLUGIN_ID, I18N_NS, MN_PLUGIN_VERSION } from './constants.ts';
import { MarkReaderModal } from './components/MarkReaderModal.tsx';
import { MarkerPanel } from './components/MarkerPanel.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { loadSettings, openSettings, setSettingsOpener } from './services/settingsStore.ts';
import { openReader, setReaderOpener, type ReaderTarget } from './readerLauncher.ts';
import { readableAssetsOfElements } from './services/documentAssets.ts';
import { exportAnnotations, importAnnotations, type ZipLike } from './services/transfer.ts';
import { onDocumentDeleted } from './services/documentData.ts';
import { registerSourceScheme } from './services/sourceLinks.ts';
import { shareAnnotations } from './services/annotationStore.ts';
import { shareReferences } from './services/documentRef.ts';
import { ANCHORS_SERVICE, markAnchorsV1 } from './services/anchorService.ts';

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

  // ─── Host version ────────────────────────────────────────
  // Annotations are shared with the dossier's members (ZN 2.63 and later).
  if (!api.features?.sharedPluginData) {
    api.toast.error(t('host_too_old'));
    return;
  }
  // Before any write: the other members of a shared dossier receive them.
  shareAnnotations();
  shareReferences();

  // ─── Services for other plugins (ZN 2.64 and later) ─────
  // OneNeurone asks for the passage of what it extracted.
  if (api.features?.pluginServices && api.pluginServices) {
    api.pluginServices.provide(ANCHORS_SERVICE, markAnchorsV1);
  }

  // Settings apply to every dossier; defaults stay in use if they cannot be read.
  await loadSettings().catch((err: unknown) => console.error('MarkNeurone: cannot load settings', err));

  // ─── home:card ───────────────────────────────────────────
  api.registerPlugin('home:card', {
    id: PLUGIN_ID,
    name: 'MarkNeurone',
    description: t('card_description'),
    icon: 'Highlighter',
    version: MN_PLUGIN_VERSION,
    license: 'MIT',
    docUrl: 'https://mark.zeroneurone.com',
    features: [],
    onConfigure: () => openSettings(),
    actions: [{
      label: 'GitHub',
      icon: 'Github',
      onClick: () => { window.open('https://github.com/MeltingBot/MarkNeurone', '_blank', 'noopener,noreferrer'); },
    }],
  }, PLUGIN_ID);

  // ─── app:global ──────────────────────────────────────────
  function MarkGlobalOverlay() {
    const [target, setTarget] = useReactState(null as ReaderTarget | null);
    const [minimized, setMinimized] = useReactState(false);
    const [settingsOpen, setSettingsOpen] = useReactState(false);
    const currentDossierId = api.stores.useDossierStore(
      (s: { currentDossier: { id: string } | null }) => s.currentDossier?.id ?? null,
    );

    useReactEffect(() => {
      setReaderOpener((next: ReaderTarget) => {
        setTarget(next);
        setMinimized(false);
      });
      setSettingsOpener(setSettingsOpen);
      return () => {
        setReaderOpener(null);
        setSettingsOpener(null);
      };
    }, []);

    // The reader belongs to one dossier: leaving it closes the reader.
    useReactEffect(() => {
      if (target && currentDossierId !== target.dossierId) setTarget(null);
    }, [currentDossierId, target]);

    const onMinimize = useReactCallback(() => setMinimized(true), []);
    const onRestore = useReactCallback(() => setMinimized(false), []);
    const onClose = useReactCallback(() => setTarget(null), []);

    const reader = target
      ? React.createElement(MarkReaderModal, {
          dossierId: target.dossierId,
          assetId: target.assetId,
          // A new target object each time: the same passage can be shown again.
          focus: target.annotationId ? { annotationId: target.annotationId, target } : null,
          minimized,
          onMinimize,
          onRestore,
          onClose,
        })
      : null;
    return React.createElement(React.Fragment, null,
      reader,
      settingsOpen ? React.createElement(SettingsModal, { onClose: () => setSettingsOpen(false) }) : null);
  }
  api.registerPlugin('app:global', MarkGlobalOverlay, PLUGIN_ID);

  // ─── Deleted documents ───────────────────────────────────
  // Their recognized text is deleted with them; annotations are kept, and the
  // user is told (ZN emits the event after the deletion, never before).
  api.events.on('asset:deleted', (event) => {
    if (!event.entityId) return;
    onDocumentDeleted(event.dossierId, event.entityId)
      .then((deleted) => {
        if (deleted && deleted.annotations > 0) {
          api.toast.warning(t('document_deleted_annotations', { name: deleted.filename, count: deleted.annotations }));
        }
      })
      .catch((err: unknown) => console.error('MarkNeurone: cannot clean up a deleted document', err));
  });

  // ─── source:scheme ───────────────────────────────────────
  // Anchors in Source fields open the reader on their passage.
  registerSourceScheme();

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

  // ─── panel:right ─────────────────────────────────────────
  // "Marqueur" tab: passages of the selected element in every document.
  api.registerPlugin('panel:right', {
    id: 'mark-neurone-marker',
    get label() { return t('marker_tab'); },
    icon: 'Highlighter',
    pluginId: PLUGIN_ID,
    component: MarkerPanel,
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
