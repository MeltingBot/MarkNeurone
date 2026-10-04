// ─── Tag picker ──────────────────────────────────────────────
//
// Chooses one of the tags of ZN's tag manager (TagSets), shown with their
// color and icon, filtered as one types. Used in the settings window.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { ZnTagSet } from '../services/znTypes.ts';

const FIELD = 'w-full flex items-center gap-2 px-2 py-1 text-xs rounded border border-border-default bg-bg-primary text-left focus:outline-none focus:border-accent';
const ADD = 'inline-flex items-center gap-1 px-2 py-0.5 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary rounded border border-dashed border-border-default';

interface Props {
  value: string | null;
  tagSets: ZnTagSet[];
  onChange: (name: string | null) => void;
  /** Names not offered (already chosen elsewhere). */
  exclude?: string[];
  /** Offers "none" first. */
  allowNone?: boolean;
  /** Shown as the dashed "Add" button instead of a field. */
  addButton?: boolean;
  colorOf?: (name: string) => string | null;
  /** The field shows no color dot (an editable one sits next to it). */
  hideDot?: boolean;
}

export function TagSetPicker(p: Props) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string) => api.i18n.t(key, { ns: I18N_NS });
  const icons = api.icons as Record<string, ReactTypes.ElementType | undefined>;
  const ref = React.useRef<HTMLButtonElement>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [query, setQuery] = React.useState('');

  const tagSet = (name: string) => p.tagSets.find((ts) => ts.name.toLowerCase() === name.toLowerCase());
  const colorOf = (name: string) => (p.colorOf ? p.colorOf(name) : tagSet(name)?.defaultVisual.color ?? null);
  const label = (name: string, dot = true) => {
    const Icon = icons[tagSet(name)?.defaultVisual.icon ?? ''];
    return h(React.Fragment, null,
      dot ? h('span', { className: 'inline-block rounded-full shrink-0', style: { width: 8, height: 8, background: colorOf(name) ?? 'var(--color-border-strong)' } }) : null,
      Icon ? h(Icon, { size: 12, className: 'text-text-tertiary shrink-0' }) : null,
      h('span', { className: 'truncate' }, name));
  };

  const excluded = new Set((p.exclude ?? []).map((n) => n.toLowerCase()));
  const options = p.tagSets
    .map((ts) => ts.name)
    .filter((name) => !excluded.has(name.toLowerCase()) && name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'fr'));
  const pick = (name: string | null) => {
    setRect(null);
    setQuery('');
    p.onChange(name);
  };
  const toggle = () => setRect(rect ? null : ref.current?.getBoundingClientRect() ?? null);

  return h(React.Fragment, null,
    p.addButton
      ? h('button', { ref, type: 'button', onClick: toggle, className: ADD }, h(api.icons.Plus, { size: 12 }), t('tag_add'))
      : h('button', { ref, type: 'button', onClick: toggle, className: FIELD },
          p.value ? label(p.value, !p.hideDot) : h('span', { className: 'text-text-tertiary' }, t('settings_no_tag')),
          h(api.icons.ChevronDown, { size: 12, className: 'ml-auto text-text-tertiary shrink-0' })),
    rect
      ? h(React.Fragment, null,
          h('div', { className: 'fixed inset-0 z-[9998]', onMouseDown: () => setRect(null) }),
          h('div', {
            className: 'fixed bg-bg-primary border border-border-default rounded shadow-lg z-[9999] flex flex-col',
            style: { top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220), maxHeight: 260 },
            onKeyDown: (e: ReactTypes.KeyboardEvent) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setRect(null);
              } else if (e.key === 'Enter' && options[0]) {
                e.preventDefault();
                pick(options[0]);
              }
            },
          },
          h('input', {
            autoFocus: true,
            value: query,
            placeholder: t('tag_type_to_filter'),
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
            className: 'm-1 px-2 py-1 text-xs bg-bg-secondary border border-border-default rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary',
          }),
          h('div', { className: 'overflow-y-auto' },
            p.allowNone && !query.trim()
              ? h('button', { type: 'button', onClick: () => pick(null), className: 'w-full px-2 py-1.5 text-xs text-left text-text-tertiary hover:bg-bg-secondary' }, t('settings_no_tag'))
              : null,
            options.map((name) =>
              h('button', { key: name, type: 'button', onClick: () => pick(name), className: 'w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left text-text-primary hover:bg-bg-secondary' },
                label(name))))))
      : null);
}
