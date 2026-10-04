// ─── "Marqueur" tab of ZN's side panel ───────────────────────
//
// Passages of the element selected on the canvas, or of the selected link,
// in every document of the dossier, grouped by document. A click opens the document
// on the passage.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { Annotation } from '../core/model.ts';
import { annotatedDocuments, getAnnotations, getVersion, loadAnnotations, subscribe } from '../services/annotationStore.ts';
import { absentDocuments, forgetDocument, type AbsentDocument } from '../services/documentData.ts';
import { getReferencesVersion, loadReference, subscribeReferences } from '../services/documentRef.ts';
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

  // References given in the reader name the documents instead of their files.
  const referencesVersion = React.useSyncExternalStore(subscribeReferences, getReferencesVersion);
  const [references, setReferences] = React.useState<Map<string, string>>(new Map());
  React.useEffect(() => {
    let cancelled = false;
    Promise.all(hashes.map(async (hash) => [hash, await loadReference(dossierId, hash)] as const))
      .then((entries) => {
        if (!cancelled) setReferences(new Map(entries.filter(([, ref]) => ref)));
      })
      .catch((err: unknown) => console.error('MarkNeurone: cannot load document references', err));
    return () => {
      cancelled = true;
    };
  }, [dossierId, hashes, referencesVersion]);

  const selectedElements: Set<string> = api.stores.useSelectionStore((s: { selectedElementIds: Set<string> }) => s.selectedElementIds);
  const selectedLinks: Set<string> = api.stores.useSelectionStore((s: { selectedLinkIds: Set<string> }) => s.selectedLinkIds);
  const assets: DocumentAsset[] = api.stores.useDossierStore((s: { assets: DocumentAsset[] }) => s.assets ?? NO_ASSETS);

  const groups = React.useMemo(() => {
    const out: { asset: DocumentAsset; name: string; items: Annotation[] }[] = [];
    for (const hash of hashes) {
      const asset = assets.find((a) => a.hash === hash);
      if (!asset) continue;
      const items = getAnnotations(dossierId, hash)
        .filter((a) => a.status !== 'rejected' && a.kind !== 'suggestion')
        // A link's passages show when the link is selected; an element shows its own passages only.
        .filter((a) =>
          a.kind === 'link'
            ? !!a.targetId && selectedLinks.has(a.targetId)
            : concernedElements(a).some((id) => selectedElements.has(id)),
        )
        .sort((a, b) => a.page - b.page || (a.textRange?.[0] ?? 0) - (b.textRange?.[0] ?? 0));
      if (items.length) out.push({ asset, name: references.get(hash) || asset.filename, items });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  }, [hashes, assets, references, selectedElements, selectedLinks, version]);

  // Highlights kept from deleted documents, until the user deletes them.
  const [absent, setAbsent] = React.useState<AbsentDocument[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    absentDocuments(dossierId)
      .then((list) => {
        if (!cancelled) setAbsent(list);
      })
      .catch((err: unknown) => console.error('MarkNeurone: cannot list deleted documents', err));
    return () => {
      cancelled = true;
    };
  }, [dossierId, version, assets]);
  const absentSection = absent.length ? h(AbsentSection, { key: 'absent', dossierId, documents: absent }) : null;

  const icons: Record<string, ReactTypes.ElementType> = { element: Highlighter, property: Tag, event: Calendar, location: MapPin, link: Link2 };
  const open = (asset: DocumentAsset, a: Annotation) => openReader({ dossierId, assetId: asset.id, annotationId: a.id });

  if (!selectedElements.size && !selectedLinks.size) {
    return h('div', null, h('p', { className: 'p-4 text-xs text-text-tertiary' }, t('marker_select')), absentSection);
  }
  if (!groups.length) {
    return h('div', null, h('p', { className: 'p-4 text-xs text-text-tertiary' }, t('marker_none')), absentSection);
  }
  // With many documents, sections start closed.
  const startOpen = groups.length <= 3;
  return h('div', null,
    groups.map(({ asset, name, items }) =>
      h(DocSection, { key: asset.id, title: name, tooltip: asset.filename, count: items.length, startOpen },
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
        }))),
    absentSection);
}

/** Deleted documents whose highlights are kept; each can be deleted, after confirmation. */
function AbsentSection(p: { dossierId: string; documents: AbsentDocument[] }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const remove = (hash: string) => {
    setConfirming(null);
    forgetDocument(p.dossierId, hash).catch((err: unknown) => {
      console.error('MarkNeurone: cannot delete highlights', err);
      api.toast.error(t('absent_delete_error'));
    });
  };
  const link = 'text-xs text-accent hover:underline shrink-0';
  return h(DocSection, { title: t('absent_title'), count: p.documents.length, startOpen: false },
    p.documents.map((d) =>
      h('div', { key: d.hash, className: 'flex items-center gap-2 px-2 py-1 text-xs' },
        confirming === d.hash
          ? h(React.Fragment, null,
              h('span', { className: 'flex-1 min-w-0 text-text-primary' }, t('absent_delete_confirm', { count: d.annotations })),
              h('button', { type: 'button', onClick: () => remove(d.hash), className: link }, t('absent_delete')),
              h('button', { type: 'button', onClick: () => setConfirming(null), className: link }, t('cancel')))
          : h(React.Fragment, null,
              h('span', { className: 'flex-1 min-w-0 truncate text-text-primary', title: d.filename ?? d.hash }, d.filename ?? t('absent_unnamed')),
              h('span', { className: 'text-text-tertiary shrink-0' }, t('absent_count', { count: d.annotations })),
              h('button', { type: 'button', onClick: () => setConfirming(d.hash), className: link }, t('absent_delete'))))));
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
function DocSection(p: { title: string; tooltip?: string; count: number; startOpen: boolean; children?: ReactTypes.ReactNode }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const [isOpen, setOpen] = React.useState(p.startOpen);
  const { ChevronDown } = api.icons;
  return h('div', { className: S.SECTION },
    h('button', { type: 'button', onClick: () => setOpen(!isOpen), className: S.SECTION_HEADER },
      h(ChevronDown, { size: 14, className: 'text-text-tertiary transition-transform duration-200', style: isOpen ? undefined : { transform: 'rotate(-90deg)' } }),
      h('span', { className: `${S.SECTION_TITLE} truncate`, style: { textTransform: 'none', letterSpacing: 'normal' }, title: p.tooltip ?? p.title }, p.title),
      h('span', { className: S.SECTION_BADGE }, p.count)),
    isOpen ? h('div', { className: 'px-2 pb-2 space-y-0.5' }, p.children) : null);
}
