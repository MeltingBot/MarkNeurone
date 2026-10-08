// ─── Reader context menu ─────────────────────────────────────
//
// Replaces the browser's menu inside the document, with the look of ZN's
// canvas menu (components/canvas/contextMenu/ContextMenuShell.tsx).

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { readerDocument, readerWindow } from '../services/readerWindow.ts';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactTypes.ElementType;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Tooltip, e.g. why an item is disabled. */
  title?: string;
  action: () => void;
}

interface Props {
  x: number;
  y: number;
  header?: string;
  sections: MenuItem[][];
  onClose: () => void;
}

const PANEL_CLASS = 'fixed py-1 bg-bg-primary border border-border-default sketchy-border-soft panel-shadow';
// Above the reader modal (z-50).
const Z_OVERLAY = 60;
const Z_PANEL = 61;
// The menu takes the width of its longest entry, within these bounds.
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

export function ReaderContextMenu({ x, y, header, sections, onClose }: Props) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    setHeight(rootRef.current?.offsetHeight ?? 0);
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  const left = Math.max(8, Math.min(x, readerWindow().innerWidth - MAX_WIDTH - 8));
  const top = height && y + height > readerWindow().innerHeight - 8 ? Math.max(8, y - height) : y;
  const visible = sections.map((section) => section).filter((section) => section.length > 0);

  const items = () => [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('button[role=menuitem]:not([disabled])') ?? [])];
  const onKeyDown = (e: ReactTypes.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Keep Escape from minimizing the reader.
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = items();
    if (!list.length) return;
    const current = list.indexOf(readerDocument().activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (current + 1) % list.length : (current - 1 + list.length) % list.length;
    list[next].focus({ preventScroll: true });
  };

  const row = (item: MenuItem) => {
    const color = item.disabled
      ? 'text-text-tertiary cursor-not-allowed'
      : item.danger
        ? 'text-error hover:bg-pastel-pink focus:bg-pastel-pink'
        : 'text-text-primary hover:bg-bg-tertiary focus:bg-bg-tertiary';
    return h('button', {
      key: item.id,
      type: 'button',
      role: 'menuitem',
      disabled: item.disabled,
      'aria-disabled': item.disabled || undefined,
      title: item.title,
      onClick: () => {
        onClose();
        item.action();
      },
      onMouseEnter: (e: ReactTypes.MouseEvent<HTMLButtonElement>) => e.currentTarget.focus({ preventScroll: true }),
      className: `w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left outline-none transition-colors ${color}`,
    },
    item.icon ? h(item.icon, { size: 14, className: 'shrink-0' }) : h('span', { className: 'w-3.5 shrink-0' }),
    h('span', { className: 'whitespace-nowrap' }, item.label),
    item.shortcut ? h('span', { className: 'ml-auto pl-4 shrink-0 text-xs text-text-tertiary' }, item.shortcut) : null);
  };

  return h(React.Fragment, null,
    h('div', {
      className: 'fixed inset-0',
      style: { zIndex: Z_OVERLAY },
      onMouseDown: onClose,
      onContextMenu: (e: ReactTypes.MouseEvent) => {
        e.preventDefault();
        onClose();
      },
    }),
    h('div', {
      ref: rootRef,
      role: 'menu',
      tabIndex: -1,
      onKeyDown,
      onContextMenu: (e: ReactTypes.MouseEvent) => e.preventDefault(),
      className: `${PANEL_CLASS} outline-none`,
      style: { left, top, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH, zIndex: Z_PANEL },
    },
    header
      ? h('div', { className: 'px-3 pt-1.5 pb-0.5 text-xs text-text-tertiary truncate', title: header }, header)
      : null,
    visible.map((section, i) =>
      h('div', { key: i, className: i > 0 || header ? 'py-1 border-t border-border-default' : 'py-0' }, section.map(row)))));
}
