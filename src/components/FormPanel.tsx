// ─── Form panel ──────────────────────────────────────────────
//
// Replaces the element sheet while a form model is applied to the document:
// the document's fields, then the blocks of each section. A block opens its
// sheet; one validation creates its element and the fields left checked
// (docs/lecture-formulaires.md, sections 5 to 9).

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { Annotation } from '../core/model.ts';
import type { FormModel } from '../core/formModel.ts';
import type { FormReading, ValueAnchor } from '../core/formReader.ts';
import { blockDraft, blockState, documentRows, isAnswered, valueDate, valuePeriod, type BlockDraft, type DraftRow } from '../core/formSession.ts';
import { findCandidates } from '../core/dictionary.ts';
import { discriminants, homonymGroups } from '../core/elementSearch.ts';
import { getProfile } from '../services/settingsStore.ts';
import { linkBlocks, rejectBlock, rejectRows, validateBlock, validateDocumentFields, type PassageOf } from '../services/formQualify.ts';
import type { DocumentContext } from '../services/qualify.ts';
import { isGraphElement, type ZnElement, type ZnLink, type ZnTagSet } from '../services/znTypes.ts';
import { linkedLabelsOf } from './ElementPicker.tsx';
import { TagSetPicker } from './TagSetPicker.tsx';
import * as S from './znStyles.ts';

export const DOCUMENT_KEY = 'document';

interface Props {
  ctx: DocumentContext;
  model: FormModel;
  reading: FormReading;
  annotations: Annotation[];
  /** Elements carrying the document, for its fields. */
  carrierIds: string[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onGoto: (anchor: ValueAnchor) => void;
  passageOf: PassageOf;
  onClose: () => void;
  onCollapse: () => void;
  /** Clears every highlight of the document; absent when there is none. */
  onClearAll?: () => void;
}

function host() {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  return { api, React, h: React.createElement, t };
}

const tagColor = (tagSets: ZnTagSet[], tag: string | null) =>
  (tag && tagSets.find((ts) => ts.name.toLowerCase() === tag.toLowerCase())?.defaultVisual.color) || null;

/** Runs a write; false and a message when it fails. */
async function run(write: () => Promise<unknown>): Promise<boolean> {
  const { api, t } = host();
  try {
    await write();
    return true;
  } catch (err) {
    console.error('MarkNeurone: cannot write the form block', err);
    api.toast.error(t('write_error'));
    return false;
  }
}

// ─── Rows ────────────────────────────────────────────────────

function RowEditor(p: { row: DraftRow; onChange: (row: DraftRow) => void; onGoto: () => void }) {
  const { api, h, t } = host();
  const { row } = p;
  let hint: string | null = null;
  if (row.unreadable) hint = t('form_date_unreadable');
  else if (row.kind === 'event') {
    const period = valuePeriod(row.text);
    if (period) hint = [period.date, period.dateEnd].filter(Boolean).map((d) => d!.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })).join(' > ');
    else hint = t('form_date_unreadable');
  } else if (row.type === 'date' && !valueDate(row.text)) hint = t('form_date_unreadable');
  return h('div', { className: 'flex items-start gap-2' },
    h('input', {
      type: 'checkbox',
      className: 'mt-1.5',
      checked: row.checked,
      'aria-label': row.key,
      onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => p.onChange({ ...row, checked: e.target.checked }),
    }),
    h('div', { className: 'flex-1 min-w-0 space-y-0.5' },
      h('div', { className: 'flex items-center gap-1' },
        row.kind === 'event' ? h(api.icons.Calendar, { size: 11, className: 'text-text-tertiary shrink-0' }) : null,
        h('input', {
          className: 'flex-1 min-w-0 px-1 py-0 text-[11px] font-medium text-text-secondary bg-transparent border border-transparent rounded hover:border-border-default focus:outline-none focus:border-accent',
          value: row.key,
          'aria-label': t('field_key'),
          title: row.unknown ? t('form_unknown_label') : undefined,
          onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => p.onChange({ ...row, key: e.target.value }),
        }),
        h('button', { type: 'button', onClick: p.onGoto, title: t('form_goto'), 'aria-label': t('form_goto'), className: S.ICON_BUTTON },
          h(api.icons.LocateFixed, { size: 12 }))),
      h('input', {
        className: S.INPUT_COMPACT,
        value: row.text,
        'aria-label': row.key,
        onFocus: p.onGoto,
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => p.onChange({ ...row, text: e.target.value }),
      }),
      hint ? h('div', { className: `${S.HINT} ${row.unreadable || hint === t('form_date_unreadable') ? 'text-warning' : ''}` }, hint) : null));
}

const usable = (rows: DraftRow[]) => rows.filter((r) => r.checked && r.key.trim() && r.text.trim());

// ─── Block sheet ─────────────────────────────────────────────

interface Env {
  ctx: DocumentContext;
  elements: ZnElement[];
  links: ZnLink[];
  tagSets: ZnTagSet[];
  passageOf: PassageOf;
  onGoto: (anchor: ValueAnchor) => void;
}

/** What the user made of a block's sheet: kept while other blocks are read. */
interface BlockEdit {
  label: string;
  tag: string | null;
  attachTo: string | null;
  rows: DraftRow[];
  /** Links chosen, by the key of the target block, with their label. */
  links: Map<string, string>;
  /** Link to the element carrying the document, when the model asks for it. */
  docLink: boolean;
}

interface DocumentEdit {
  rows: DraftRow[];
  carrier: string;
}

/** A block the link may point to: created already, or reviewed and still to add. */
interface LinkTarget {
  key: string;
  label: string;
  name: string;
}

function BlockSheet(p: {
  env: Env;
  edit: BlockEdit;
  onEdit: (edit: BlockEdit) => void;
  linkTargets: LinkTarget[];
  /** Link to the document: its label and the name of the element carrying it. */
  docLink: { label: string; name: string } | null;
  busy: boolean;
  onSubmit: () => void;
  onReject: () => void;
}) {
  const { React, h, t } = host();
  const { env, edit } = p;
  const { label, tag, attachTo, rows } = edit;
  const set = (patch: Partial<BlockEdit>) => p.onEdit({ ...edit, ...patch });

  // Never attached by default: the user picks a candidate (homonyms).
  const candidates = React.useMemo(() => {
    const named = env.elements.map((el) => ({
      id: el.id,
      label: el.label,
      aliases: el.properties
        .filter((pr) => typeof pr.value === 'string' && getProfile().aliasKeys.some((k) => k.toLowerCase() === pr.key.toLowerCase()))
        .map((pr) => pr.value as string),
    }));
    return label.trim() ? findCandidates(label, named).slice(0, 5) : [];
  }, [label, env.elements]);
  const groups = React.useMemo(() => homonymGroups(env.elements), [env.elements]);
  const linkedLabels = React.useMemo(() => linkedLabelsOf(env.elements, env.links), [env.elements, env.links]);

  return h('div', { className: 'space-y-3 pt-2' },
    h('div', { className: 'space-y-1' },
      h('label', { className: S.LABEL }, t('field_label')),
      h('input', { className: S.INPUT, value: label, disabled: !!attachTo, onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => set({ label: e.target.value }) })),
    h('div', { className: 'space-y-1' },
      h('label', { className: S.LABEL }, t('field_tags')),
      h(TagSetPicker, { value: tag, tagSets: env.tagSets, allowNone: true, colorOf: (name: string) => tagColor(env.tagSets, name), onChange: (next: string | null) => set({ tag: next }) })),
    candidates.length
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('candidates_title')),
          h('label', { className: `flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${attachTo === null ? 'border-accent' : 'border-border-default'}` },
            h('input', { type: 'radio', checked: attachTo === null, onChange: () => set({ attachTo: null }) }),
            t('form_new_element')),
          candidates.map((c) => {
            const el = env.elements.find((x) => x.id === c.elementId)!;
            const d = discriminants(el, groups, linkedLabels);
            const details = d
              ? [...el.tags, ...d.properties.map((pr) => `${pr.key} : ${pr.value}`), ...(d.linked.length ? [t('picker_linked', { labels: d.linked.join(', ') })] : [])]
              : [...el.tags, ...el.properties.slice(0, 2).map((pr) => `${pr.key} : ${pr.value instanceof Date ? pr.value.toLocaleDateString('fr-FR') : String(pr.value)}`)];
            return h('label', { key: c.elementId, className: `flex items-start gap-2 px-2 py-1.5 rounded border ${attachTo === c.elementId ? 'border-accent' : 'border-border-default'}` },
              h('input', { type: 'radio', className: 'mt-0.5', checked: attachTo === c.elementId, onChange: () => set({ attachTo: c.elementId }) }),
              h('div', { className: 'flex-1 min-w-0' },
                h('div', { className: 'text-xs font-medium text-text-primary truncate' }, el.label),
                h('div', { className: `${S.HINT} break-words` }, [t(`match_${c.kind}`), ...details].join(' · '))));
          }))
      : null,
    rows.length
      ? h('div', { className: 'space-y-2' },
          rows.map((r, i) =>
            h(RowEditor, {
              key: r.id,
              row: r,
              onChange: (next: DraftRow) => set({ rows: rows.map((x, j) => (j === i ? next : x)) }),
              onGoto: () => env.onGoto(r.anchor),
            })))
      : null,
    p.linkTargets.length || p.docLink
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('form_links')),
          p.docLink
            ? h('label', { className: 'flex items-center gap-2 text-xs text-text-primary' },
                h('input', { type: 'checkbox', checked: edit.docLink, onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => set({ docLink: e.target.checked }) }),
                h('span', { className: 'truncate' }, `${p.docLink.label} > ${p.docLink.name}`))
            : null,
          p.linkTargets.map((l) =>
            h('label', { key: l.key, className: 'flex items-center gap-2 text-xs text-text-primary' },
              h('input', {
                type: 'checkbox',
                checked: edit.links.has(l.key),
                onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
                  const next = new Map(edit.links);
                  if (e.target.checked) next.set(l.key, l.label);
                  else next.delete(l.key);
                  set({ links: next });
                },
              }),
              h('span', { className: 'truncate' }, `${l.label} > ${l.name}`))))
      : null,
    h('div', { className: S.BUTTON_ROW },
      h('button', { type: 'button', disabled: p.busy, onClick: p.onReject, className: S.BUTTON_SECONDARY_SMALL }, t('form_reject')),
      h('button', { type: 'button', disabled: p.busy || (!attachTo && !label.trim()), onClick: p.onSubmit, className: S.BUTTON_PRIMARY_SMALL },
        t(attachTo ? 'attach' : 'create'))));
}

// ─── Document sheet ──────────────────────────────────────────

function DocumentSheet(p: {
  env: Env;
  edit: DocumentEdit;
  onEdit: (edit: DocumentEdit) => void;
  carrierIds: string[];
  busy: boolean;
  onAdd: () => void;
  onReject: () => void;
}) {
  const { h, t } = host();
  const { env, edit } = p;
  const { rows, carrier } = edit;
  return h('div', { className: 'space-y-3 pt-2' },
    p.carrierIds.length > 1
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('form_carrier')),
          h('select', {
            className: S.INPUT,
            value: carrier,
            onChange: (e: ReactTypes.ChangeEvent<HTMLSelectElement>) => p.onEdit({ ...edit, carrier: e.target.value }),
          }, p.carrierIds.map((id) => h('option', { key: id, value: id }, env.elements.find((el) => el.id === id)?.label ?? id))))
      : null,
    h('div', { className: 'space-y-2' },
      rows.map((r, i) =>
        h(RowEditor, {
          key: r.id,
          row: r,
          onChange: (next: DraftRow) => p.onEdit({ ...edit, rows: rows.map((x, j) => (j === i ? next : x)) }),
          onGoto: () => env.onGoto(r.anchor),
        }))),
    h('div', { className: S.BUTTON_ROW },
      h('button', { type: 'button', disabled: p.busy, onClick: p.onReject, className: S.BUTTON_SECONDARY_SMALL }, t('form_reject')),
      h('button', { type: 'button', disabled: p.busy || !carrier || !usable(rows).length, onClick: p.onAdd, className: S.BUTTON_PRIMARY_SMALL }, t('form_add'))));
}

// ─── Panel ───────────────────────────────────────────────────

/** A link chosen toward a block not created yet: made when that block is. */
interface PendingLink {
  fromId: string;
  page: number;
  toKey: string;
  label: string;
}

/** The review of a document, kept until the page reloads: closing the form loses nothing. */
interface Review {
  edits: Map<string, BlockEdit>;
  docEdit: DocumentEdit | null;
  pending: PendingLink[];
}
const reviews = new Map<string, Review>();
const reviewOf = (key: string): Review => {
  let r = reviews.get(key);
  if (!r) reviews.set(key, (r = { edits: new Map(), docEdit: null, pending: [] }));
  return r;
};

export function FormPanel(p: Props) {
  const { api, React, h, t } = host();
  const { model, reading, annotations } = p;
  const { ChevronDown, Check, X } = api.icons;

  const allElements: ZnElement[] = api.stores.useDossierStore((s: { elements: ZnElement[] }) => s.elements);
  const elements = React.useMemo(() => allElements.filter(isGraphElement), [allElements]);
  const links: ZnLink[] = api.stores.useDossierStore((s: { links: ZnLink[] }) => s.links);
  const tagSetMap = api.stores.useTagSetStore((s: { tagSets: Map<string, ZnTagSet> }) => s.tagSets);
  const tagSets: ZnTagSet[] = React.useMemo(() => api.stores.useTagSetStore.getState().getAll(), [tagSetMap]);
  const env: Env = { ctx: p.ctx, elements, links, tagSets, passageOf: p.passageOf, onGoto: p.onGoto };

  const drafts = React.useMemo(() => reading.blocks.map((b) => blockDraft(b, model)), [reading, model]);
  const states = drafts.map((d) => blockState(d, annotations));
  const docRows = React.useMemo(() => documentRows(reading), [reading]);
  const openDocRows = docRows.filter((r) => !isAnswered(r.anchor, annotations));
  const carrierId = p.carrierIds[0] ?? null;

  /** Blocks a link of this section may point to: all but the dismissed ones. */
  const targetsOf = (to: string) => drafts.filter((o, j) => o.sectionId === to && states[j].status !== 'rejected');
  // A link with a single possible target is checked: there is no choice to make.
  const defaultEdit = (d: BlockDraft): BlockEdit => {
    const links = new Map<string, string>();
    for (const l of d.links) {
      const targets = targetsOf(l.to);
      if (targets.length === 1) links.set(targets[0].key, l.label);
    }
    return { label: d.label, tag: d.tag, attachTo: null, rows: d.rows, links, docLink: !!model.documentLink && !!carrierId };
  };

  /** New elements go in rows under the document, one row per section. */
  const nearOf = (d: BlockDraft) => {
    const carrier = carrierId ? elements.find((el) => el.id === carrierId) : undefined;
    if (!carrier) return undefined;
    const rank = model.sections.filter((s) => drafts.some((o) => o.sectionId === s.id)).findIndex((s) => s.id === d.sectionId);
    const mine = drafts.filter((o) => o.sectionId === d.sectionId);
    const i = mine.findIndex((o) => o.key === d.key);
    return { x: carrier.position.x + (i - (mine.length - 1) / 2) * 200, y: carrier.position.y + (rank + 1) * 160 };
  };

  // A block is reviewed once the user opens it or changes it (not when it
  // opens by itself after a creation); its edits stay until it is added.
  const review = reviewOf(`${p.ctx.dossierId}:${p.ctx.asset.id}:${model.id}`);
  const [, rerender] = React.useState(0);
  const refresh = () => rerender((n) => n + 1);
  const edits = review.edits;
  const docEdit = review.docEdit;
  const pending = {
    get current() {
      return review.pending;
    },
    set current(v: PendingLink[]) {
      review.pending = v;
    },
  };
  const [busy, setBusy] = React.useState(false);
  const setEdit = (key: string, edit: BlockEdit) => {
    edits.set(key, edit);
    refresh();
  };
  const setDocEdit = (edit: DocumentEdit | null) => {
    review.docEdit = edit;
    refresh();
  };
  const dropEdits = (keys: string[]) => {
    for (const k of keys) edits.delete(k);
    refresh();
  };
  const markReviewed = (key: string | null) => {
    if (key === DOCUMENT_KEY) {
      if (!docEdit && openDocRows.length) setDocEdit({ rows: openDocRows, carrier: p.carrierIds[0] ?? '' });
      return;
    }
    const d = key ? drafts.find((x) => x.key === key) : undefined;
    if (d && !edits.has(d.key)) setEdit(d.key, defaultEdit(d));
  };

  /** Next block to check after this one, in reading order. */
  const nextOpen = (key: string) => {
    const from = drafts.findIndex((d) => d.key === key);
    const next = [...drafts.slice(from + 1), ...drafts.slice(0, from)].find((d) => blockState(d, annotations).status === 'open' && d.key !== key);
    return next?.key ?? null;
  };
  const select = (key: string | null, anchor?: ValueAnchor) => {
    if (key !== p.selectedKey) markReviewed(key);
    p.onSelect(key === p.selectedKey ? null : key);
    if (anchor && key !== p.selectedKey) p.onGoto(anchor);
  };

  const createdIds = () => {
    const out = new Map<string, string>();
    drafts.forEach((d, i) => {
      const s = states[i];
      if (s.status === 'done') out.set(d.key, s.elementId);
    });
    return out;
  };

  /** Creates one block; links toward blocks not created yet wait for them. */
  const createBlock = async (d: BlockDraft, edit: BlockEdit, created: Map<string, string>) => {
    const now: { toId: string; label: string }[] = [];
    const later: { toKey: string; label: string }[] = [];
    for (const [toKey, label] of edit.links) {
      const toId = created.get(toKey);
      if (toId) now.push({ toId, label });
      else later.push({ toKey, label });
    }
    if (edit.docLink && model.documentLink && carrierId && edit.attachTo !== carrierId) now.push({ toId: carrierId, label: model.documentLink });
    const id = await validateBlock(
      env.ctx,
      {
        name: { anchor: d.nameAnchor, text: d.nameText || edit.label },
        target: edit.attachTo ? { kind: 'existing', elementId: edit.attachTo } : { kind: 'new', label: edit.label, tags: edit.tag ? [edit.tag] : [] },
        rows: usable(edit.rows),
        links: now,
        near: nearOf(d),
      },
      env.passageOf,
    );
    created.set(d.key, id);
    const waiting = pending.current.filter((l) => l.toKey === d.key);
    pending.current = pending.current.filter((l) => l.toKey !== d.key);
    for (const l of waiting) await linkBlocks(env.ctx, l.page, l.fromId, id, l.label);
    pending.current.push(...later.map((l) => ({ ...l, fromId: id, page: d.nameAnchor.page })));
  };

  const write = async (action: () => Promise<unknown>, then?: () => void) => {
    setBusy(true);
    const ok = await run(action);
    setBusy(false);
    if (ok) then?.();
  };

  const submitBlock = (d: BlockDraft) => {
    const edit = edits.get(d.key) ?? defaultEdit(d);
    return write(() => createBlock(d, edit, createdIds()), () => {
      dropEdits([d.key]);
      p.onSelect(nextOpen(d.key));
    });
  };
  const rejectOne = (d: BlockDraft) => {
    const edit = edits.get(d.key) ?? defaultEdit(d);
    return write(() => rejectBlock(env.ctx, { anchor: d.nameAnchor, text: d.nameText || edit.label }, env.passageOf), () => {
      dropEdits([d.key]);
      pending.current = pending.current.filter((l) => l.toKey !== d.key);
      p.onSelect(nextOpen(d.key));
    });
  };

  // Reviewed and still open: the blocks "add reviewed" writes, in section order.
  const reviewed = model.sections.flatMap((s) =>
    drafts.filter((d, i) => d.sectionId === s.id && states[i].status === 'open' && edits.has(d.key)),
  );
  const docReviewed = !!docEdit && openDocRows.length > 0 && !!docEdit.carrier && usable(docEdit.rows).length > 0;
  const reviewedCount = reviewed.length + (docReviewed ? 1 : 0);

  const addReviewed = () => {
    const done: string[] = [];
    return write(
      async () => {
        try {
          const created = createdIds();
          for (const d of reviewed) {
            const edit = edits.get(d.key)!;
            if (!edit.attachTo && !edit.label.trim()) continue;
            await createBlock(d, edit, created);
            done.push(d.key);
          }
          if (docReviewed) await validateDocumentFields(env.ctx, docEdit!.carrier, usable(docEdit!.rows), env.passageOf);
        } finally {
          dropEdits(done);
        }
      },
      () => {
        setDocEdit(null);
        p.onSelect(null);
      },
    );
  };

  const [closedSections, setClosedSections] = React.useState<Set<string>>(new Set());
  const toggleSection = (id: string) => {
    const next = new Set(closedSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setClosedSections(next);
  };
  const sectionHeader = (id: string, title: string, open: number) =>
    h('button', { type: 'button', onClick: () => toggleSection(id), className: S.SECTION_HEADER },
      h(ChevronDown, { size: 14, className: 'text-text-tertiary transition-transform duration-200', style: closedSections.has(id) ? { transform: 'rotate(-90deg)' } : undefined }),
      h('span', { className: S.SECTION_TITLE }, title),
      open ? h('span', { className: S.SECTION_BADGE }, open) : null);

  const blockName = (d: BlockDraft, i: number) => {
    const state = states[i];
    const created = state.status === 'done' ? elements.find((el) => el.id === state.elementId) : undefined;
    return created?.label || edits.get(d.key)?.label || d.label || `${model.sections.find((s) => s.id === d.sectionId)?.titles[0] ?? ''} ${d.index + 1}`;
  };

  const blockRow = (d: BlockDraft, i: number) => {
    const state = states[i];
    const selected = p.selectedKey === d.key;
    const isReviewed = state.status === 'open' && edits.has(d.key);
    const status = state.status === 'open' ? (isReviewed ? 'form_status_reviewed' : null) : state.status === 'done' ? 'form_status_done' : 'form_status_rejected';
    const edit = edits.get(d.key) ?? defaultEdit(d);
    return h('div', { key: d.key, className: `rounded border ${selected ? 'border-accent' : 'border-border-default'}` },
      h('button', {
        type: 'button',
        onClick: () => (state.status === 'open' ? select(d.key, d.nameAnchor) : p.onGoto(d.nameAnchor)),
        className: 'w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-bg-secondary rounded',
      },
        state.status === 'done' ? h(Check, { size: 12, className: 'text-success shrink-0' }) : null,
        state.status === 'rejected' ? h(X, { size: 12, className: 'text-text-tertiary shrink-0' }) : null,
        h('span', { className: `flex-1 min-w-0 truncate text-xs ${state.status === 'open' ? 'text-text-primary' : 'text-text-tertiary'}` }, blockName(d, i)),
        status ? h('span', { className: S.HINT }, t(status)) : null),
      selected && state.status === 'open'
        ? h('div', { className: 'px-2 pb-2' },
            h(BlockSheet, {
              key: d.key,
              env,
              edit,
              onEdit: (next: BlockEdit) => setEdit(d.key, next),
              linkTargets: d.links.flatMap((l) => targetsOf(l.to).map((o) => ({ key: o.key, label: l.label, name: blockName(o, drafts.indexOf(o)) }))),
              docLink: model.documentLink && carrierId ? { label: model.documentLink, name: elements.find((el) => el.id === carrierId)?.label ?? '' } : null,
              busy,
              onSubmit: () => submitBlock(d),
              onReject: () => rejectOne(d),
            }))
        : null);
  };

  const sections = model.sections
    .filter((s) => s.block)
    .map((s) => {
      const mine = drafts.map((d, i) => ({ d, i })).filter(({ d }) => d.sectionId === s.id);
      if (!mine.length) return null;
      const open = mine.filter(({ i }) => states[i].status === 'open').length;
      return h('div', { key: s.id, className: S.SECTION },
        sectionHeader(s.id, s.titles[0], open),
        closedSections.has(s.id) ? null : h('div', { className: `${S.SECTION_BODY} space-y-1.5` }, mine.map(({ d, i }) => blockRow(d, i))));
    });

  // A row like a block: one sheet open at a time, so one primary button.
  const documentSelected = p.selectedKey === DOCUMENT_KEY;
  const docView: DocumentEdit = docEdit ?? { rows: openDocRows, carrier: p.carrierIds[0] ?? '' };
  const documentSection = openDocRows.length && p.carrierIds.length
    ? h('div', { className: S.SECTION },
        sectionHeader(DOCUMENT_KEY, t('form_document'), openDocRows.length),
        closedSections.has(DOCUMENT_KEY)
          ? null
          : h('div', { className: S.SECTION_BODY },
              h('div', { className: `rounded border ${documentSelected ? 'border-accent' : 'border-border-default'}` },
                h('button', {
                  type: 'button',
                  onClick: () => select(DOCUMENT_KEY, openDocRows[0].anchor),
                  className: 'w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-bg-secondary rounded',
                },
                  h('span', { className: 'flex-1 min-w-0 truncate text-xs text-text-primary' }, openDocRows.map((r) => r.key).join(', ')),
                  docEdit ? h('span', { className: S.HINT }, t('form_status_reviewed')) : null),
                documentSelected
                  ? h('div', { className: 'px-2 pb-2' },
                      h(DocumentSheet, {
                        env,
                        edit: docView,
                        onEdit: setDocEdit,
                        carrierIds: p.carrierIds,
                        busy,
                        onAdd: () => write(() => validateDocumentFields(env.ctx, docView.carrier, usable(docView.rows), env.passageOf), () => {
                          setDocEdit(null);
                          p.onSelect(drafts.find((_, i) => states[i].status === 'open')?.key ?? null);
                        }),
                        onReject: () => write(() => rejectRows(env.ctx, docView.rows, env.passageOf), () => {
                          setDocEdit(null);
                          p.onSelect(drafts.find((_, i) => states[i].status === 'open')?.key ?? null);
                        }),
                      }))
                  : null)))
    : null;

  return h('aside', {
    className: 'flex flex-col shrink-0 border-l border-border-default bg-bg-primary',
    style: { width: 360 },
    'aria-label': model.name,
  },
    h('div', { className: 'flex items-center gap-2 px-4 py-3 border-b border-border-default' },
      h(api.icons.ClipboardList, { size: 14, className: 'text-text-tertiary shrink-0' }),
      h('span', { className: 'flex-1 text-sm font-semibold text-text-primary truncate' }, model.name),
      p.onClearAll
        ? h('button', { type: 'button', onClick: p.onClearAll, title: t('clear_all'), 'aria-label': t('clear_all'), className: `${S.ICON_BUTTON} shrink-0` }, h(api.icons.Trash2, { size: 14 }))
        : null,
      h('button', { type: 'button', onClick: p.onClose, title: t('form_close'), 'aria-label': t('form_close'), className: `${S.ICON_BUTTON} shrink-0` }, h(X, { size: 14 })),
      h('button', { type: 'button', onClick: p.onCollapse, title: t('sheet_collapse'), 'aria-label': t('sheet_collapse'), className: `${S.ICON_BUTTON} shrink-0` },
        h(api.icons.PanelRightClose, { size: 14 }))),
    h('div', { className: 'flex-1 min-h-0 overflow-y-auto' },
      !reading.blocks.length && !docRows.length
        ? h('p', { className: 'px-4 py-3 text-xs text-text-tertiary' }, t('form_nothing'))
        : null,
      documentSection,
      sections),
    reviewedCount
      ? h('div', { className: 'px-4 py-3 border-t border-border-default bg-bg-secondary' },
          h('button', { type: 'button', disabled: busy, onClick: addReviewed, className: `${S.BUTTON_SECONDARY_SMALL} w-full justify-center` },
            t('form_add_reviewed', { count: reviewedCount })))
      : null);
}
