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
  const open = (asset: DocumentAsset, a: Annotation) => openReader({ dossierId, assetId: asset.id, annotationId: a.id });

  if (!selectedElements.size && !selectedLinks.size) {
    return h('p', { className: 'p-4 text-xs text-text-tertiary' }, t('marker_select'));
  }
  if (!groups.length) {
    return h('p', { className: 'p-4 text-xs text-text-tertiary' }, t('marker_none'));
  }
  // With many documents, sections start closed.
  const startOpen = groups.length <= 3;
  return h('div', null,
    groups.map(({ asset, items }) =>
      h(DocSection, { key: asset.id, title: asset.filename, count: items.length, startOpen },
        rowsOf(items).map((row) => {
          const first = row.items[0];
          const meta = first.kind === 'property' ? first.propertyKey : '';
          return h('div', { key: row.key, className: 'flex items-start gap-2 px-2 py-1 rounded hover:bg-bg-secondary' },
            h(icons[first.kind] ?? Highlighter, { size: 12, className: 'text-text-tertiary shrink-0 mt-0.5' }),
            h('div', { className: 'flex-1 min-w-0' },
              h('button', { type: 'button', onClick: () => open(asset, first), className: 'block w-full text-left text-xs text-text-primary truncate hover:text-accent' },
                first.text || '…'),
              // One link per occurrence: its page for a PDF, its rank otherwise.
              h('div', { className: 'flex flex-wrap items-center gap-x-1 text-[10px] text-text-tertiary' },
                meta ? h('span', null, `${meta} ·`) : null,
                isPdf(asset) ? h('span', null, 'p.') : null,
                row.items.map((a, i) =>
                  h('button', { key: a.id, type: 'button', onClick: () => open(asset, a), className: 'hover:text-accent hover:underline' },
                    isPdf(asset) ? String(a.page) : String(i + 1))))));
        }))));
}

/** Identical passages (same kind, text and property key) share one row. */
function rowsOf(items: Annotation[]): { key: string; items: Annotation[] }[] {
  const rows = new Map<string, Annotation[]>();
  for (const a of items) {
    const key = `${a.kind}|${a.text.trim().toLowerCase()}|${a.propertyKey ?? ''}`;
    rows.set(key, [...(rows.get(key) ?? []), a]);
  }
  return [...rows].map(([key, list]) => ({ key, items: list }));
}

/** A document, folded like the sections of ZN's panel. */
function DocSection(p: { title: string; count: number; startOpen: boolean; children?: ReactTypes.ReactNode }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const [isOpen, setOpen] = React.useState(p.startOpen);
  const { ChevronDown } = api.icons;
  return h('div', { className: S.SECTION },
    h('button', { type: 'button', onClick: () => setOpen(!isOpen), className: S.SECTION_HEADER },
      h(ChevronDown, { size: 14, className: 'text-text-tertiary transition-transform duration-200', style: isOpen ? undefined : { transform: 'rotate(-90deg)' } }),
      h('span', { className: `${S.SECTION_TITLE} truncate`, style: { textTransform: 'none', letterSpacing: 'normal' }, title: p.title }, p.title),
      h('span', { className: S.SECTION_BADGE }, p.count)),
    isOpen ? h('div', { className: 'px-2 pb-2 space-y-0.5' }, p.children) : null);
}
