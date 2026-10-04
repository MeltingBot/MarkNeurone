// ─── Selection bar ───────────────────────────────────────────
//
// Small bar shown next to a text selection: E, P or V picks the gesture,
// the form itself opens in the element sheet. Escape or a click elsewhere
// dismisses it.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { Passage } from '../services/selectionCapture.ts';

export type Gesture = 'element' | 'property' | 'event' | 'location';

interface Props {
  passage: Passage;
  onChoose: (gesture: Gesture) => void;
  onCancel: () => void;
  /** Suggestion clicked: what it is, and how to dismiss it. */
  title?: string;
  /** Known element: its tag color, shown as a dot before the name. */
  titleColor?: string | null;
  /** Tooltip of the title. */
  titleHint?: string;
  onReject?: () => void;
  /** Scanned page: read the selection again at high resolution. */
  onReread?: () => void;
}

const KEYS: Record<string, Gesture> = { e: 'element', p: 'property', v: 'event', g: 'location' };

export function SelectionBar({ passage, onChoose, onCancel, title, titleColor, titleHint, onReject, onReread }: Props) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string) => api.i18n.t(key, { ns: I18N_NS });
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    ref.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onCancel]);

  const onKeyDown = (e: ReactTypes.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (onReject && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      onReject();
      return;
    }
    const gesture = KEYS[e.key.toLowerCase()];
    if (gesture) {
      // The sheet's first field takes focus during this keystroke.
      e.preventDefault();
      onChoose(gesture);
    }
  };

  const box = passage.clientBox;
  const icons = api.icons;
  const style: ReactTypes.CSSProperties = window.innerHeight - box.bottom > 48
    ? { left: Math.max(8, box.left), top: box.bottom + 6 }
    : { left: Math.max(8, box.left), bottom: window.innerHeight - box.top + 6 };

  // Icons only, as in ZN's toolbars: the action and its key are in the tooltip.
  const button = (key: string, label: string, Icon: ReactTypes.ElementType, onClick: () => void) =>
    h('button', {
      key,
      type: 'button',
      onClick,
      title: label,
      'aria-label': label,
      className: 'p-1.5 rounded text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
    }, h(Icon, { size: 14 }));

  return h('div', {
    ref,
    role: 'toolbar',
    'aria-label': title ? `${t('qualify_title')} : ${title}` : t('qualify_title'),
    tabIndex: -1,
    onKeyDown,
    className: 'fixed z-50 flex items-center gap-0.5 p-0.5 outline-none bg-bg-primary border border-border-default rounded shadow-lg sketchy-border-soft',
    style,
  },
  // What the suggestion was recognized as: the type, or the known element.
  title
    ? h(React.Fragment, null,
        h('span', { className: 'inline-flex items-center gap-1.5 pl-1.5 pr-1 text-[11px] text-text-tertiary min-w-0', title: titleHint ?? title },
          titleColor !== undefined
            ? h('span', { className: 'inline-block rounded-full shrink-0', style: { width: 8, height: 8, background: titleColor ?? 'var(--color-border-strong)' } })
            : null,
          h('span', { className: 'truncate', style: { maxWidth: 160 } }, title)),
        h('span', { className: 'mx-0.5 self-stretch border-l border-border-default' }))
    : null,
  button('element', `${t('gesture_element')} (E)`, icons.Highlighter, () => onChoose('element')),
  button('property', `${t('gesture_property')} (P)`, icons.Tag, () => onChoose('property')),
  button('event', `${t('gesture_event')} (V)`, icons.Calendar, () => onChoose('event')),
  button('location', `${t('gesture_location')} (G)`, icons.MapPin, () => onChoose('location')),
  onReread
    ? h(React.Fragment, null,
        h('span', { className: 'mx-0.5 self-stretch border-l border-border-default' }),
        button('reread', t('reread_selection'), icons.ScanText, onReread))
    : null,
  onReject
    ? h(React.Fragment, null,
        h('span', { className: 'mx-0.5 self-stretch border-l border-border-default' }),
        button('reject', `${t('suggestion_reject')} (${t('key_delete')})`, icons.X, onReject))
    : null);
}
