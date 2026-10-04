// ─── Color dot ───────────────────────────────────────────────
//
// A tag's color dot that opens ZN's node palette, "no color", or a free
// color. Used in the element sheet and in the settings window.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';

/** ZN's node palette (DEFAULT_COLORS). */
const PALETTE = [
  'var(--color-node-yellow)',
  'var(--color-node-pink)',
  'var(--color-node-blue)',
  'var(--color-node-green)',
  'var(--color-node-orange)',
  'var(--color-node-purple)',
  'var(--color-node-red)',
  'var(--color-node-cyan)',
  'var(--color-node-lime)',
];

export function ColorDot(p: { color: string | null; onChoose: (color: string | null) => void; size?: number }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string) => api.i18n.t(key, { ns: I18N_NS });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const size = p.size ?? 8;
  const choose = (value: string | null) => {
    setRect(null);
    p.onChoose(value);
  };
  const swatch = (value: string | null, key: string) =>
    h('button', {
      key,
      type: 'button',
      onClick: () => choose(value),
      title: value ? undefined : t('tag_color_none'),
      className: `w-5 h-5 rounded border-2 ${p.color === value ? 'border-accent' : value ? 'border-transparent' : 'border-border-default'}`,
      style: { background: value ?? 'var(--color-bg-primary)' },
    });
  return h(React.Fragment, null,
    h('button', {
      ref: buttonRef,
      type: 'button',
      onClick: () => setRect(rect ? null : buttonRef.current?.getBoundingClientRect() ?? null),
      title: t('tag_color'),
      className: 'inline-block rounded-full shrink-0 focus:outline-none',
      style: { width: size, height: size, background: p.color ?? 'var(--color-border-strong)' },
    }),
    rect
      ? h(React.Fragment, null,
          h('div', { className: 'fixed inset-0 z-[9998]', onMouseDown: () => setRect(null) }),
          h('div', {
            className: 'fixed bg-bg-primary border border-border-default rounded shadow-lg z-[9999] p-2 flex flex-wrap gap-1.5',
            style: { top: rect.bottom + 6, left: rect.left - 4, width: 160 },
            onKeyDown: (e: ReactTypes.KeyboardEvent) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setRect(null);
              }
            },
          },
          swatch(null, 'none'),
          PALETTE.map((c) => swatch(c, c)),
          h('input', {
            type: 'color',
            value: p.color && p.color.startsWith('#') ? p.color : '#888888',
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => choose(e.target.value),
            title: t('tag_color_custom'),
            className: 'w-5 h-5 rounded cursor-pointer border-0 p-0',
          })))
      : null);
}
