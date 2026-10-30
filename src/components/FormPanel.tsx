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
import { rejectBlock, rejectRows, validateBlock, validateDocumentFields, type PassageOf } from '../services/formQualify.ts';
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

function BlockSheet(p: { env: Env; draft: BlockDraft; linkTargets: { elementId: string; label: string }[]; onDone: () => void }) {
  const { React, h, t } = host();
  const { env, draft } = p;
  const [label, setLabel] = React.useState(draft.label);
  const [tag, setTag] = React.useState<string | null>(draft.tag);
  const [attachTo, setAttachTo] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<DraftRow[]>(draft.rows);
  const [linkChecks, setLinkChecks] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

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

  const submit = async () => {
    if (busy || (!attachTo && !label.trim())) return;
    setBusy(true);
    const ok = await run(() =>
      validateBlock(
        env.ctx,
        {
          name: { anchor: draft.nameAnchor, text: draft.nameText || label },
          target: attachTo ? { kind: 'existing', elementId: attachTo } : { kind: 'new', label, tags: tag ? [tag] : [] },
          rows: usable(rows),
          links: p.linkTargets.filter((l) => linkChecks.has(l.elementId)).map((l) => ({ toId: l.elementId, label: l.label })),
        },
        env.passageOf,
      ));
    setBusy(false);
    if (ok) p.onDone();
  };
  const reject = async () => {
    setBusy(true);
    const ok = await run(() => rejectBlock(env.ctx, { anchor: draft.nameAnchor, text: draft.nameText || label }, env.passageOf));
    setBusy(false);
    if (ok) p.onDone();
  };

  return h('div', { className: 'space-y-3 pt-2' },
    h('div', { className: 'space-y-1' },
      h('label', { className: S.LABEL }, t('field_label')),
      h('input', { className: S.INPUT, value: label, disabled: !!attachTo, onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value) })),
    h('div', { className: 'space-y-1' },
      h('label', { className: S.LABEL }, t('field_tags')),
      h(TagSetPicker, { value: tag, tagSets: env.tagSets, allowNone: true, colorOf: (name: string) => tagColor(env.tagSets, name), onChange: setTag })),
    candidates.length
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('candidates_title')),
          h('label', { className: `flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${attachTo === null ? 'border-accent' : 'border-border-default'}` },
            h('input', { type: 'radio', checked: attachTo === null, onChange: () => setAttachTo(null) }),
            t('form_new_element')),
          candidates.map((c) => {
            const el = env.elements.find((x) => x.id === c.elementId)!;
            const d = discriminants(el, groups, linkedLabels);
            const details = d
              ? [...el.tags, ...d.properties.map((pr) => `${pr.key} : ${pr.value}`), ...(d.linked.length ? [t('picker_linked', { labels: d.linked.join(', ') })] : [])]
              : [...el.tags, ...el.properties.slice(0, 2).map((pr) => `${pr.key} : ${pr.value instanceof Date ? pr.value.toLocaleDateString('fr-FR') : String(pr.value)}`)];
            return h('label', { key: c.elementId, className: `flex items-start gap-2 px-2 py-1.5 rounded border ${attachTo === c.elementId ? 'border-accent' : 'border-border-default'}` },
              h('input', { type: 'radio', className: 'mt-0.5', checked: attachTo === c.elementId, onChange: () => setAttachTo(c.elementId) }),
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
              onChange: (next: DraftRow) => setRows(rows.map((x, j) => (j === i ? next : x))),
              onGoto: () => env.onGoto(r.anchor),
            })))
      : null,
    p.linkTargets.length
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('form_links')),
          p.linkTargets.map((l) =>
            h('label', { key: l.elementId, className: 'flex items-center gap-2 text-xs text-text-primary' },
              h('input', {
                type: 'checkbox',
                checked: linkChecks.has(l.elementId),
                onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
                  const next = new Set(linkChecks);
                  if (e.target.checked) next.add(l.elementId);
                  else next.delete(l.elementId);
                  setLinkChecks(next);
                },
              }),
              h('span', { className: 'truncate' }, `${l.label} > ${env.elements.find((el) => el.id === l.elementId)?.label ?? ''}`))))
      : null,
    h('div', { className: S.BUTTON_ROW },
      h('button', { type: 'button', disabled: busy, onClick: reject, className: S.BUTTON_SECONDARY_SMALL }, t('form_reject')),
      h('button', { type: 'button', disabled: busy || (!attachTo && !label.trim()), onClick: submit, className: S.BUTTON_PRIMARY_SMALL },
        t(attachTo ? 'attach' : 'create'))));
}

// ─── Document sheet ──────────────────────────────────────────

function DocumentSheet(p: { env: Env; rows: DraftRow[]; carrierIds: string[]; onDone: () => void }) {
  const { React, h, t } = host();
  const { env } = p;
  const [rows, setRows] = React.useState<DraftRow[]>(p.rows);
  const [carrier, setCarrier] = React.useState<string>(p.carrierIds[0] ?? '');
  const [busy, setBusy] = React.useState(false);
  const write = async (action: () => Promise<unknown>) => {
    setBusy(true);
    const ok = await run(action);
    setBusy(false);
    if (ok) p.onDone();
  };
  return h('div', { className: 'space-y-3 pt-2' },
    p.carrierIds.length > 1
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('form_carrier')),
          h('select', {
            className: S.INPUT,
            value: carrier,
            onChange: (e: ReactTypes.ChangeEvent<HTMLSelectElement>) => setCarrier(e.target.value),
          }, p.carrierIds.map((id) => h('option', { key: id, value: id }, env.elements.find((el) => el.id === id)?.label ?? id))))
      : null,
    h('div', { className: 'space-y-2' },
      rows.map((r, i) =>
        h(RowEditor, { key: r.id, row: r, onChange: (next: DraftRow) => setRows(rows.map((x, j) => (j === i ? next : x))), onGoto: () => env.onGoto(r.anchor) }))),
    h('div', { className: S.BUTTON_ROW },
      h('button', { type: 'button', disabled: busy, onClick: () => write(() => rejectRows(env.ctx, rows, env.passageOf)), className: S.BUTTON_SECONDARY_SMALL }, t('form_reject')),
      h('button', {
        type: 'button',
        disabled: busy || !carrier || !usable(rows).length,
        onClick: () => write(() => validateDocumentFields(env.ctx, carrier, usable(rows), env.passageOf)),
        className: S.BUTTON_PRIMARY_SMALL,
      }, t('form_add'))));
}

// ─── Panel ───────────────────────────────────────────────────

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

  /** Next block to check after this one, in reading order. */
  const nextOpen = (key: string) => {
    const from = drafts.findIndex((d) => d.key === key);
    const next = [...drafts.slice(from + 1), ...drafts.slice(0, from)].find((d) => blockState(d, annotations).status === 'open' && d.key !== key);
    return next?.key ?? null;
  };
  const select = (key: string | null, anchor?: ValueAnchor) => {
    p.onSelect(key === p.selectedKey ? null : key);
    if (anchor && key !== p.selectedKey) p.onGoto(anchor);
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

  const blockRow = (d: BlockDraft, i: number) => {
    const state = states[i];
    const selected = p.selectedKey === d.key;
    const created = state.status === 'done' ? elements.find((el) => el.id === state.elementId) : undefined;
    const name = created?.label || d.label || `${model.sections.find((s) => s.id === d.sectionId)?.titles[0] ?? ''} ${d.index + 1}`;
    return h('div', { key: d.key, className: `rounded border ${selected ? 'border-accent' : 'border-border-default'}` },
      h('button', {
        type: 'button',
        onClick: () => (state.status === 'open' ? select(d.key, d.nameAnchor) : p.onGoto(d.nameAnchor)),
        className: 'w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-bg-secondary rounded',
      },
        state.status === 'done' ? h(Check, { size: 12, className: 'text-success shrink-0' }) : null,
        state.status === 'rejected' ? h(X, { size: 12, className: 'text-text-tertiary shrink-0' }) : null,
        h('span', { className: `flex-1 min-w-0 truncate text-xs ${state.status === 'open' ? 'text-text-primary' : 'text-text-tertiary'}` }, name),
        state.status !== 'open' ? h('span', { className: S.HINT }, t(state.status === 'done' ? 'form_status_done' : 'form_status_rejected')) : null),
      selected && state.status === 'open'
        ? h('div', { className: 'px-2 pb-2' },
            h(BlockSheet, {
              key: d.key,
              env,
              draft: d,
              linkTargets: d.links.flatMap((l) =>
                drafts.flatMap((o, j) => {
                  const s = states[j];
                  return o.sectionId === l.to && s.status === 'done' ? [{ elementId: s.elementId, label: l.label }] : [];
                })),
              onDone: () => p.onSelect(nextOpen(d.key)),
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
                }, h('span', { className: 'flex-1 min-w-0 truncate text-xs text-text-primary' }, openDocRows.map((r) => r.key).join(', '))),
                documentSelected
                  ? h('div', { className: 'px-2 pb-2' },
                      h(DocumentSheet, { key: openDocRows.map((r) => r.id).join(), env, rows: openDocRows, carrierIds: p.carrierIds, onDone: () => p.onSelect(drafts.find((_, i) => states[i].status === 'open')?.key ?? null) }))
                  : null)))
    : null;

  return h('aside', {
    className: 'flex flex-col shrink-0 border-l border-border-default bg-bg-primary overflow-y-auto',
    style: { width: 360 },
    'aria-label': model.name,
  },
    h('div', { className: 'flex items-center gap-2 px-4 py-3 border-b border-border-default' },
      h(api.icons.ClipboardList, { size: 14, className: 'text-text-tertiary shrink-0' }),
      h('span', { className: 'flex-1 text-sm font-semibold text-text-primary truncate' }, model.name),
      h('button', { type: 'button', onClick: p.onClose, title: t('form_close'), 'aria-label': t('form_close'), className: `${S.ICON_BUTTON} shrink-0` }, h(X, { size: 14 })),
      h('button', { type: 'button', onClick: p.onCollapse, title: t('sheet_collapse'), 'aria-label': t('sheet_collapse'), className: `${S.ICON_BUTTON} shrink-0` },
        h(api.icons.PanelRightClose, { size: 14 }))),
    !reading.blocks.length && !docRows.length
      ? h('p', { className: 'px-4 py-3 text-xs text-text-tertiary' }, t('form_nothing'))
      : null,
    documentSection,
    sections);
}
