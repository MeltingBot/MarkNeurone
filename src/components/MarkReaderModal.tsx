// ─── Reader modal ────────────────────────────────────────────
//
// Large modal hosting the document reader. It can be reduced to a small
// floating button to go back to the canvas without losing the reading
// position. While it is open, keyboard events are kept away from ZN's
// canvas shortcuts (Delete, Ctrl+Z...), which listen on `window`.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import { findAsset } from '../services/documentAssets.ts';
import { PdfViewer } from './PdfViewer.tsx';
import { isMapPickerOpen } from '../services/mapPicker.ts';

interface Props {
  dossierId: string;
  assetId: string;
  focus: { annotationId: string; target: object } | null;
  minimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onClose: () => void;
}

export function MarkReaderModal({ dossierId, assetId, focus, minimized, onMinimize, onRestore, onClose }: Props) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const { Highlighter, Minimize2, X } = api.icons;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });

  // Re-render when the dossier's assets change (asset removed while reading).
  const assets = api.stores.useDossierStore((s: { assets: unknown[] }) => s.assets);
  const asset = React.useMemo(() => findAsset(assetId), [assetId, assets]);

  React.useEffect(() => {
    if (minimized) return;
    // Bubble phase on `document`: runs after the modal's own React handlers
    // and before ZN's `window` listeners, which therefore never see the key.
    const onKeyDown = (e: KeyboardEvent) => {
      // ZN's map picker, opened from the sheet, handles its own keys.
      if (isMapPickerOpen()) return;
      if (e.key === 'Escape') onMinimize();
      e.stopPropagation();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [minimized, onMinimize]);

  if (!asset) {
    return null;
  }

  const headerButton = 'p-1.5 rounded text-text-secondary hover:bg-bg-secondary';

  // The modal stays mounted while minimized so that the document, the zoom
  // and the scroll position survive a trip back to the canvas.
  const pill = minimized
    ? h(
        'button',
        {
          onClick: onRestore,
          title: t('reader_restore'),
          'aria-label': `${t('reader_restore')} : ${asset.filename}`,
          className:
            'fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium ' +
            'bg-bg-primary text-text-primary border border-border-strong rounded sketchy-border hover:bg-bg-secondary',
        },
        h(Highlighter, { size: 14 }),
        h('span', { className: 'truncate', style: { maxWidth: 256 } }, asset.filename),
      )
    : null;

  const modal = h(
    'div',
    {
      className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/40',
      // visibility keeps layout and scroll position, and lets clicks through.
      style: minimized ? { visibility: 'hidden' } : undefined,
    },
    h(
      'div',
      {
        role: 'dialog',
        'aria-modal': true,
        'aria-label': t('reader_title', { name: asset.filename }),
        className: 'flex flex-col bg-bg-primary border border-border-default rounded shadow-lg sketchy-border-soft overflow-hidden',
        style: { width: 'calc(100vw - 48px)', height: 'calc(100vh - 48px)' },
      },
      h(
        'div',
        { className: 'flex items-center justify-between px-4 py-3 border-b border-border-default' },
        h(
          'div',
          { className: 'flex items-center gap-2 min-w-0' },
          h(Highlighter, { size: 16, className: 'text-text-secondary shrink-0' }),
          h('h2', { className: 'text-sm font-semibold text-text-primary truncate' }, asset.filename),
        ),
        h(
          'div',
          { className: 'flex items-center gap-1' },
          h('button', { onClick: onMinimize, title: t('reader_minimize'), className: headerButton }, h(Minimize2, { size: 16 })),
          h('button', { onClick: onClose, title: t('reader_close'), className: headerButton }, h(X, { size: 16 })),
        ),
      ),
      h(PdfViewer, { dossierId, asset, focus, onMinimize }),
    ),
  );

  return h(React.Fragment, null, modal, pill);
}
