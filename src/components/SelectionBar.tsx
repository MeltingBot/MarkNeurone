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
}

const KEYS: Record<string, Gesture> = { e: 'element', p: 'property', v: 'event', g: 'location' };

export function SelectionBar({ passage, onChoose, onCancel }: Props) {
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
    const gesture = KEYS[e.key.toLowerCase()];
    if (gesture) {
      // The sheet's first field takes focus during this keystroke.
      e.preventDefault();
      onChoose(gesture);
    }
  };

  const box = passage.clientBox;
  const width = 400;
  const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8));
  const below = window.innerHeight - box.bottom > 60;
  const style: ReactTypes.CSSProperties = below ? { left, top: box.bottom + 6 } : { left, bottom: window.innerHeight - box.top + 6 };

  const button = (gesture: Gesture, letter: string) =>
    h('button', {
      key: gesture,
      type: 'button',
      onClick: () => onChoose(gesture),
      className: 'flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-text-primary rounded hover:bg-bg-secondary',
    },
    t(`gesture_${gesture}`),
    h('kbd', { className: 'text-[10px] text-text-tertiary font-mono' }, letter));

  return h('div', {
    ref,
    role: 'toolbar',
    'aria-label': t('qualify_title'),
    tabIndex: -1,
    onKeyDown,
    className: 'fixed z-50 flex items-center gap-1 p-1 outline-none bg-bg-primary border border-border-default rounded shadow-lg sketchy-border-soft',
    style: { ...style, width },
  },
  button('element', 'E'),
  button('property', 'P'),
  button('event', 'V'),
  button('location', 'G'));
}
