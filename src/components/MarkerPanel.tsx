// ─── "Marqueur" tab of ZN's side panel ───────────────────────
//
// Passages of the element (or link) selected on the canvas, in every
// document of the dossier, grouped by document. A click opens the document
// on the passage.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { Annotation } from '../core/model.ts';
import { annotatedDocuments, getAnnotations, getVersion, loadAnnotations, subscribe } from '../services/annotationStore.ts';
import { concernedElements } from '../services/qualify.ts';
import { isPdf, type DocumentAsset } from '../services/documentAssets.ts';
import { openReader } from '../readerLauncher.ts';
import * as S from './znStyles.ts';

const NO_ASSETS: DocumentAsset[] = [];

export function MarkerPanel({ dossierId }: { dossierId: string }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const { Highlighter, Tag, Calendar, MapPin, Link2 } = api.icons;

  const version = React.useSyncExternalStore(subscribe, getVersion);
  const [hashes, setHashes] = React.useState<string[]>([]);
  // The index of annotated documents grows as documents are read.
  React.useEffect(() => {
    let cancelled = false;
    annotatedDocuments(dossierId)
      .then(async (list) => {
        await Promise.all(list.map((hash) => loadAnnotations(dossierId, hash)));
        if (!cancelled) setHashes(list);
      })
      .catch((err: unknown) => console.error('MarkNeurone: cannot load passages', err));
    return () => {
      cancelled = true;
    };
  }, [dossierId, version]);

  const selectedElements: Set<string> = api.stores.useSelectionStore((s: { selectedElementIds: Set<string> }) => s.selectedElementIds);
  const selectedLinks: Set<string> = api.stores.useSelectionStore((s: { selectedLinkIds: Set<string> }) => s.selectedLinkIds);
  const assets: DocumentAsset[] = api.stores.useDossierStore((s: { assets: DocumentAsset[] }) => s.assets ?? NO_ASSETS);

  const groups = React.useMemo(() => {
    const out: { asset: DocumentAsset; items: Annotation[] }[] = [];
    for (const hash of hashes) {
      const asset = assets.find((a) => a.hash === hash);
      if (!asset) continue;
      const items = getAnnotations(dossierId, hash)
        .filter((a) => a.status !== 'rejected' && a.kind !== 'suggestion')
        .filter((a) =>
          a.kind === 'link'
            ? (!!a.targetId && selectedLinks.has(a.targetId)) || concernedElements(a).some((id) => selectedElements.has(id))
            : concernedElements(a).some((id) => selectedElements.has(id)),
        )
        .sort((a, b) => a.page - b.page || (a.textRange?.[0] ?? 0) - (b.textRange?.[0] ?? 0));
      if (items.length) out.push({ asset, items });
    }
    return out.sort((a, b) => a.asset.filename.localeCompare(b.asset.filename, 'fr'));
  }, [hashes, assets, selectedElements, selectedLinks, version]);

  const icons: Record<string, ReactTypes.ElementType> = { element: Highlighter, property: Tag, event: Calendar, location: MapPin, link: Link2 };

  if (!selectedElements.size && !selectedLinks.size) {
    return h('p', { className: 'p-4 text-xs text-text-tertiary' }, t('marker_select'));
  }
  if (!groups.length) {
    return h('p', { className: 'p-4 text-xs text-text-tertiary' }, t('marker_none'));
  }
  return h('div', null,
    groups.map(({ asset, items }) =>
      h('div', { key: asset.id, className: S.SECTION },
        h('div', { className: 'flex items-center gap-2 px-4 py-2.5' },
          h('span', { className: S.SECTION_TITLE, style: { textTransform: 'none', letterSpacing: 'normal' }, title: asset.filename }, asset.filename),
          h('span', { className: S.SECTION_BADGE }, items.length)),
        h('div', { className: 'px-2 pb-2 space-y-0.5' },
          items.map((a) =>
            h('button', {
              key: a.id,
              type: 'button',
              onClick: () => openReader({ dossierId, assetId: asset.id, annotationId: a.id }),
              title: a.context ?? a.text,
              className: 'w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-bg-secondary',
            },
            h(icons[a.kind] ?? Highlighter, { size: 12, className: 'text-text-tertiary shrink-0' }),
            h('span', { className: 'flex-1 min-w-0' },
              h('span', { className: 'block text-xs text-text-primary truncate' }, a.text || '…'),
              h('span', { className: S.HINT }, [isPdf(asset) ? `p.${a.page}` : '', a.kind === 'property' ? a.propertyKey : ''].filter(Boolean).join(' · ') || null))))))));
}
