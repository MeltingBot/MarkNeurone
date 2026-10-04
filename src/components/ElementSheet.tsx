// ─── Element sheet ───────────────────────────────────────────
//
// Right column of the reader, built like ZN's element detail panel:
// identity, properties, events, plus the passages of the document that
// point to the element. Gestures open their draft in the relevant section;
// existing values can be edited in place.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { Annotation } from '../core/model.ts';
import { defaultAttachment, findCandidates, type MatchKind } from '../core/dictionary.ts';
import { findDates, toDateInputValue } from '../core/dates.ts';
import { trimPunctuation } from '../core/sentences.ts';
import { extractPatterns } from '../core/patterns/patterns.ts';
import { LOW_CONFIDENCE } from '../core/ocrLayout.ts';
import { formatCoordinate, parseLatLng } from '../core/geo.ts';
import { EVALUATION_GRIDS, evaluationModelOf, formatEvaluation, withAxis, type Evaluation, type EvaluationModel } from '../core/evaluation.ts';
import { canPickOnMap, pickOnMap } from '../services/mapPicker.ts';
import { getProfile, getSettings, getSettingsVersion, subscribeSettings } from '../services/settingsStore.ts';
import type { Passage } from '../services/selectionCapture.ts';
import {
  concernedElements,
  deleteAnnotation,
  qualifyAsEvent,
  qualifyAsExistingElement,
  qualifyAsNewElement,
  qualifyAsLink,
  qualifyAsLocation,
  qualifyAsProperty,
  reattachEvent,
  reattachLink,
  reattachToElement,
  type DocumentContext,
  type LinkPlace,
} from '../services/qualify.ts';
import { isPdf } from '../services/documentAssets.ts';
import { documentIndex, type IndexEntry } from '../core/documentIndex.ts';
import { searchElements } from '../core/elementSearch.ts';
import { saveAnnotation } from '../services/annotationStore.ts';
import * as graph from '../services/graphWriter.ts';
import {
  isGraphElement,
  type ZnElement,
  type ZnElementEvent,
  type ZnGeo,
  type ZnLink,
  type ZnProperty,
  type ZnPropertyType,
  type ZnTagSet,
} from '../services/znTypes.ts';
import type { Gesture } from './SelectionBar.tsx';
import * as S from './znStyles.ts';
import { ElementPicker } from './ElementPicker.tsx';
import { ColorDot } from './ColorDot.tsx';

export interface Draft {
  gesture: Gesture;
  passage: Passage;
}

/** Link waiting for confirmation, after the second click. */
export interface LinkDraft {
  fromId: string;
  toId: string;
  place: LinkPlace;
  /** Words between the two passages when they share a sentence. */
  label: string;
  /** Highlight of each element the link was drawn from, by element id. */
  anchorsByElement?: Record<string, string>;
}

interface Props {
  ctx: DocumentContext;
  elementId: string | null;
  draft: Draft | null;
  linkDraft: LinkDraft | null;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onElementChange: (elementId: string | null) => void;
  onDraftDone: () => void;
  onLinkDone: () => void;
  /** Link shown instead of an element, as ZN's panel does. */
  linkId: string | null;
  /** Orphan highlight being reattached. */
  orphanId: string | null;
  onOpenLink: (linkId: string) => void;
  onGoto: (annotation: Annotation) => void;
  onReveal: (elementId: string) => void;
  /** Opens the element in ZN's panel, whose location section has the map picker. */
  onPickOnMap: (elementId: string) => void;
}

/** Shared by the sheet's parts. */
interface Env {
  ctx: DocumentContext;
  elements: ZnElement[];
  links: ZnLink[];
  tagSets: ZnTagSet[];
  annotations: Annotation[];
  t: (key: string, opts?: Record<string, unknown>) => string;
  /** Runs a write, reports failures once. Resolves false on failure. */
  run: (write: () => Promise<unknown>) => Promise<boolean>;
}

function host() {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  return { api, React, h: React.createElement };
}

function tagColor(tagSets: ZnTagSet[], tag: string): string | null {
  return tagSets.find((ts) => ts.name.toLowerCase() === tag.toLowerCase())?.defaultVisual.color ?? null;
}

function guessType(text: string): ZnPropertyType {
  const t = text.trim();
  if (/^https?:\/\/\S+$/i.test(t) || /^www\.\S+$/i.test(t)) return 'link';
  // A leading zero means an identifier (phone, postcode), not a quantity.
  if (/^-?(?:0|[1-9]\d{0,11})(?:[.,]\d+)?$/.test(t.replace(/\s/g, ''))) return 'number';
  const [date] = findDates(t);
  if (date && date.raw.length >= t.length * 0.6) return date.hasTime ? 'datetime' : 'date';
  return 'text';
}

function formatValue(value: ZnProperty['value']): string {
  if (value instanceof Date) return toDateInputValue(value);
  return value === null || value === undefined ? '' : String(value);
}

function parseValue(type: ZnPropertyType | undefined, raw: string): ZnProperty['value'] {
  if (type === 'date') return raw ? new Date(`${raw}T12:00:00`) : null;
  // "yyyy-mm-dd" or "yyyy-mm-ddThh:mm", in local time as ZN's panel does.
  if (type === 'datetime') return raw ? new Date(raw.includes('T') ? raw : `${raw}T00:00`) : null;
  if (type === 'number') return raw === '' ? null : Number(raw.replace(/\s/g, '').replace(',', '.'));
  return raw;
}

function timeOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Calls fn on Escape without letting the reader minimize. */
function escapeTo(fn: () => void) {
  return (e: ReactTypes.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      fn();
    }
  };
}

// ─── Accordion section ───────────────────────────────────────

function Section(p: { title: string; badge?: number; children?: ReactTypes.ReactNode }) {
  const { api, React, h } = host();
  const [open, setOpen] = React.useState(true);
  const { ChevronDown } = api.icons;
  return h('div', { className: S.SECTION },
    h('button', { type: 'button', onClick: () => setOpen(!open), className: S.SECTION_HEADER },
      h(ChevronDown, { size: 14, className: 'text-text-tertiary transition-transform duration-200', style: open ? undefined : { transform: 'rotate(-90deg)' } }),
      h('span', { className: S.SECTION_TITLE }, p.title),
      p.badge ? h('span', { className: S.SECTION_BADGE }, p.badge) : null),
    open ? h('div', { className: S.SECTION_BODY }, p.children) : null);
}

// ─── New element ─────────────────────────────────────────────

/** Color of a tag, chosen from ZN's palette or freely; applies to every element carrying the tag. */
function TagColorButton(p: { env: Env; tag: string }) {
  const { h } = host();
  return h(ColorDot, {
    color: tagColor(p.env.tagSets, p.tag),
    onChoose: (value: string | null) => p.env.run(() => graph.setTagColor(p.tag, value)),
  });
}

/**
 * Tags as in ZN's panel (TagsEditor): chips, an "Add" button opening an
 * input with the dossier's tags and TagSets, Enter to create a new one.
 * The color dot of each chip sets the tag color.
 */
function TagsEditor(p: { env: Env; tags: string[]; onChange: (tags: string[]) => void }) {
  const { api, React, h } = host();
  const { X, Plus, Check, Sparkles } = api.icons;
  const { env } = p;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [adding, setAdding] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(-1);
  const existingTags: string[] = api.stores.useDossierStore(
    (s: { currentDossier: { settings: { existingTags: string[] } } | null }) => s.currentDossier?.settings.existingTags ?? NO_TAGS,
  );
  const tagSetNames = new Set(env.tagSets.map((ts) => ts.name));
  const shortcut = new Map(getProfile().grid.map((g) => [g.tag, g.key]));
  const all = [...new Set([...getProfile().grid.map((g) => g.tag), ...tagSetNames, ...existingTags])].sort((a, b) => {
    // Profile tags first, in shortcut order; then alphabetical, as in ZN.
    const ka = shortcut.get(a);
    const kb = shortcut.get(b);
    if (ka && kb) return ka.localeCompare(kb);
    if (ka || kb) return ka ? -1 : 1;
    return a.localeCompare(b, 'fr');
  });
  const filtered = all.filter((tag) => !p.tags.includes(tag) && tag.toLowerCase().includes(value.toLowerCase()));
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  React.useLayoutEffect(() => {
    setRect(adding && open ? inputRef.current?.getBoundingClientRect() ?? null : null);
  }, [adding, open, value]);

  const add = (tag?: string) => {
    const name = (tag ?? value).trim();
    if (name && !p.tags.includes(name)) p.onChange([...p.tags, name]);
    setValue('');
    setIndex(-1);
    inputRef.current?.focus();
  };
  const close = () => {
    setValue('');
    setAdding(false);
    setOpen(false);
  };

  return h('div', { className: 'space-y-2' },
    h('div', { className: 'flex flex-wrap gap-1.5' },
      p.tags.map((tag) => {
        const iconName = env.tagSets.find((ts) => ts.name === tag)?.defaultVisual.icon;
        const Icon = iconName ? (api.icons as Record<string, ReactTypes.ElementType | undefined>)[iconName] : undefined;
        return h('span', { key: tag, className: S.TAG_CHIP },
          h(TagColorButton, { env, tag }),
          Icon ? h(Icon, { size: 12, className: 'text-text-tertiary' }) : null,
          tag,
          h('button', { type: 'button', onClick: () => p.onChange(p.tags.filter((x) => x !== tag)), className: 'hover:text-error focus:outline-none', 'aria-label': env.t('remove_tag', { tag }) },
            h(X, { size: 12 })));
      }),
      adding
        ? h('div', { className: 'flex items-center gap-1' },
            h('input', {
              ref: inputRef,
              type: 'text',
              value,
              autoFocus: true,
              placeholder: env.t('tag_placeholder'),
              className: 'px-2 py-0.5 text-xs bg-bg-secondary border border-border-default rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary',
              style: { minWidth: 120 },
              onFocus: () => setOpen(true),
              onBlur: () => setOpen(false),
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
                setValue(e.target.value);
                setOpen(true);
                setIndex(-1);
              },
              onKeyDown: (e: ReactTypes.KeyboardEvent) => {
                if (e.key === 'Enter') {
                  // Not the surrounding form's submit.
                  e.preventDefault();
                  e.stopPropagation();
                  add(index >= 0 ? filtered[index] : undefined);
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  close();
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setIndex(Math.min(index + 1, filtered.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setIndex(Math.max(index - 1, -1));
                }
              },
            }),
            h('button', {
              type: 'button',
              onClick: () => add(),
              disabled: !value.trim(),
              title: env.t('tag_add'),
              className: 'p-1 text-text-tertiary hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors',
            }, h(Check, { size: 14 })),
            rect
              ? h('div', {
                  className: 'fixed bg-bg-primary border border-border-default rounded shadow-lg z-[9999] max-h-48 overflow-y-auto',
                  style: { top: rect.bottom + 4, left: rect.left, minWidth: Math.max(rect.width, 180) },
                },
                filtered.length
                  ? filtered.map((tag, i) =>
                      h('button', {
                        key: tag,
                        type: 'button',
                        onMouseDown: (e: ReactTypes.MouseEvent) => {
                          e.preventDefault();
                          add(tag);
                        },
                        className: `w-full px-2 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center gap-2 ${i === index ? 'bg-bg-secondary' : ''}`,
                      },
                      h('span', { className: 'inline-block rounded-full shrink-0', style: { width: 8, height: 8, background: tagColor(env.tagSets, tag) ?? 'var(--color-border-strong)' } }),
                      h('span', { className: 'flex-1', title: shortcut.has(tag) ? `Alt+${shortcut.get(tag)}` : undefined }, tag),
                      tagSetNames.has(tag) ? h(Sparkles, { size: 10, className: 'text-accent shrink-0' }) : null))
                  : h('div', { className: 'px-2 py-1.5 text-xs text-text-tertiary' },
                      value.trim() ? env.t('tag_enter_to_create', { value: value.trim() }) : env.t('tag_type_to_filter')))
              : null)
        : h('button', {
            type: 'button',
            onClick: () => {
              setAdding(true);
              setOpen(true);
            },
            className: 'inline-flex items-center gap-1 px-2 py-0.5 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary rounded border border-dashed border-border-default',
          }, h(Plus, { size: 12 }), env.t('tag_add'))),
    !p.tags.length && !adding ? h('p', { className: 'text-xs text-text-tertiary' }, env.t('no_tags')) : null);
}

const NO_TAGS: string[] = [];

/**
 * Image of a scanned passage, to correct the reading in the form's fields.
 * Shown only when it helps: a word read with low confidence, or a framed
 * passage (handwriting, stamp), where the image is the only reference.
 */
function OcrPreview(p: { passage: Passage }) {
  const { h } = host();
  const preview = p.passage.preview;
  if (!preview) return null;
  const doubtful = preview.lines.some((line) => line.some((w) => w.c < LOW_CONFIDENCE));
  if (!doubtful && !preview.framed) return null;
  return h('img', {
    src: preview.image,
    alt: '',
    className: 'w-full rounded border border-border-default bg-white',
    style: { maxHeight: 140, objectFit: 'contain', objectPosition: 'left' },
  });
}

/** Identifies a passage for form keys: its text offsets, or its box for an OCR zone. */
const passageKey = (p: Passage) => `${p.page}-${(p.textRange ?? p.quads[0] ?? []).join('-')}`;

/** A check digit that fails, or characters typical of OCR confusions: probable misreading. */
function ChecksumWarning(p: { env: Env; passage: Passage }) {
  const { h } = host();
  const found = extractPatterns(p.passage.text);
  const invalid = p.passage.suggestion?.checksumOk === false || found.some((m) => m.checksumOk === false);
  const suspect = p.passage.suggestion?.suspect || found.some((m) => m.suspect);
  if (!invalid && !suspect) return null;
  return h('p', { className: 'text-[10px] text-warning' }, p.env.t(invalid ? 'checksum_invalid' : 'misread_suspect'));
}

function NewElementForm(p: { env: Env; passage: Passage; onCreated: (id: string) => void; onCancel: () => void }) {
  const { React, h } = host();
  const { env, passage } = p;
  const [label, setLabel] = React.useState(() => {
    const text = trimPunctuation(passage.text);
    return getSettings().labels.uppercase ? text.toLocaleUpperCase('fr') : text;
  });
  const [tags, setTags] = React.useState<string[]>(() => {
    const tag = passage.suggestion && getProfile().suggestionTags[passage.suggestion.kind];
    return tag ? [tag] : [];
  });
  const [busy, setBusy] = React.useState(false);

  const candidates = React.useMemo(() => {
    const named = env.elements.map((el) => ({
      id: el.id,
      label: el.label,
      aliases: el.properties
        .filter((pr) => getProfile().aliasKeys.some((k) => k.toLowerCase() === pr.key.toLowerCase()) && typeof pr.value === 'string')
        .map((pr) => pr.value as string),
    }));
    return findCandidates(label, named).slice(0, 5);
  }, [label, env.elements]);
  const attachTo = defaultAttachment(candidates);
  const kindLabel: Record<MatchKind, string> = {
    exact: env.t('match_exact'),
    reordered: env.t('match_reordered'),
    initials: env.t('match_initials'),
  };

  const toggle = (tag: string) => setTags(tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag]);
  const create = async () => {
    setBusy(true);
    let id = '';
    if (await env.run(async () => { id = await qualifyAsNewElement(env.ctx, passage, label.trim(), tags); })) p.onCreated(id);
    else setBusy(false);
  };
  const attach = async (elementId: string) => {
    setBusy(true);
    if (await env.run(() => qualifyAsExistingElement(env.ctx, passage, elementId))) p.onCreated(elementId);
    else setBusy(false);
  };

  return h('form', {
    className: 'space-y-4',
    onSubmit: (e: ReactTypes.FormEvent) => {
      e.preventDefault();
      // Enter always creates: attaching is a click on a candidate.
      if (!label.trim() || busy) return;
      create();
    },
    onKeyDown: (e: ReactTypes.KeyboardEvent) => {
      escapeTo(p.onCancel)(e);
      const g = e.altKey ? getProfile().grid.find((x) => x.key === e.key) : undefined;
      if (g) {
        e.preventDefault();
        toggle(g.tag);
      }
    },
  },
  h(OcrPreview, { passage }),
  h('div', { className: 'space-y-1.5' },
    h('label', { className: S.LABEL }, env.t('field_label')),
    h('input', { className: S.INPUT, value: label, autoFocus: true, onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value) }),
    h(ChecksumWarning, { env, passage })),
  h('div', { className: 'space-y-1.5' },
    h('label', { className: S.LABEL }, env.t('field_tags')),
    h(TagsEditor, { env, tags, onChange: setTags })),
  candidates.length
    ? h('div', { className: 'space-y-1.5' },
        h('label', { className: S.LABEL }, env.t('candidates_title')),
        candidates.map((c) => {
          const el = env.elements.find((x) => x.id === c.elementId)!;
          const details = [...el.tags, ...el.properties.slice(0, 2).map((pr) => `${pr.key} : ${pr.value instanceof Date ? pr.value.toLocaleDateString('fr-FR') : String(pr.value)}`)];
          return h('div', { key: c.elementId, className: `flex items-center gap-2 px-2 py-1.5 rounded border ${c.elementId === attachTo ? 'border-accent' : 'border-border-default'}` },
            h('div', { className: 'flex-1 min-w-0' },
              h('div', { className: 'text-xs font-medium text-text-primary truncate' }, el.label),
              h('div', { className: `${S.HINT} truncate` }, [kindLabel[c.kind], ...details].join(' · '))),
            h('button', { type: 'button', disabled: busy, onClick: () => attach(c.elementId), className: `${S.BUTTON_GHOST_SMALL} shrink-0` }, env.t('attach')));
        }))
    : null,
  h('div', { className: S.BUTTON_ROW },
    h('button', { type: 'button', onClick: p.onCancel, className: S.BUTTON_SECONDARY_SMALL }, env.t('cancel')),
    h('button', { type: 'submit', disabled: busy || !label.trim(), className: S.BUTTON_PRIMARY_SMALL }, env.t('create'))));
}

// ─── Drafts in sections ──────────────────────────────────────

/**
 * Property key field with ZN's suggestion list (PropertiesEditor): fixed
 * dropdown under the input, key and type per row, arrows to move, Enter to
 * pick. Keys already on the element are not offered.
 */
function KeySuggestInput(p: {
  env: Env;
  value: string;
  suggestions: Map<string, ZnPropertyType>;
  exclude: string[];
  onChange: (key: string) => void;
}) {
  const { React, h } = host();
  const { env } = p;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(true);
  const [index, setIndex] = React.useState(-1);
  const filtered = [...p.suggestions.entries()]
    .filter(([key]) => !p.exclude.includes(key) && key.toLowerCase().includes(p.value.toLowerCase()))
    .slice(0, 50);
  const show = open && p.suggestions.size > 0;
  // Position read after mount: on the first render the input does not exist yet.
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  React.useLayoutEffect(() => {
    setRect(show ? inputRef.current?.getBoundingClientRect() ?? null : null);
  }, [show, p.value]);

  const pick = (key: string) => {
    p.onChange(key);
    setOpen(false);
    setIndex(-1);
  };

  return h(React.Fragment, null,
    h('input', {
      ref: inputRef,
      className: S.INPUT_IN_CARD,
      value: p.value,
      autoFocus: true,
      'aria-label': env.t('field_key'),
      onFocus: () => setOpen(true),
      onBlur: () => setOpen(false),
      onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
        p.onChange(e.target.value);
        setOpen(true);
        setIndex(-1);
      },
      onKeyDown: (e: ReactTypes.KeyboardEvent) => {
        if (!show) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setIndex(Math.min(index + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setIndex(Math.max(index - 1, -1));
        } else if (e.key === 'Enter' && index >= 0 && filtered[index]) {
          e.preventDefault();
          pick(filtered[index][0]);
        } else if (e.key === 'Escape') {
          // First Escape closes the list, the next one cancels the draft.
          e.stopPropagation();
          setOpen(false);
        }
      },
    }),
    show && rect
      ? h('div', {
          className: 'fixed bg-bg-primary border border-border-default rounded shadow-lg z-[9999] max-h-48 overflow-y-auto',
          style: { top: rect.bottom + 4, left: rect.left, minWidth: rect.width },
        },
        filtered.length
          ? filtered.map(([key, type], i) =>
              h('button', {
                key,
                type: 'button',
                // mousedown, not click: the input would blur and close the list first.
                onMouseDown: (e: ReactTypes.MouseEvent) => {
                  e.preventDefault();
                  pick(key);
                },
                className: `w-full px-2 py-1.5 text-xs text-left hover:bg-bg-secondary flex items-center justify-between ${i === index ? 'bg-bg-secondary' : ''}`,
              },
              h('span', null, key),
              h('span', { className: 'text-text-tertiary text-[10px]' }, env.t(`type_${type}`))))
          : h('div', { className: 'px-2 py-1.5 text-xs text-text-tertiary' }, env.t('no_key_match')))
      : null);
}

function PropertyDraft(p: { env: Env; element: ZnElement; passage: Passage; onDone: () => void }) {
  const { React, h } = host();
  const { env, element, passage } = p;
  const suggested = React.useMemo(() => {
    const keys = new Map<string, ZnPropertyType>();
    for (const tag of element.tags) {
      for (const sp of env.tagSets.find((ts) => ts.name === tag)?.suggestedProperties ?? []) keys.set(sp.key, sp.type);
    }
    for (const el of env.elements) for (const pr of el.properties) if (!keys.has(pr.key)) keys.set(pr.key, pr.type ?? 'text');
    return keys;
  }, [element, env.elements, env.tagSets]);
  const [key, setKey] = React.useState((passage.suggestion && getProfile().suggestionKeys[passage.suggestion.kind]) ?? '');
  const [type, setType] = React.useState<ZnPropertyType>(guessType(trimPunctuation(passage.text)));
  const firstDate = React.useMemo(() => findDates(passage.text, passage.referenceYear)[0], [passage]);
  const [value, setValue] = React.useState(() => {
    const guessed = guessType(passage.text);
    if (guessed !== 'date' && guessed !== 'datetime') return trimPunctuation(passage.text);
    return firstDate ? toDateInputValue(firstDate.date) : '';
  });
  const [time, setTime] = React.useState(() => (firstDate?.hasTime ? timeOf(firstDate.date) : ''));
  const [busy, setBusy] = React.useState(false);

  const onKeyChange = (next: string) => {
    setKey(next);
    const known = suggested.get(next);
    if (known === 'text' || known === 'number' || known === 'date' || known === 'datetime' || known === 'link') setType(known);
  };
  const valid = key.trim() && value.trim();
  const submit = async () => {
    setBusy(true);
    const ok = await env.run(() => qualifyAsProperty(env.ctx, passage, element.id, { key: key.trim(), value: parseValue(type, type === 'datetime' ? `${value.trim()}T${time || '00:00'}` : value.trim()), type }));
    if (ok) p.onDone();
    else setBusy(false);
  };

  return h('form', {
    className: S.CARD,
    onSubmit: (e: ReactTypes.FormEvent) => {
      e.preventDefault();
      if (valid && !busy) submit();
    },
    onKeyDown: escapeTo(p.onDone),
  },
  h(OcrPreview, { passage }),
  h('div', { className: 'space-y-1' },
    h('label', { className: S.SMALL_LABEL }, env.t('field_key')),
    h(KeySuggestInput, { env, value: key, suggestions: suggested, exclude: element.properties.map((pr) => pr.key), onChange: onKeyChange })),
  h('div', { className: 'flex gap-2' },
    h('div', { className: 'space-y-1 flex-1' },
      h('label', { className: S.SMALL_LABEL }, env.t('field_value')),
      h('div', { className: 'flex gap-1' },
        h('input', { type: type === 'date' || type === 'datetime' ? 'date' : 'text', className: S.INPUT_IN_CARD, value, 'aria-label': env.t('field_value'), onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setValue(e.target.value) }),
        type === 'datetime'
          ? h('input', { type: 'time', className: S.INPUT_IN_CARD, style: { width: 90 }, value: time, 'aria-label': env.t('field_time'), onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setTime(e.target.value) })
          : null),
      h(ChecksumWarning, { env, passage })),
    h('div', { className: 'space-y-1', style: { width: 96 } },
      h('label', { className: S.SMALL_LABEL }, env.t('field_type')),
      h('select', { className: S.INPUT_IN_CARD, value: type, onChange: (e: ReactTypes.ChangeEvent<HTMLSelectElement>) => setType(e.target.value as ZnPropertyType) },
        (['text', 'number', 'date', 'datetime', 'link'] as ZnPropertyType[]).map((tp) => h('option', { key: tp, value: tp }, env.t(`type_${tp}`)))))),
  h('div', { className: S.BUTTON_ROW },
    h('button', { type: 'button', onClick: p.onDone, className: S.BUTTON_SECONDARY_SMALL }, env.t('cancel')),
    h('button', { type: 'submit', disabled: busy || !valid, className: S.BUTTON_PRIMARY_SMALL }, env.t('add_property'))));
}

function EventDraft(p: { env: Env; element: ZnElement; passage: Passage; onDone: () => void }) {
  const { React, h } = host();
  const { env, element, passage } = p;
  const dates = React.useMemo(() => {
    const own = findDates(passage.text, passage.referenceYear);
    return own.length ? own : findDates(passage.context ?? '', passage.referenceYear);
  }, [passage]);
  // Elements qualified in the same sentence are proposed and checked.
  const sameSentence = React.useMemo(() => {
    const range = passage.sentenceRange;
    if (!range) return [] as string[];
    const ids = env.annotations
      .filter((a) => a.page === passage.page && a.kind === 'element' && a.targetId && a.textRange)
      .filter((a) => a.textRange![0] >= range[0] && a.textRange![1] <= range[1])
      .map((a) => a.targetId!);
    return [...new Set(ids)].filter((id) => env.elements.some((el) => el.id === id));
  }, [passage, env.annotations, env.elements]);
  const initial = [...new Set([element.id, ...sameSentence])];
  const [label, setLabel] = React.useState(passage.text);
  const [day, setDay] = React.useState(dates[0] ? toDateInputValue(dates[0].date) : '');
  const [time, setTime] = React.useState(dates[0]?.hasTime ? timeOf(dates[0].date) : '');
  const [checked, setChecked] = React.useState<string[]>(initial);
  const [extra, setExtra] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [geo, setGeo] = React.useState<ZnGeo | null>(null);
  const listed = [...new Set([...initial, ...extra])];

  const toggle = (id: string) => setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]);
  const valid = label.trim() && day && checked.length > 0;
  const submit = async () => {
    setBusy(true);
    const date = new Date(`${day}T${time || '12:00'}:00`);
    const event = { date, label: label.trim(), ...(passage.context ? { description: passage.context } : {}), ...(geo ? { geo } : {}) };
    // The current element first: it stays the active one.
    const ordered = [element.id, ...checked.filter((id) => id !== element.id)].filter((id) => checked.includes(id));
    const ok = await env.run(() => qualifyAsEvent(env.ctx, passage, ordered, event));
    if (ok) p.onDone();
    else setBusy(false);
  };

  return h('form', {
    className: S.CARD,
    onSubmit: (e: ReactTypes.FormEvent) => {
      e.preventDefault();
      if (valid && !busy) submit();
    },
    onKeyDown: escapeTo(p.onDone),
  },
  h(OcrPreview, { passage }),
  h('input', { className: S.INPUT_IN_CARD, value: label, autoFocus: true, 'aria-label': env.t('field_event_label'), onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value) }),
  h('div', { className: 'flex items-center gap-2' },
    h('input', { type: 'date', className: S.INPUT_IN_CARD, value: day, 'aria-label': env.t('field_date'), onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setDay(e.target.value) }),
    h('input', { type: 'time', className: S.INPUT_IN_CARD, style: { width: 90 }, value: time, 'aria-label': env.t('field_time'), onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setTime(e.target.value) })),
  dates[0] && !dates[0].hasYear ? h('p', { className: 'text-[10px] text-warning' }, env.t('year_assumed')) : null,
  !dates.length ? h('p', { className: S.HINT }, env.t('no_date_found')) : null,
  h('div', { className: 'space-y-1' },
    h('label', { className: S.SMALL_LABEL }, env.t('field_event_place')),
    h(GeoFields, { env, geo, mapButton: true, inputClass: S.INPUT_IN_CARD, onChange: setGeo })),
  h('div', { className: 'space-y-1' },
    h('label', { className: S.SMALL_LABEL }, env.t('field_event_elements')),
    listed.map((id) =>
      h('label', { key: id, className: 'flex items-center gap-2 text-xs text-text-primary' },
        h('input', { type: 'checkbox', checked: checked.includes(id), onChange: () => toggle(id) }),
        env.elements.find((el) => el.id === id)?.label ?? id)),
    h('select', {
      className: S.INPUT_IN_CARD,
      value: '',
      onChange: (e: ReactTypes.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        if (!id) return;
        setExtra([...extra, id]);
        if (!checked.includes(id)) setChecked([...checked, id]);
      },
    },
    h('option', { value: '' }, env.t('add_element')),
    env.elements.filter((el) => !listed.includes(el.id)).map((el) => h('option', { key: el.id, value: el.id }, el.label)))),
  h('div', { className: S.BUTTON_ROW },
    h('button', { type: 'button', onClick: p.onDone, className: S.BUTTON_SECONDARY_SMALL }, env.t('cancel')),
    h('button', { type: 'submit', disabled: busy || !valid, className: S.BUTTON_PRIMARY_SMALL }, env.t('add_event'))));
}

/**
 * Address read in the document: ZN's map opens with the address in its
 * search field; confirming a point locates the element and keeps the anchor.
 * Coordinates can also be typed when the map is not wanted.
 */
function LocationDraft(p: { env: Env; element: ZnElement; passage: Passage; onDone: () => void }) {
  const { React, h } = host();
  const { env, element, passage } = p;
  const [geo, setGeo] = React.useState<ZnGeo | null>(null);
  const [busy, setBusy] = React.useState(false);
  const query = trimPunctuation(passage.text);

  const save = async (value: ZnGeo) => {
    setBusy(true);
    if (await env.run(() => qualifyAsLocation(env.ctx, passage, element.id, value))) p.onDone();
    else setBusy(false);
  };
  const pick = async () => {
    const chosen = await pickOnMap(undefined, query);
    if (chosen) save({ type: 'point', lat: chosen.lat, lng: chosen.lng });
  };
  // The map is the usual way: open it right away.
  React.useEffect(() => {
    if (canPickOnMap()) pick();
  }, []);

  return h('div', { className: S.CARD, onKeyDown: escapeTo(p.onDone) },
    h(OcrPreview, { passage: p.passage }),
    h('p', { className: 'text-xs text-text-primary' }, `« ${query} »`),
    canPickOnMap()
      ? h('button', {
          type: 'button',
          onClick: pick,
          disabled: busy,
          className: `${S.BUTTON_SECONDARY_SMALL} w-full`,
        }, h(getHostAPI().icons.MapPin, { size: 12 }), env.t('geo_pick'))
      : null,
    h('label', { className: S.SMALL_LABEL }, env.t('geo_coordinates')),
    h(GeoFields, { env, geo, inputClass: S.INPUT_IN_CARD, onChange: setGeo }),
    h('div', { className: S.BUTTON_ROW },
      h('button', { type: 'button', onClick: p.onDone, className: S.BUTTON_SECONDARY_SMALL }, env.t('cancel')),
      h('button', { type: 'button', disabled: busy || !geo, onClick: () => geo && save(geo), className: S.BUTTON_PRIMARY_SMALL }, env.t('add_location'))));
}

// ─── Existing values ─────────────────────────────────────────

/**
 * Latitude and longitude, written together when both are valid, cleared
 * when both are emptied. A zone drawn in ZN is shown, not edited here.
 */
function GeoFields(p: {
  env: Env;
  geo: ZnGeo | null | undefined;
  inputClass: string;
  onChange: (geo: ZnGeo | null) => void;
  /** Small map button next to the fields (events); the element has a full button. */
  mapButton?: boolean;
}) {
  const { React, h } = host();
  const { env, geo } = p;
  const point = geo?.type === 'point' ? geo : null;
  const [lat, setLat] = React.useState(point ? formatCoordinate(point.lat) : '');
  const [lng, setLng] = React.useState(point ? formatCoordinate(point.lng) : '');
  React.useEffect(() => {
    setLat(point ? formatCoordinate(point.lat) : '');
    setLng(point ? formatCoordinate(point.lng) : '');
  }, [point?.lat, point?.lng]);

  if (geo?.type === 'polygon') {
    return h('p', { className: S.HINT }, env.t('geo_zone', { lat: formatCoordinate(geo.center.lat), lng: formatCoordinate(geo.center.lng) }));
  }

  const commit = () => {
    if (!lat.trim() && !lng.trim()) {
      if (point) p.onChange(null);
      return;
    }
    if (!lat.trim() || !lng.trim()) return; // wait for the other value
    const value = parseLatLng(lat, lng);
    if (!value) {
      getHostAPI().toast.warning(env.t('geo_invalid'));
      return;
    }
    if (point && point.lat === value.lat && point.lng === value.lng) return;
    p.onChange({ ...(point ?? {}), type: 'point', lat: value.lat, lng: value.lng });
  };
  const field = (value: string, set: (v: string) => void, label: string, hint: string) =>
    h('div', { className: 'flex-1 min-w-0' },
      h('input', {
        className: p.inputClass,
        value,
        inputMode: 'decimal',
        placeholder: label,
        'aria-label': label,
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => set(e.target.value),
        onBlur: commit,
        onKeyDown: (e: ReactTypes.KeyboardEvent) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        },
      }),
      h('span', { className: S.HINT }, hint));
  const pick = async () => {
    const chosen = await pickOnMap(point ? { lat: point.lat, lng: point.lng } : undefined);
    if (chosen) p.onChange({ ...(point ?? {}), type: 'point', lat: chosen.lat, lng: chosen.lng });
  };
  return h('div', { className: 'flex gap-2' },
    field(lat, setLat, env.t('geo_lat'), env.t('geo_lat_range')),
    field(lng, setLng, env.t('geo_lng'), env.t('geo_lng_range')),
    p.mapButton && canPickOnMap()
      ? h('button', { type: 'button', onClick: pick, title: env.t('geo_pick'), className: `${S.ICON_BUTTON_ACCENT} self-start` },
          h(getHostAPI().icons.MapPin, { size: 14 }))
      : null);
}


/** Input that writes on blur or Enter, and follows external changes otherwise. */
function CommitInput(p: { value: string; type?: string; className: string; ariaLabel: string; onCommit: (value: string) => void }) {
  const { React, h } = host();
  const [value, setValue] = React.useState(p.value);
  React.useEffect(() => setValue(p.value), [p.value]);
  const commit = () => {
    if (value !== p.value) p.onCommit(value);
  };
  return h('input', {
    type: p.type ?? 'text',
    className: p.className,
    value,
    'aria-label': p.ariaLabel,
    onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
    onBlur: commit,
    onKeyDown: (e: ReactTypes.KeyboardEvent) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      escapeTo(() => setValue(p.value))(e);
    },
  });
}

// ─── Evaluation ──────────────────────────────────────────────

type EvaluationChanges = { confidence?: number | null; evaluation?: Evaluation | null };

/**
 * Confidence or grading, following the dossier's model as ZN's panel does
 * (EvaluationInput). The grading labels come from ZN's own translations.
 */
function EvaluationFields(p: {
  env: Env;
  confidence: number | null | undefined;
  evaluation: Evaluation | null | undefined;
  onChange: (changes: EvaluationChanges) => void;
}) {
  const { api, h } = host();
  const { env } = p;
  const model: EvaluationModel = api.stores.useDossierStore((s: { currentDossier: { evaluationModel?: unknown } | null }) => evaluationModelOf(s.currentDossier));
  const clearButton = (onClick: () => void) =>
    h('button', { type: 'button', onClick, className: 'px-1.5 py-0.5 text-xs text-text-secondary border border-border-default rounded hover:bg-bg-secondary' }, env.t('evaluation_clear'));

  if (model === 'zeroneurone') {
    const confidence = p.confidence ?? null;
    return h('div', { className: 'space-y-1.5' },
      h('div', { className: 'flex items-center justify-between' },
        h('label', { className: S.LABEL }, env.t('field_confidence')),
        h('span', { className: 'flex items-center gap-2 text-xs text-text-tertiary' },
          confidence !== null ? `${confidence} %` : env.t('confidence_unset'),
          confidence !== null ? clearButton(() => p.onChange({ confidence: null })) : null)),
      h('input', {
        type: 'range',
        min: 0,
        max: 100,
        step: 10,
        value: confidence ?? 50,
        'aria-label': env.t('field_confidence'),
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => p.onChange({ confidence: Math.round(Number(e.target.value) / 10) * 10 }),
        className: 'w-full h-1.5 bg-bg-tertiary rounded appearance-none cursor-pointer accent-accent',
      }));
  }

  const zn = (key: string, opts?: Record<string, unknown>) => api.i18n.t(`evaluation.${key}`, { ns: 'common', ...opts });
  const scale = model;
  const grid = EVALUATION_GRIDS[scale];
  const value = p.evaluation ?? null;
  const current = value?.scale === scale ? value : null;
  const axis = (name: 'source' | 'info', codes: readonly string[], label: string) => {
    const plural = name === 'source' ? 'sources' : 'infos';
    const code = current?.[name] ?? '';
    return h('div', { className: 'space-y-1' },
      h('label', { className: S.LABEL }, label),
      h('select', {
        className: S.INPUT,
        value: code,
        title: code ? zn(`${scale}.${plural}Help.${code}`) : undefined,
        onChange: (e: ReactTypes.ChangeEvent<HTMLSelectElement>) => p.onChange({ evaluation: withAxis(value, scale, name, e.target.value) }),
      },
      h('option', { value: '' }, zn('notGraded')),
      codes.map((c) => h('option', { key: c, value: c }, env.t('evaluation_option', { code: c, label: zn(`${scale}.${plural}.${c}`) })))));
  };

  return h('div', { className: 'space-y-2' },
    value && !current
      ? h('div', { className: 'flex items-center justify-between gap-2 text-xs text-text-tertiary' },
          h('span', null, zn('outOfModel', { scale: zn(`scales.${value.scale}`), code: formatEvaluation(value) })),
          clearButton(() => p.onChange({ evaluation: null })))
      : null,
    axis('source', grid.sources, zn('sourceLabel')),
    axis('info', grid.infos, zn('infoLabel')));
}

function AnchorButton(p: { env: Env; annotation: Annotation | undefined; onGoto: (a: Annotation) => void }) {
  const { api, h } = host();
  if (!p.annotation) return null;
  const { Highlighter } = api.icons;
  const a = p.annotation;
  return h('button', { type: 'button', onClick: () => p.onGoto(a), title: isPdf(p.env.ctx.asset) ? p.env.t('goto_passage', { page: a.page }) : p.env.t('goto_passage_text'), className: S.ICON_BUTTON_ACCENT },
    h(Highlighter, { size: 12 }));
}

function PropertyRows(p: { env: Env; element: ZnElement; onGoto: (a: Annotation) => void }) {
  const { api, h } = host();
  const { X } = api.icons;
  const { env, element } = p;
  if (!element.properties.length) return h('p', { className: 'text-xs text-text-tertiary' }, env.t('no_properties'));

  const update = (index: number, raw: string) => {
    const properties = element.properties.map((pr, i) => (i === index ? { ...pr, value: parseValue(pr.type, raw) } : pr));
    env.run(() => graph.updateElement(element.id, { properties }));
  };
  const remove = (index: number) => {
    const key = element.properties[index].key;
    const properties = element.properties.filter((_, i) => i !== index);
    env.run(async () => {
      await graph.updateElement(element.id, { properties });
      // Highlights of a key that no longer exists on the element go too.
      if (!properties.some((pr) => pr.key === key)) {
        for (const a of env.annotations.filter((x) => x.kind === 'property' && x.targetId === element.id && x.propertyKey === key)) {
          await deleteAnnotation(env.ctx, a);
        }
      }
    });
  };

  return h('div', { className: 'space-y-2' },
    element.properties.map((pr, i) => {
      const type = pr.type ?? 'text';
      const annotation = env.annotations.find((a) => a.kind === 'property' && a.targetId === element.id && a.propertyKey === pr.key);
      return h('div', { key: `${pr.key}-${i}`, className: 'flex items-start gap-2' },
        h('div', { className: 'flex-1 min-w-0' },
          h('div', { className: 'flex items-center gap-1.5' },
            h('span', { className: 'text-xs font-medium text-text-secondary truncate' }, pr.key),
            h('span', { className: S.TYPE_BADGE }, env.t(`type_${type}`))),
          type === 'text' || type === 'number' || type === 'date' || type === 'link'
            ? h('div', { className: 'mt-1' },
                h(CommitInput, {
                  type: type === 'date' ? 'date' : 'text',
                  className: S.INPUT_COMPACT,
                  value: formatValue(pr.value),
                  ariaLabel: pr.key,
                  onCommit: (v: string) => update(i, v),
                }))
            : h('div', { className: 'mt-1 text-xs text-text-primary' }, formatValue(pr.value))),
        h(AnchorButton, { env, annotation, onGoto: p.onGoto }),
        h('button', { type: 'button', onClick: () => remove(i), title: env.t('delete_property'), className: S.ICON_BUTTON_DANGER }, h(X, { size: 12 })));
    }));
}

function EventRows(p: { env: Env; element: ZnElement; onGoto: (a: Annotation) => void }) {
  const { api, h } = host();
  const { Calendar, X } = api.icons;
  const { env, element } = p;
  if (!element.events.length) return h('p', { className: 'text-xs text-text-tertiary' }, env.t('no_events'));

  const sorted = [...element.events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const update = (id: string, changes: Partial<ZnElementEvent>) => {
    const events = element.events.map((ev) => (ev.id === id ? { ...ev, ...changes } : ev));
    env.run(() => graph.updateElement(element.id, { events }));
  };
  const remove = (id: string) => {
    const events = element.events.filter((ev) => ev.id !== id);
    env.run(async () => {
      await graph.updateElement(element.id, { events });
      const a = env.annotations.find((x) => x.kind === 'event' && x.eventIds?.[element.id] === id);
      if (!a) return;
      const rest = Object.fromEntries(Object.entries(a.eventIds ?? {}).filter(([el]) => el !== element.id));
      if (Object.keys(rest).length === 0) await deleteAnnotation(env.ctx, a);
      else {
        await graph.detachAnchor(element.id, a.id);
        await saveAnnotation(env.ctx.dossierId, { ...a, eventIds: rest, targetId: Object.keys(rest)[0] });
      }
    });
  };

  return h('div', { className: 'space-y-2' },
    sorted.map((ev) => {
      const date = new Date(ev.date);
      const annotation = env.annotations.find((a) => a.kind === 'event' && a.eventIds?.[element.id] === ev.id);
      return h('div', { key: ev.id, className: S.CARD },
        h('div', { className: 'flex items-center gap-2' },
          h(CommitInput, { className: S.INPUT_IN_CARD, value: ev.label, ariaLabel: env.t('field_event_label'), onCommit: (v: string) => update(ev.id, { label: v }) }),
          h(AnchorButton, { env, annotation, onGoto: p.onGoto }),
          h('button', { type: 'button', onClick: () => remove(ev.id), title: env.t('delete_event'), className: S.ICON_BUTTON_DANGER }, h(X, { size: 12 }))),
        h('div', { className: 'flex items-center gap-2' },
          h(Calendar, { size: 12, className: 'text-text-tertiary shrink-0' }),
          h(CommitInput, {
            type: 'date',
            className: S.INPUT_IN_CARD,
            value: toDateInputValue(date),
            ariaLabel: env.t('field_date'),
            onCommit: (v: string) => v && update(ev.id, { date: new Date(`${v}T${timeOf(date)}:00`) }),
          }),
          h(CommitInput, {
            type: 'time',
            className: `${S.INPUT_IN_CARD} w-20`,
            value: timeOf(date),
            ariaLabel: env.t('field_time'),
            onCommit: (v: string) => update(ev.id, { date: new Date(`${toDateInputValue(date)}T${v || '12:00'}:00`) }),
          })),
        h('div', { className: 'flex items-start gap-2' },
          h(api.icons.MapPin, { size: 12, className: 'text-text-tertiary shrink-0 mt-1.5' }),
          h('div', { className: 'flex-1 min-w-0' },
            h(GeoFields, {
              env,
              geo: ev.geo,
              mapButton: true,
              inputClass: S.INPUT_IN_CARD,
              onChange: (geo: ZnGeo | null) => update(ev.id, { geo: geo ?? undefined }),
            }))));
    }));
}

function PassageRows(p: { env: Env; items: Annotation[]; selectedId: string | null; onGoto: (a: Annotation) => void }) {
  const { api, h } = host();
  const { Highlighter, Tag, Calendar, Trash2 } = api.icons;
  const { env } = p;
  const mine = [...p.items].sort((a, b) => a.page - b.page || (a.textRange?.[0] ?? 0) - (b.textRange?.[0] ?? 0));
  if (!mine.length) return h('p', { className: 'text-xs text-text-tertiary' }, env.t('no_passages'));
  const icons: Record<string, ReactTypes.ElementType> = { element: Highlighter, property: Tag, event: Calendar, location: api.icons.MapPin, link: api.icons.Link2 };
  return h('div', { className: 'space-y-1' },
    mine.map((a) =>
      h('div', {
        key: a.id,
        className: `flex items-center gap-2 px-2 py-1 rounded ${a.id === p.selectedId ? 'bg-accent/10 border border-accent/20' : 'hover:bg-bg-secondary'}`,
      },
      h(icons[a.kind] ?? Highlighter, { size: 12, className: 'text-text-tertiary shrink-0' }),
      h('button', { type: 'button', onClick: () => p.onGoto(a), className: 'flex-1 min-w-0 text-left' },
        h('span', { className: 'block text-xs text-text-primary truncate' }, a.text),
        h('span', { className: S.HINT }, [isPdf(env.ctx.asset) ? `p.${a.page}` : '', a.kind === 'property' ? a.propertyKey : ''].filter(Boolean).join(' · ') || null)),
      h('button', {
        type: 'button',
        onClick: () => env.run(() => deleteAnnotation(env.ctx, a)),
        title: env.t('delete_passage'),
        className: S.ICON_BUTTON_DANGER,
      }, h(Trash2, { size: 12 })))));
}

// ─── Links ───────────────────────────────────────────────────

function LinkForm(p: { env: Env; draft: LinkDraft; onDone: (fromId: string) => void; onCancel: () => void }) {
  const { api, React, h } = host();
  const { ArrowRight, ArrowLeftRight } = api.icons;
  const { env, draft } = p;
  const [fromId, setFromId] = React.useState(draft.fromId);
  const [toId, setToId] = React.useState(draft.toId);
  const [label, setLabel] = React.useState(draft.label);
  const [busy, setBusy] = React.useState(false);
  const name = (id: string) => env.elements.find((el) => el.id === id)?.label ?? id;
  const endField = (value: string) => h('span', { className: `${S.TAG_CHIP} truncate`, style: { maxWidth: 130 } }, name(value));

  const submit = async () => {
    setBusy(true);
    const anchors: [string | null, string | null] = [draft.anchorsByElement?.[fromId] ?? null, draft.anchorsByElement?.[toId] ?? null];
    if (await env.run(() => qualifyAsLink(env.ctx, draft.place, fromId, toId, label.trim(), anchors))) p.onDone(fromId);
    else setBusy(false);
  };

  return h('form', {
    className: 'space-y-4',
    onSubmit: (e: ReactTypes.FormEvent) => {
      e.preventDefault();
      if (!busy) submit();
    },
    onKeyDown: escapeTo(p.onCancel),
  },
  h('div', { className: 'space-y-1.5' },
    h('label', { className: S.LABEL }, env.t('field_link_ends')),
    h('div', { className: 'flex items-center gap-2' },
      endField(fromId),
      h(ArrowRight, { size: 14, className: 'text-text-tertiary shrink-0' }),
      endField(toId),
      h('button', {
        type: 'button',
        onClick: () => {
          setFromId(toId);
          setToId(fromId);
        },
        title: env.t('swap_direction'),
        className: `${S.ICON_BUTTON_ACCENT} ml-auto`,
      }, h(ArrowLeftRight, { size: 14 })))),
  h('div', { className: 'space-y-1.5' },
    h('label', { className: S.LABEL }, env.t('field_link_label')),
    h('input', { className: S.INPUT, value: label, autoFocus: true, onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value) })),
  h('div', { className: S.BUTTON_ROW },
    h('button', { type: 'button', onClick: p.onCancel, className: S.BUTTON_SECONDARY_SMALL }, env.t('cancel')),
    h('button', { type: 'submit', disabled: busy || fromId === toId, className: S.BUTTON_PRIMARY_SMALL }, env.t('create_link'))));
}

function LinkRows(p: { env: Env; element: ZnElement; onOpenLink: (linkId: string) => void }) {
  const { api, h } = host();
  const { ArrowRight, ArrowLeft } = api.icons;
  const { env, element } = p;
  const mine = env.links.filter((l) => l.fromId === element.id || l.toId === element.id);
  if (!mine.length) return h('p', { className: 'text-xs text-text-tertiary' }, env.t('no_links'));
  return h('div', { className: 'space-y-1' },
    mine.map((link) => {
      const outgoing = link.fromId === element.id;
      const other = env.elements.find((el) => el.id === (outgoing ? link.toId : link.fromId));
      return h('button', {
        key: link.id,
        type: 'button',
        onClick: () => p.onOpenLink(link.id),
        className: 'w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-bg-secondary',
      },
      h(outgoing ? ArrowRight : ArrowLeft, { size: 12, className: 'text-text-tertiary shrink-0' }),
      h('span', { className: 'flex-1 min-w-0' },
        h('span', { className: 'block text-xs font-medium text-text-primary truncate' }, other?.label ?? env.t('unnamed')),
        link.label ? h('span', { className: `block ${S.HINT} truncate` }, link.label) : null));
    }));
}

/** Sheet of a link, like ZN's link detail panel. */
function LinkSheet(p: {
  env: Env;
  link: ZnLink;
  selectedId: string | null;
  onOpenElement: (id: string) => void;
  onGoto: (a: Annotation) => void;
  onDeleted: (fromId: string) => void;
}) {
  const { api, React, h } = host();
  const { ArrowRight, ArrowLeftRight, Link2 } = api.icons;
  const { env, link } = p;
  const name = (id: string) => env.elements.find((el) => el.id === id)?.label ?? env.t('unnamed');
  const passages = env.annotations.filter((a) => a.kind === 'link' && a.targetId === link.id);
  const end = (id: string) =>
    h('button', {
      type: 'button',
      onClick: () => p.onOpenElement(id),
      className: `${S.TAG_CHIP} truncate hover:text-accent`,
      style: { maxWidth: 130 },
      title: env.t('open_element'),
    }, name(id));
  const swap = () => env.run(() => graph.updateLink(link.id, { fromId: link.toId, toId: link.fromId }));
  const remove = () =>
    env.run(async () => {
      for (const a of passages) await deleteAnnotation(env.ctx, a);
      await graph.deleteLink(link.id);
    }).then((ok) => ok && p.onDeleted(link.fromId));

  return h(React.Fragment, null,
    h('div', { className: 'flex items-center gap-2 px-4 py-3 border-b border-border-default' },
      h(Link2, { size: 14, className: 'text-text-tertiary shrink-0' }),
      h('span', { className: 'flex-1 text-sm font-semibold text-text-primary truncate' }, link.label || env.t('link_unnamed'))),
    h(Section, { title: env.t('section_link') },
      h('div', { className: 'space-y-4' },
        h('div', { className: 'space-y-1.5' },
          h('label', { className: S.LABEL }, env.t('field_link_ends')),
          h('div', { className: 'flex items-center gap-2' },
            end(link.fromId),
            h(ArrowRight, { size: 14, className: 'text-text-tertiary shrink-0' }),
            end(link.toId),
            h('button', { type: 'button', onClick: swap, title: env.t('swap_direction'), className: `${S.ICON_BUTTON_ACCENT} ml-auto` },
              h(ArrowLeftRight, { size: 14 })))),
        h('div', { className: 'space-y-1.5' },
          h('label', { className: S.LABEL }, env.t('field_link_label')),
          h(CommitInput, {
            className: S.INPUT,
            value: link.label,
            ariaLabel: env.t('field_link_label'),
            onCommit: (v: string) => env.run(() => graph.updateLink(link.id, { label: v })),
          })))),
    h(Section, { title: env.t('section_evaluation') },
      h(EvaluationFields, {
        env,
        confidence: link.confidence,
        evaluation: link.evaluation,
        onChange: (changes: EvaluationChanges) => env.run(() => graph.updateLink(link.id, changes)),
      })),
    h(Section, { title: env.t('section_passages'), badge: passages.length },
      h(PassageRows, { env, items: passages, selectedId: p.selectedId, onGoto: p.onGoto })),
    h('div', { className: 'px-4 py-3' },
      h('button', {
        type: 'button',
        onClick: remove,
        className: 'w-full px-2 py-1 text-xs font-medium text-error border border-border-default rounded hover:bg-bg-secondary',
      }, env.t('delete_link'))));
}

/** Element picker in a card (link ends, orphan reattachment). */
function ElementSelect(p: { env: Env; value: string; onChange: (id: string) => void }) {
  const { h } = host();
  return h(ElementPicker, { elements: p.env.elements, tagSets: p.env.tagSets, value: p.value || null, onChange: p.onChange, inputClass: S.INPUT_IN_CARD });
}

// ─── Elements of the document ────────────────────────────────

/**
 * With nothing selected: the elements highlighted in this document, in
 * reading order, with a search. A click shows the element and its first passage.
 */
function DocumentElements(p: { env: Env; onPick: (entry: IndexEntry) => void }) {
  const { React, h } = host();
  const { env } = p;
  const [query, setQuery] = React.useState('');
  const entries = React.useMemo(
    () =>
      documentIndex(env.annotations)
        .map((entry) => ({ entry, element: env.elements.find((el) => el.id === entry.elementId) }))
        .filter((x): x is { entry: IndexEntry; element: ZnElement } => !!x.element),
    [env.annotations, env.elements],
  );
  // The search keeps reading order; it only filters.
  const shown = React.useMemo(() => {
    if (!query.trim()) return entries;
    const found = new Set(searchElements(entries.map((x) => x.element), query, entries.length).map((hit) => hit.element.id));
    return entries.filter((x) => found.has(x.element.id));
  }, [entries, query]);
  const pdf = isPdf(env.ctx.asset);

  return h(React.Fragment, null,
    h('div', { className: 'flex items-center gap-2 px-4 py-3 border-b border-border-default' },
      h('span', { className: `${S.SECTION_TITLE}` }, env.t('index_title')),
      h('span', { className: S.SECTION_BADGE }, entries.length)),
    entries.length
      ? h('div', { className: 'sticky top-0 z-10 px-4 py-2 bg-bg-primary border-b border-border-default' },
          h('input', {
            type: 'search',
            value: query,
            placeholder: env.t('picker_placeholder'),
            'aria-label': env.t('picker_placeholder'),
            className: S.INPUT,
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
            onKeyDown: (e: ReactTypes.KeyboardEvent) => {
              if (e.key === 'Escape' && query) {
                e.stopPropagation();
                setQuery('');
              }
            },
          }))
      : null,
    entries.length
      ? shown.length
        ? h('div', { className: 'py-1' },
            shown.map(({ entry, element }) =>
              h('button', {
                key: element.id,
                type: 'button',
                onClick: () => p.onPick(entry),
                className: 'w-full flex items-start gap-2 px-4 py-2 text-left hover:bg-bg-secondary',
              },
                h('span', { className: 'inline-block rounded-full shrink-0 mt-1', style: { width: 10, height: 10, background: (element.tags[0] && tagColor(env.tagSets, element.tags[0])) || 'var(--color-border-strong)' } }),
                h('span', { className: 'min-w-0 flex-1' },
                  h('span', { className: 'block text-sm text-text-primary truncate' }, element.label || env.t('unnamed')),
                  h('span', { className: 'flex flex-wrap items-center gap-1 mt-0.5' },
                    h('span', { className: S.HINT }, [pdf ? `p.${entry.first.page}` : '', env.t('index_passages', { count: entry.count })].filter(Boolean).join(' · ')),
                    element.tags.slice(0, 2).map((tag) => h('span', { key: tag, className: 'text-[10px] px-1 py-0.5 bg-bg-tertiary rounded text-text-secondary' }, tag)))))))
        : h('p', { className: 'px-4 py-3 text-xs text-text-tertiary' }, env.t('picker_none'))
      : h('p', { className: 'px-4 py-3 text-xs text-text-tertiary' }, env.t('index_empty')));
}

// ─── Orphans ─────────────────────────────────────────────────

/**
 * A highlight whose object no longer exists. The user chooses where it goes;
 * candidates by name are shown, never applied.
 */
function OrphanSheet(p: {
  env: Env;
  annotation: Annotation;
  defaultElementId: string | null;
  onDone: (elementId: string) => void;
  onRemoved: () => void;
}) {
  const { api, React, h } = host();
  const { TriangleAlert, ArrowRight, ArrowLeftRight } = api.icons;
  const { env, annotation: a } = p;
  const exists = (id: string | null | undefined): id is string => !!id && env.elements.some((el) => el.id === id);
  const [elementId, setElementId] = React.useState(exists(p.defaultElementId) ? p.defaultElementId : '');
  const [busy, setBusy] = React.useState(false);
  // Event: the date read in the passage.
  const dates = React.useMemo(() => {
    const own = findDates(a.text);
    return own.length ? own : findDates(a.context ?? '');
  }, [a]);
  const [day, setDay] = React.useState(dates[0] ? toDateInputValue(dates[0].date) : '');
  const [time, setTime] = React.useState(dates[0]?.hasTime ? timeOf(dates[0].date) : '');
  // Link: previous ends when they still exist.
  const [fromId, setFromId] = React.useState(exists(a.linkEnds?.[0]) ? a.linkEnds![0] : '');
  const [toId, setToId] = React.useState(exists(a.linkEnds?.[1]) ? a.linkEnds![1] : '');
  const [linkLabel, setLinkLabel] = React.useState(a.quads.length ? a.text : '');
  // Property: recreate it when the chosen element does not have it.
  const target = env.elements.find((el) => el.id === elementId);
  const lacksKey = a.kind === 'property' && !!a.propertyKey && !!target && !target.properties.some((pr) => pr.key === a.propertyKey);
  const [recreate, setRecreate] = React.useState(true);

  const candidates = React.useMemo(() => {
    if (a.kind !== 'element' && a.kind !== 'location') return [];
    const named = env.elements.map((el) => ({ id: el.id, label: el.label, aliases: [] as string[] }));
    return findCandidates(trimPunctuation(a.text), named).slice(0, 5);
  }, [a, env.elements]);

  const run = async (write: () => Promise<unknown>, shown: string) => {
    setBusy(true);
    if (await env.run(write)) p.onDone(shown);
    else setBusy(false);
  };
  const submit = () => {
    if (a.kind === 'link') {
      if (fromId && toId && fromId !== toId) run(() => reattachLink(env.ctx, a, fromId, toId, linkLabel.trim()), fromId);
    } else if (a.kind === 'event') {
      if (elementId && day) run(() => reattachEvent(env.ctx, a, [elementId], new Date(`${day}T${time || '12:00'}:00`)), elementId);
    } else if (elementId) {
      const recreateProperty = lacksKey && recreate && a.propertyKey ? { key: a.propertyKey, value: trimPunctuation(a.text) } : undefined;
      run(() => reattachToElement(env.ctx, a, elementId, { recreateProperty }), elementId);
    }
  };
  const valid = a.kind === 'link' ? !!fromId && !!toId && fromId !== toId : a.kind === 'event' ? !!elementId && !!day : !!elementId;
  const kindLabel = a.kind === 'link' ? env.t('section_link') : env.t(`gesture_${a.kind}`);

  return h(React.Fragment, null,
    h('div', { className: 'flex items-center gap-2 px-4 py-3 border-b border-border-default' },
      h(TriangleAlert, { size: 14, className: 'text-warning shrink-0' }),
      h('span', { className: 'flex-1 text-sm font-semibold text-text-primary truncate' }, env.t('orphan_title'))),
    h(Section, { title: env.t('orphan_section') },
      h('form', {
        className: 'space-y-4',
        onSubmit: (e: ReactTypes.FormEvent) => {
          e.preventDefault();
          if (valid && !busy) submit();
        },
      },
      h('div', { className: 'space-y-1' },
        h('p', { className: 'text-xs text-text-primary' }, `« ${trimPunctuation(a.text)} »`),
        h('p', { className: S.HINT }, [kindLabel, isPdf(env.ctx.asset) ? `p.${a.page}` : '', a.propertyKey].filter(Boolean).join(' · ')),
        h('p', { className: 'text-xs text-text-secondary' }, env.t(`orphan_hint_${a.kind === 'link' || a.kind === 'event' ? a.kind : 'element'}`))),
      a.kind === 'link'
        ? h('div', { className: 'space-y-1.5' },
            h('label', { className: S.LABEL }, env.t('field_link_ends')),
            h('div', { className: 'flex items-center gap-2' },
              h('div', { className: 'flex-1 min-w-0' }, h(ElementSelect, { env, value: fromId, onChange: setFromId })),
              h(ArrowRight, { size: 14, className: 'text-text-tertiary shrink-0' }),
              h('div', { className: 'flex-1 min-w-0' }, h(ElementSelect, { env, value: toId, onChange: setToId })),
              h('button', { type: 'button', onClick: () => { setFromId(toId); setToId(fromId); }, title: env.t('swap_direction'), className: S.ICON_BUTTON_ACCENT },
                h(ArrowLeftRight, { size: 14 }))),
            h('label', { className: S.LABEL }, env.t('field_link_label')),
            h('input', { className: S.INPUT, value: linkLabel, onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setLinkLabel(e.target.value) }))
        : h('div', { className: 'space-y-1.5' },
            h('label', { className: S.LABEL }, env.t('field_element')),
            h(ElementSelect, { env, value: elementId, onChange: setElementId }),
            candidates.length
              ? h('div', { className: 'space-y-1' },
                  h('span', { className: S.HINT }, env.t('candidates_title')),
                  candidates.map((c) =>
                    h('button', {
                      key: c.elementId,
                      type: 'button',
                      onClick: () => setElementId(c.elementId),
                      className: `w-full flex items-center gap-2 px-2 py-1 rounded border text-left ${c.elementId === elementId ? 'border-accent' : 'border-border-default hover:bg-bg-secondary'}`,
                    },
                    h('span', { className: 'flex-1 text-xs text-text-primary truncate' }, env.elements.find((el) => el.id === c.elementId)?.label),
                    h('span', { className: S.HINT }, env.t(`match_${c.kind}`)))))
              : null,
            lacksKey
              ? h('label', { className: 'flex items-center gap-2 text-xs text-text-primary' },
                  h('input', { type: 'checkbox', checked: recreate, onChange: () => setRecreate(!recreate) }),
                  env.t('orphan_recreate_property', { key: a.propertyKey, value: trimPunctuation(a.text) }))
              : null,
            a.kind === 'event'
              ? h('div', { className: 'flex items-center gap-2' },
                  h('input', { type: 'date', className: S.INPUT_IN_CARD, value: day, 'aria-label': env.t('field_date'), onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setDay(e.target.value) }),
                  h('input', { type: 'time', className: S.INPUT_IN_CARD, style: { width: 90 }, value: time, 'aria-label': env.t('field_time'), onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setTime(e.target.value) }))
              : null),
      h('div', { className: S.BUTTON_ROW },
        h('button', { type: 'submit', disabled: busy || !valid, className: S.BUTTON_PRIMARY_SMALL }, env.t('orphan_reattach'))))),
    h('div', { className: 'px-4 py-3' },
      h('button', {
        type: 'button',
        onClick: () => env.run(() => deleteAnnotation(env.ctx, a)).then((ok) => ok && p.onRemoved()),
        className: 'w-full px-2 py-1 text-xs font-medium text-error border border-border-default rounded hover:bg-bg-secondary',
      }, env.t('menu_remove_highlight'))));
}

// ─── Sheet ───────────────────────────────────────────────────

export function ElementSheet(props: Props) {
  const { api, React, h } = host();
  const { ctx, elementId, draft, annotations, selectedAnnotationId } = props;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const { LocateFixed } = api.icons;
  // The forms read the profile: they follow a change made in the settings.
  React.useSyncExternalStore(subscribeSettings, getSettingsVersion);

  const allElements: ZnElement[] = api.stores.useDossierStore((s: { elements: ZnElement[] }) => s.elements);
  const elements = React.useMemo(
    () => allElements.filter(isGraphElement).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [allElements],
  );
  const tagSetMap = api.stores.useTagSetStore((s: { tagSets: Map<string, ZnTagSet> }) => s.tagSets);
  const tagSets: ZnTagSet[] = React.useMemo(() => api.stores.useTagSetStore.getState().getAll(), [tagSetMap]);
  const links: ZnLink[] = api.stores.useDossierStore((s: { links: ZnLink[] }) => s.links);
  /** Choosing another element for the value being added. */
  const [changing, setChanging] = React.useState(false);
  React.useEffect(() => setChanging(false), [elementId, draft]);

  const run: Env['run'] = async (write) => {
    try {
      await write();
      return true;
    } catch (err) {
      console.error('MarkNeurone: write failed', err);
      api.toast.error(t('write_error'));
      return false;
    }
  };
  const env: Env = { ctx, elements, links, tagSets, annotations, t, run };
  const element = elementId ? elements.find((el) => el.id === elementId) : undefined;

  const container = (content: ReactTypes.ReactNode) =>
    h('aside', {
      className: 'flex flex-col shrink-0 border-l border-border-default bg-bg-primary overflow-y-auto',
      style: { width: 360 },
      'aria-label': t('sheet_title'),
    }, content);

  // New link: confirmation takes the whole sheet.
  if (props.linkDraft) {
    const ld = props.linkDraft;
    return container(
      h(Section, { title: t('new_link') },
        h(LinkForm, {
          key: `${ld.fromId}-${ld.toId}`,
          env,
          draft: ld,
          onDone: (fromId: string) => {
            props.onElementChange(fromId);
            props.onLinkDone();
          },
          onCancel: props.onLinkDone,
        })));
  }

  // New element: the draft takes the whole sheet.
  if (draft?.gesture === 'element') {
    return container(
      h(Section, { title: t('new_element') },
        h(NewElementForm, {
          key: passageKey(draft.passage) + draft.passage.page,
          env,
          passage: draft.passage,
          onCreated: (id: string) => {
            props.onElementChange(id);
            props.onDraftDone();
          },
          onCancel: props.onDraftDone,
        })));
  }

  // An orphan highlight being reattached.
  const orphan = props.orphanId ? annotations.find((a) => a.id === props.orphanId) : undefined;
  if (orphan?.orphan && !draft && !props.linkDraft) {
    return container(
      h(OrphanSheet, {
        key: orphan.id,
        env,
        annotation: orphan,
        defaultElementId: elementId,
        onDone: (id: string) => props.onElementChange(id),
        onRemoved: () => props.onElementChange(elementId),
      }));
  }

  // A link replaces the element, like ZN's link detail panel.
  const link = props.linkId ? links.find((l) => l.id === props.linkId) : undefined;
  if (props.linkId && !draft) {
    return container(
      link
        ? h(LinkSheet, {
            env,
            link,
            selectedId: selectedAnnotationId,
            onOpenElement: (id: string) => props.onElementChange(id),
            onGoto: props.onGoto,
            onDeleted: (fromId: string) => props.onElementChange(fromId),
          })
        : h('div', { className: 'p-4 text-xs text-text-tertiary' }, t('link_missing')));
  }

  // A property or an event needs an element first.
  if (!element) {
    const picker = draft
      ? h(Section, { title: t('choose_element_title') },
          h('div', { className: 'space-y-2' },
            h(ElementPicker, {
              elements,
              tagSets,
              autoFocus: true,
              inputClass: S.INPUT,
              onChange: (id: string) => props.onElementChange(id),
              onEscape: props.onDraftDone,
            })))
      : elementId
        ? h('div', { className: 'p-4 text-xs text-text-tertiary' }, t('element_missing'))
        : h(DocumentElements, {
            env,
            onPick: (entry: IndexEntry) => {
              props.onElementChange(entry.elementId);
              props.onGoto(entry.first);
            },
          });
    return container(picker);
  }

  /** Clears the position; the highlights it came from go with it. */
  const clearLocation = () =>
    run(async () => {
      await graph.updateElement(element.id, { geo: null });
      for (const a of annotations.filter((x) => x.kind === 'location' && x.targetId === element.id)) await deleteAnnotation(ctx, a);
    });
  return container(h(React.Fragment, null,
    h('div', { className: 'flex items-center gap-2 px-4 py-3 border-b border-border-default' },
      draft
        ? null
        : h('button', { type: 'button', onClick: () => props.onElementChange(null), title: t('index_back'), 'aria-label': t('index_back'), className: S.ICON_BUTTON },
            h(api.icons.ArrowLeft, { size: 14 })),
      h('span', { className: 'flex-1 text-sm font-semibold text-text-primary truncate' }, element.label || t('unnamed')),
      // While a value is being added, the element it goes to can be changed.
      draft
        ? h('button', { type: 'button', onClick: () => setChanging(!changing), className: 'text-xs text-accent hover:underline shrink-0' }, t('change_element'))
        : null,
      h('button', { type: 'button', onClick: () => props.onReveal(element.id), title: t('reveal_on_canvas'), className: S.ICON_BUTTON_ACCENT },
        h(LocateFixed, { size: 14 }))),
    changing
      ? h('div', { className: 'px-4 py-3 border-b border-border-default' },
          h(ElementPicker, {
            elements,
            tagSets,
            value: element.id,
            autoFocus: true,
            inputClass: S.INPUT,
            onChange: (id: string) => {
              setChanging(false);
              props.onElementChange(id);
            },
            onEscape: () => setChanging(false),
          }))
      : null,
    h(Section, { title: t('section_identity') },
      h('div', { className: 'space-y-4' },
        h('div', { className: 'space-y-1.5' },
          h('label', { className: S.LABEL }, t('field_label')),
          h(CommitInput, { className: S.INPUT, value: element.label, ariaLabel: t('field_label'), onCommit: (v: string) => run(() => graph.updateElement(element.id, { label: v })) })),
        h('div', { className: 'space-y-1.5' },
          h('label', { className: S.LABEL }, t('field_tags')),
          h(TagsEditor, { env, tags: element.tags, onChange: (tags: string[]) => run(() => graph.updateElement(element.id, { tags })) })))),
    h(Section, { title: t('section_evaluation') },
      h(EvaluationFields, {
        env,
        confidence: element.confidence,
        evaluation: element.evaluation,
        onChange: (changes: EvaluationChanges) => run(() => graph.updateElement(element.id, changes)),
      })),
    h(Section, { title: t('section_properties'), badge: element.properties.length },
      h('div', { className: 'space-y-2' },
        draft?.gesture === 'property'
          ? h(PropertyDraft, { key: `p-${draft.passage.page}-${passageKey(draft.passage)}`, env, element, passage: draft.passage, onDone: props.onDraftDone })
          : null,
        h(PropertyRows, { env, element, onGoto: props.onGoto }))),
    h(Section, { title: t('section_events'), badge: element.events.length },
      h('div', { className: 'space-y-2' },
        draft?.gesture === 'event'
          ? h(EventDraft, { key: `e-${draft.passage.page}-${passageKey(draft.passage)}`, env, element, passage: draft.passage, onDone: props.onDraftDone })
          : null,
        h(EventRows, { env, element, onGoto: props.onGoto }))),
    h(Section, { title: t('section_location') },
      h('div', { className: 'space-y-2' },
        h('label', { className: S.LABEL }, t('geo_coordinates')),
        draft?.gesture === 'location'
          ? h(LocationDraft, { key: `g-${draft.passage.page}-${passageKey(draft.passage)}`, env, element, passage: draft.passage, onDone: props.onDraftDone })
          : null,
        h(GeoFields, {
          env,
          geo: element.geo,
          inputClass: S.INPUT,
          onChange: (geo: ZnGeo | null) => (geo ? run(() => graph.updateElement(element.id, { geo })) : clearLocation()),
        }),
        h('div', { className: 'flex gap-2' },
          h('button', {
            type: 'button',
            onClick: async () => {
              // ZN's picker over the reader when available, else ZN's panel.
              if (!canPickOnMap()) {
                props.onPickOnMap(element.id);
                return;
              }
              const point = element.geo?.type === 'point' ? element.geo : null;
              const chosen = await pickOnMap(point ? { lat: point.lat, lng: point.lng } : undefined);
              if (chosen) run(() => graph.updateElement(element.id, { geo: { ...(point ?? {}), type: 'point', lat: chosen.lat, lng: chosen.lng } }));
            },
            title: canPickOnMap() ? t('geo_pick_hint') : t('geo_pick_panel_hint'),
            className: `${S.BUTTON_SECONDARY_SMALL} flex-1`,
          }, h(api.icons.MapPin, { size: 12 }), t('geo_pick')),
          element.geo
            ? h('button', {
                type: 'button',
                onClick: clearLocation,
                className: S.BUTTON_SECONDARY_SMALL,
              }, t('geo_clear'))
            : null))),
    h(Section, { title: t('section_links'), badge: links.filter((l) => l.fromId === element.id || l.toId === element.id).length },
      h(LinkRows, { env, element, onOpenLink: props.onOpenLink })),
    h(Section, { title: t('section_passages'), badge: annotations.filter((a) => concernedElements(a).includes(element.id)).length },
      h(PassageRows, {
        env,
        items: annotations.filter((a) => concernedElements(a).includes(element.id)),
        selectedId: selectedAnnotationId,
        onGoto: props.onGoto,
      }))));
}
