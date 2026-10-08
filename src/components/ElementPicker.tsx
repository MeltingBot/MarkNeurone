// ─── Search pickers ──────────────────────────────────────────
//
// Search field with a list of matches, modelled on ZN's ElementAutocomplete
// (components/report). Arrow keys move, Enter picks, Escape closes the list
// and, once closed, leaves. ElementPicker shows colour, label, a property and
// tags, and for homonyms what tells them apart; EventPicker shows label, date
// and description.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import { discriminants, homonymGroups, searchElements, searchEvents, type ElementHit } from '../core/elementSearch.ts';
import { countries } from '../core/propertyTypes.ts';
import { sourceLabels } from '../core/anchors.ts';
import { normalizeName } from '../core/dictionary.ts';
import type { ZnElement, ZnElementEvent, ZnLink, ZnTagSet } from '../services/znTypes.ts';

interface PickerProps<T> {
  /** Matches of a query, in display order. */
  search: (query: string) => T[];
  idOf: (item: T) => string;
  /** Text shown in the field for the picked item. */
  labelOf: (item: T) => string;
  row: (item: T) => ReactTypes.ReactNode;
  /** Shown on hover. */
  titleOf?: (item: T) => string | undefined;
  picked?: T;
  onChange: (id: string) => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  inputClass: string;
  placeholder: string;
  empty: string;
  /** Height of the list; a short one by default. */
  listClass?: string;
}

function SearchPicker<T>(p: PickerProps<T>) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const { search } = p;
  const hits = React.useMemo(() => search(query), [search, query]);
  React.useEffect(() => setIndex(0), [hits]);
  React.useEffect(() => {
    (listRef.current?.children[index] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [index, open]);

  const choose = (item: T) => {
    setOpen(false);
    setQuery('');
    p.onChange(p.idOf(item));
  };

  const list = open
    ? h('div', {
        ref: listRef,
        role: 'listbox',
        className: `absolute left-0 right-0 z-20 mt-1 ${p.listClass ?? 'max-h-64'} overflow-y-auto bg-bg-primary border border-border-default rounded panel-shadow`,
      },
      hits.length
        ? hits.map((item, i) =>
            h('button', {
              key: p.idOf(item),
              type: 'button',
              role: 'option',
              'aria-selected': i === index,
              title: p.titleOf?.(item),
              // Keeps the focus in the field, so that its blur does not close the list first.
              onMouseDown: (e: ReactTypes.MouseEvent) => {
                e.preventDefault();
                choose(item);
              },
              onMouseEnter: () => setIndex(i),
              className: `w-full flex items-start gap-2 px-3 py-2 text-left ${i === index ? 'bg-accent/10' : 'hover:bg-bg-secondary'}`,
            }, p.row(item)))
        : h('p', { className: 'px-3 py-2 text-sm text-text-tertiary' }, p.empty))
    : null;

  return h('div', { className: 'relative' },
    h('input', {
      type: 'text',
      role: 'combobox',
      'aria-expanded': open,
      'aria-label': p.placeholder,
      autoFocus: p.autoFocus,
      className: p.inputClass,
      placeholder: p.picked ? p.labelOf(p.picked) : p.placeholder,
      value: open ? query : p.picked ? p.labelOf(p.picked) : '',
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
          if (open && hits[index]) choose(hits[index]);
        } else if (e.key === 'Escape') {
          // Never lets the reader minimize. A first Escape closes the list
          // (typing or arrows open it again), a second one leaves.
          e.stopPropagation();
          if (open) {
            setOpen(false);
            setQuery('');
          } else p.onEscape?.();
        }
      },
    }),
    list);
}

const valueText = (v: unknown): string => (v instanceof Date ? v.toLocaleDateString('fr-FR') : v === null || v === undefined ? '' : String(v));

interface ElementPickerProps {
  elements: ZnElement[];
  tagSets: ZnTagSet[];
  /** To tell homonyms apart by the elements they are linked to. */
  links?: ZnLink[];
  /** Alone in the panel: a list as tall as the panel allows. */
  tall?: boolean;
  /** Listed first (elements read in the open document). */
  first?: Set<string>;
  /** Picked element, shown in the field while it is not being searched. */
  value?: string | null;
  onChange: (elementId: string) => void;
  /** Escape with the list closed (e.g. to leave the form). */
  onEscape?: () => void;
  autoFocus?: boolean;
  inputClass: string;
}

export function ElementPicker(p: ElementPickerProps) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const { elements, tagSets, links, tall, first } = p;
  const search = React.useCallback((query: string) => searchElements(elements, query, tall ? 500 : 30, first), [elements, tall, first]);
  const groups = React.useMemo(() => homonymGroups(elements), [elements]);
  const linkedLabels = React.useMemo(() => linkedLabelsOf(elements, links ?? []), [elements, links]);
  const colorOf = (el: ZnElement) => {
    const tag = el.tags[0]?.toLowerCase();
    return (tag && tagSets.find((ts) => ts.name.toLowerCase() === tag)?.defaultVisual.color) || 'var(--color-border-strong)';
  };
  const pickedEl = p.value ? elements.find((el) => el.id === p.value) : undefined;
  return h(SearchPicker<ElementHit<ZnElement>>, {
    search,
    idOf: (hit) => hit.element.id,
    labelOf: (hit) => hit.element.label,
    picked: pickedEl ? { element: pickedEl } : undefined,
    onChange: p.onChange,
    onEscape: p.onEscape,
    autoFocus: p.autoFocus,
    inputClass: p.inputClass,
    placeholder: t('picker_placeholder'),
    empty: t('picker_none'),
    listClass: tall ? 'max-h-[calc(100vh-12rem)]' : undefined,
    // The documents it was read in, by their reference.
    titleOf: ({ element }) => sourceLabels(element.source).join('\n') || undefined,
    row: ({ element, property, reference }) => {
      const d = discriminants(element, groups, linkedLabels);
      const firstProperty = element.properties[0] ? { key: element.properties[0].key, value: valueText(element.properties[0].value) } : null;
      // A homonym shows what sets it apart, in full; any other element a single property.
      const lines = d
        ? [
            ...(property && !d.properties.some((x) => x.key === property.key) ? [property] : []),
            ...d.properties,
          ].map((x) => `${x.key} : ${x.value}`).concat(d.linked.length ? [t('picker_linked', { labels: d.linked.join(', ') })] : [])
        : [property ?? firstProperty].filter((x) => x?.value).map((x) => `${x!.key} : ${x!.value}`);
      if (reference) lines.unshift(reference);
      return h(React.Fragment, null,
        h('span', { className: 'inline-block rounded-full shrink-0 mt-1', style: { width: 10, height: 10, background: colorOf(element) } }),
        h('span', { className: 'min-w-0 flex-1' },
          h('span', { className: 'flex items-baseline gap-2' },
            h('span', { className: 'text-sm text-text-primary truncate' }, element.label || t('unnamed')),
            d ? h('span', { className: 'text-xs text-text-tertiary shrink-0' }, t('picker_homonyms', { count: (groups.get(normalizeName(element.label))?.length ?? 1) - 1 })) : null),
          lines.map((line) => h('span', { key: line, className: `block text-xs text-text-secondary mt-0.5 ${d ? 'break-words' : 'truncate'}` }, line)),
          element.tags.length
            ? h('span', { className: 'flex flex-wrap gap-1 mt-1' },
                element.tags.slice(0, d ? 4 : 2).map((tag) => h('span', { key: tag, className: 'text-xs px-1 py-0.5 bg-bg-tertiary rounded text-text-secondary' }, tag)))
            : null));
    },
  });
}

/** Labels of the elements each element is linked to, by element id. */
export function linkedLabelsOf(elements: ZnElement[], links: ZnLink[]): (id: string) => string[] {
  const labelOf = new Map(elements.map((el) => [el.id, el.label]));
  const byId = new Map<string, string[]>();
  const add = (id: string, other: string) => {
    const label = labelOf.get(other);
    if (label) byId.set(id, [...(byId.get(id) ?? []), label]);
  };
  for (const l of links) {
    add(l.fromId, l.toId);
    add(l.toId, l.fromId);
  }
  return (id) => byId.get(id) ?? [];
}

interface EventPickerProps {
  events: ZnElementEvent[];
  /** Shown first, e.g. events read on the same page. */
  first?: Set<string>;
  value?: string | null;
  onChange: (eventId: string) => void;
  onEscape?: () => void;
  autoFocus?: boolean;
  inputClass: string;
}

export function EventPicker(p: EventPickerProps) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const { events, first } = p;
  const search = React.useCallback((query: string) => searchEvents(events, query, first), [events, first]);
  const date = (ev: ZnElementEvent) => new Date(ev.date).toLocaleDateString('fr-FR');
  return h(SearchPicker<ZnElementEvent>, {
    search,
    idOf: (ev) => ev.id,
    labelOf: (ev) => `${ev.label} · ${date(ev)}`,
    picked: p.value ? events.find((ev) => ev.id === p.value) : undefined,
    onChange: p.onChange,
    onEscape: p.onEscape,
    autoFocus: p.autoFocus,
    inputClass: p.inputClass,
    placeholder: t('event_picker_placeholder'),
    empty: t('event_picker_none'),
    row: (ev) =>
      h(React.Fragment, null,
        h(api.icons.Calendar, { size: 12, className: 'text-text-tertiary shrink-0 mt-1' }),
        h('span', { className: 'min-w-0 flex-1' },
          h('span', { className: 'flex items-baseline gap-2' },
            h('span', { className: 'text-sm text-text-primary truncate' }, ev.label || t('unnamed')),
            h('span', { className: 'text-xs text-text-tertiary shrink-0' }, date(ev))),
          ev.description ? h('span', { className: 'block text-xs text-text-secondary truncate mt-0.5' }, ev.description) : null)),
  });
}

type Country = ReturnType<typeof countries>[number];

/** Country by name (French or English) or code; the value is the ISO alpha-2 code, as in ZN. */
export function CountryPicker(p: { value: string; onChange: (code: string) => void; inputClass: string }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const search = React.useCallback((query: string) => {
    const n = normalizeName(query);
    const all = countries();
    return n ? all.filter((c) => normalizeName(c.fr).includes(n) || normalizeName(c.en).includes(n) || c.code.toLowerCase() === n) : all;
  }, []);
  return h(SearchPicker<Country>, {
    search,
    idOf: (c) => c.code,
    labelOf: (c) => c.fr,
    picked: p.value ? countries().find((c) => c.code === p.value) : undefined,
    onChange: p.onChange,
    inputClass: p.inputClass,
    placeholder: t('country_placeholder'),
    empty: t('country_none'),
    row: (c) =>
      h(React.Fragment, null,
        h('span', { className: 'text-sm text-text-primary truncate flex-1' }, c.fr),
        h('span', { className: 'text-xs text-text-tertiary font-mono shrink-0' }, c.code)),
  });
}
