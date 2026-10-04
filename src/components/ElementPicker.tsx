// ─── Element picker ──────────────────────────────────────────
//
// Search field with a list of matching elements, modelled on ZN's
// ElementAutocomplete (components/report): colour, label, short id to tell
// homonyms apart, a property and the first tags. Arrow keys move, Enter
// picks, Escape closes.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import { searchElements } from '../core/elementSearch.ts';
import type { ZnElement, ZnTagSet } from '../services/znTypes.ts';

interface Props {
  elements: ZnElement[];
  tagSets: ZnTagSet[];
  /** Picked element, shown in the field while it is not being searched. */
  value?: string | null;
  onChange: (elementId: string) => void;
  /** Escape with the list closed (e.g. to leave the form). */
  onEscape?: () => void;
  autoFocus?: boolean;
  inputClass: string;
}

const valueText = (v: unknown): string => (v instanceof Date ? v.toLocaleDateString('fr-FR') : v === null || v === undefined ? '' : String(v));

export function ElementPicker(p: Props) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const hits = React.useMemo(() => searchElements(p.elements, query), [p.elements, query]);
  React.useEffect(() => setIndex(0), [hits]);
  React.useEffect(() => {
    (listRef.current?.children[index] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [index, open]);

  const picked = p.value ? p.elements.find((el) => el.id === p.value) : undefined;
  const colorOf = (el: ZnElement) => {
    const tag = el.tags[0]?.toLowerCase();
    return (tag && p.tagSets.find((ts) => ts.name.toLowerCase() === tag)?.defaultVisual.color) || 'var(--color-border-strong)';
  };
  const choose = (id: string) => {
    setOpen(false);
    setQuery('');
    p.onChange(id);
  };

  const list = open
    ? h('div', {
        ref: listRef,
        role: 'listbox',
        className: 'absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto bg-bg-primary border border-border-default rounded panel-shadow',
      },
      hits.length
        ? hits.map(({ element, property }, i) => {
            const subtitle = property ?? (element.properties[0] ? { key: element.properties[0].key, value: valueText(element.properties[0].value) } : null);
            return h('button', {
              key: element.id,
              type: 'button',
              role: 'option',
              'aria-selected': i === index,
              // Keeps the focus in the field, so that its blur does not close the list first.
              onMouseDown: (e: ReactTypes.MouseEvent) => {
                e.preventDefault();
                choose(element.id);
              },
              onMouseEnter: () => setIndex(i),
              className: `w-full flex items-start gap-2 px-3 py-2 text-left ${i === index ? 'bg-accent/10' : 'hover:bg-bg-secondary'}`,
            },
              h('span', { className: 'inline-block rounded-full shrink-0 mt-1', style: { width: 10, height: 10, background: colorOf(element) } }),
              h('span', { className: 'min-w-0 flex-1' },
                h('span', { className: 'flex items-baseline gap-2' },
                  h('span', { className: 'text-sm text-text-primary truncate' }, element.label || t('unnamed')),
                  h('span', { className: 'text-xs text-text-tertiary font-mono shrink-0' }, `#${element.id.slice(-6)}`)),
                subtitle?.value
                  ? h('span', { className: 'block text-xs text-text-secondary truncate mt-0.5' }, `${subtitle.key} : ${subtitle.value}`)
                  : null,
                element.tags.length
                  ? h('span', { className: 'flex gap-1 mt-1' },
                      element.tags.slice(0, 2).map((tag) => h('span', { key: tag, className: 'text-xs px-1 py-0.5 bg-bg-tertiary rounded text-text-secondary' }, tag)))
                  : null));
          })
        : h('p', { className: 'px-3 py-2 text-sm text-text-tertiary' }, t('picker_none')))
    : null;

  return h('div', { className: 'relative' },
    h('input', {
      type: 'text',
      role: 'combobox',
      'aria-expanded': open,
      'aria-label': t('choose_element'),
      autoFocus: p.autoFocus,
      className: p.inputClass,
      placeholder: picked ? picked.label : t('picker_placeholder'),
      value: open ? query : picked?.label ?? '',
      onFocus: () => setOpen(true),
      onBlur: () => {
        setOpen(false);
        setQuery('');
      },
      onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setOpen(true);
      },
      onKeyDown: (e: ReactTypes.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
          setIndex((i) => Math.min(i + 1, hits.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (open && hits[index]) choose(hits[index].element.id);
        } else if (e.key === 'Escape') {
          // Never lets the reader minimize.
          e.stopPropagation();
          // A first Escape closes the list (typing or arrows open it again), a second one leaves.
          if (open) {
            setOpen(false);
            setQuery('');
          } else p.onEscape?.();
        }
      },
    }),
    list);
}
