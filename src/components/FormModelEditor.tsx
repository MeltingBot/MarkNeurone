// ─── Form model editor ───────────────────────────────────────
//
// Replaces the form panel while a model is drafted from the open document
// (or an existing one is changed): every choice of the draft is shown and
// can be changed, and the reader shows at once what the model reads.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { ModelIssue } from '../core/formModel.ts';
import type { FormReading } from '../core/formReader.ts';
import type { DraftField, DraftFieldType, DraftSection, DraftSectionKind, FormDraft } from '../core/formDraft.ts';
import type { ZnTagSet } from '../services/znTypes.ts';
import { TagSetPicker } from './TagSetPicker.tsx';
import * as S from './znStyles.ts';

interface Props {
  draft: FormDraft;
  onChange: (draft: FormDraft) => void;
  /** What the draft reads in the document, for the counts. */
  reading: FormReading | null;
  issues: ModelIssue[];
  canSave: boolean;
  onSave: () => void;
  onExport: () => void;
  onClose: () => void;
  onCollapse: () => void;
}

function host() {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  return { api, React, h: React.createElement, t };
}

const KINDS: DraftSectionKind[] = ['document', 'block', 'list', 'text', 'note'];
const LIST_SEPARATOR = ' ; ';
const splitList = (s: string) => s.split(';').map((x) => x.trim()).filter(Boolean);

function FieldRows(p: { fields: DraftField[]; allowEvent: boolean; onChange: (fields: DraftField[]) => void }) {
  const { h, t } = host();
  const typesOf = (f: DraftField): DraftFieldType[] =>
    f.type === 'checks' ? ['checks', 'skip']
      : f.template !== undefined ? ['text', 'date', 'number', 'skip']
        : p.allowEvent ? ['text', 'date', 'number', 'event', 'read', 'skip'] : ['text', 'date', 'number', 'read', 'skip'];
  return h('div', { className: 'space-y-1.5' },
    p.fields.map((f, i) => {
      const set = (patch: Partial<DraftField>) => p.onChange(p.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
      const muted = f.type === 'skip' || f.type === 'read';
      const composed = f.template !== undefined;
      return h('div', { key: `${f.label}-${i}`, className: 'space-y-0.5' },
        composed
          ? h('div', { className: 'flex items-center gap-1' },
              h('span', { className: 'text-[11px] font-medium text-text-secondary shrink-0' }, t('model_composed')),
              h('div', { className: 'flex-1 min-w-0' }, h('input', {
                className: S.INPUT_COMPACT,
                value: f.template,
                placeholder: '{Jour}/{Mois}/{Année}',
                'aria-label': t('model_template'),
                title: t('model_template'),
                onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => set({ template: e.target.value }),
              })),
              h('button', { type: 'button', onClick: () => p.onChange(p.fields.filter((_, j) => j !== i)), title: t('models_delete'), 'aria-label': t('models_delete'), className: S.ICON_BUTTON_DANGER },
                h(getHostAPI().icons.X, { size: 12 })))
          : h('div', { className: `text-[11px] font-medium truncate ${muted ? 'text-text-tertiary' : 'text-text-secondary'}`, title: f.label }, f.label),
        h('div', { className: 'flex items-center gap-1' },
          h('div', { className: 'flex-1 min-w-0' }, h('input', {
            className: S.INPUT_COMPACT,
            value: f.property,
            disabled: muted || f.type === 'event',
            'aria-label': t('model_property'),
            title: t('model_property'),
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => set({ property: e.target.value }),
          })),
          h('div', { className: 'w-28 shrink-0' }, h('select', {
            className: S.INPUT_COMPACT,
            value: f.type,
            'aria-label': t('model_type'),
            onChange: (e: ReactTypes.ChangeEvent<HTMLSelectElement>) => set({ type: e.target.value as DraftFieldType }),
          }, typesOf(f).map((ty) => h('option', { key: ty, value: ty }, t(`model_type_${ty}`)))))));
    }),
    h('button', {
      type: 'button',
      onClick: () => p.onChange([...p.fields, { label: '', property: '', type: 'text', template: '' }]),
      className: 'text-xs text-accent hover:underline',
    }, t('model_add_composed')));
}

function SectionBody(p: { draft: FormDraft; section: DraftSection; tagSets: ZnTagSet[]; onChange: (s: DraftSection) => void }) {
  const { h, t } = host();
  const { section: s } = p;
  const set = (patch: Partial<DraftSection>) => p.onChange({ ...s, ...patch });
  const used = s.fields.filter((f) => f.type !== 'skip');
  const others = p.draft.sections.filter((o) => o.id !== s.id && (o.kind === 'block' || o.kind === 'list'));
  return h('div', { className: 'space-y-3 pt-1' },
    h('div', { className: 'space-y-1' },
      h('label', { className: S.LABEL }, t('model_kind')),
      h('select', { className: S.INPUT, value: s.kind, onChange: (e: ReactTypes.ChangeEvent<HTMLSelectElement>) => set({ kind: e.target.value as DraftSectionKind }) },
        KINDS.map((k) => h('option', { key: k, value: k }, t(`model_kind_${k}`))))),
    s.kind === 'block' && !p.draft.layout
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('model_starts_with')),
          h('select', { className: S.INPUT, value: s.startsWith, onChange: (e: ReactTypes.ChangeEvent<HTMLSelectElement>) => set({ startsWith: e.target.value }) },
            s.fields.map((f) => h('option', { key: f.label, value: f.label }, f.label))))
      : null,
    s.kind === 'block' || s.kind === 'list'
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('field_tags')),
          h(TagSetPicker, { value: s.tag || null, tagSets: p.tagSets, allowNone: true, onChange: (tag: string | null) => set({ tag: tag ?? '' }) }))
      : null,
    s.kind === 'block'
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('model_name')),
          h('input', { className: S.INPUT, value: s.nameTemplate, onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => set({ nameTemplate: e.target.value }) }),
          h('div', { className: `${S.HINT} break-words` }, used.filter((f) => f.template === undefined && f.type !== 'checks').map((f) => `{${f.label}}`).join(' ')))
      : null,
    s.kind === 'block' || s.kind === 'document'
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('model_fields')),
          h(FieldRows, { fields: s.fields, allowEvent: s.kind === 'block', onChange: (fields: DraftField[]) => set({ fields }) }))
      : null,
    (s.kind === 'block' || s.kind === 'list') && others.length
      ? h('div', { className: 'space-y-1' },
          h('label', { className: S.LABEL }, t('form_links')),
          others.map((o) => {
            const link = s.links.find((l) => l.to === o.id);
            const setLink = (label: string | null) =>
              set({ links: label === null ? s.links.filter((l) => l.to !== o.id) : [...s.links.filter((l) => l.to !== o.id), { to: o.id, label }] });
            return h('div', { key: o.id, className: 'flex items-center gap-2' },
              h('input', {
                type: 'checkbox',
                checked: !!link,
                'aria-label': o.title,
                onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setLink(e.target.checked ? t('model_link_default') : null),
              }),
              h('span', { className: 'text-xs text-text-primary truncate flex-1 min-w-0', title: o.title }, o.title),
              link
                ? h('div', { className: 'w-32 shrink-0' }, h('input', {
                    className: S.INPUT_COMPACT,
                    value: link.label,
                    'aria-label': t('model_link_label'),
                    onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setLink(e.target.value),
                  }))
                : null);
          }))
      : null);
}

export function FormModelEditor(p: Props) {
  const { api, React, h, t } = host();
  const { draft } = p;
  const { ChevronDown, X } = api.icons;
  const tagSetMap = api.stores.useTagSetStore((st: { tagSets: Map<string, ZnTagSet> }) => st.tagSets);
  const tagSets: ZnTagSet[] = React.useMemo(() => api.stores.useTagSetStore.getState().getAll(), [tagSetMap]);
  const [openIds, setOpenIds] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };
  const set = (patch: Partial<FormDraft>) => p.onChange({ ...draft, ...patch });
  const setSection = (s: DraftSection) => set({ sections: draft.sections.map((o) => (o.id === s.id ? s : o)) });
  const countOf = (s: DraftSection) => (p.reading ? p.reading.blocks.filter((b) => b.sectionId === s.id).length : 0);
  const issueText = (i: ModelIssue) => t(`form_issue_${i.reason}`, { section: i.section ?? t('form_document'), subject: i.subject ?? '' });

  const textInput = (label: string, value: string, onChange: (v: string) => void, placeholder?: string) =>
    h('div', { className: 'space-y-1' },
      h('label', { className: S.LABEL }, label),
      h('input', { className: S.INPUT, value, placeholder, onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }));

  const header = (id: string, title: string, badge: number | null, hint: string) =>
    h('button', { type: 'button', onClick: () => toggle(id), className: S.SECTION_HEADER },
      h(ChevronDown, { size: 14, className: 'text-text-tertiary transition-transform duration-200 shrink-0', style: openIds.has(id) ? undefined : { transform: 'rotate(-90deg)' } }),
      h('span', { className: `${S.SECTION_TITLE} truncate` }, title),
      h('span', { className: `${S.HINT} shrink-0` }, hint),
      badge ? h('span', { className: S.SECTION_BADGE }, badge) : null);

  return h('aside', { className: 'flex flex-col shrink-0 border-l border-border-default bg-bg-primary', style: { width: 'var(--mn-panel-width, 360px)' }, 'aria-label': t('model_editor') },
    h('div', { className: 'flex items-center gap-2 px-4 py-3 border-b border-border-default' },
      h(api.icons.ClipboardList, { size: 14, className: 'text-text-tertiary shrink-0' }),
      h('span', { className: 'flex-1 text-sm font-semibold text-text-primary truncate' }, t('model_editor')),
      h('button', { type: 'button', onClick: p.onClose, title: t('model_close'), 'aria-label': t('model_close'), className: `${S.ICON_BUTTON} shrink-0` }, h(X, { size: 14 })),
      h('button', { type: 'button', onClick: p.onCollapse, title: t('sheet_collapse'), 'aria-label': t('sheet_collapse'), className: `${S.ICON_BUTTON} shrink-0` },
        h(api.icons.PanelRightClose, { size: 14 }))),
    h('div', { className: 'flex-1 min-h-0 overflow-y-auto' },
      h('div', { className: `${S.SECTION} px-4 py-3 space-y-3` },
        textInput(t('model_title'), draft.name, (name) => set({ name })),
        textInput(t('model_signature'), draft.signature.join(LIST_SEPARATOR), (v) => set({ signature: splitList(v) })),
        textInput(t('model_empty'), draft.empty.join(LIST_SEPARATOR), (v) => set({ empty: splitList(v) })),
        textInput(t('model_document_link'), draft.documentLink, (documentLink) => set({ documentLink }), t('model_document_link_placeholder'))),
      draft.header.length
        ? h('div', { className: S.SECTION },
            header('__header', t('model_header'), null, t('model_kind_document')),
            openIds.has('__header')
              ? h('div', { className: S.SECTION_BODY }, h(FieldRows, { fields: draft.header, allowEvent: false, onChange: (fields: DraftField[]) => set({ header: fields }) }))
              : null)
        : null,
      draft.sections.map((s) =>
        h('div', { key: s.id, className: S.SECTION },
          header(s.id, s.title, s.kind === 'block' || s.kind === 'list' ? countOf(s) : null, t(`model_kind_${s.kind}`)),
          openIds.has(s.id) ? h('div', { className: S.SECTION_BODY }, h(SectionBody, { draft, section: s, tagSets, onChange: setSection })) : null))),
    h('div', { className: 'px-4 py-3 border-t border-border-default bg-bg-secondary space-y-2' },
      p.issues.length ? h('div', { className: `${S.HINT} text-warning break-words` }, p.issues.map(issueText).join(' ; ')) : null,
      h('div', { className: S.BUTTON_ROW },
        h('button', { type: 'button', onClick: p.onExport, disabled: !p.canSave, className: S.BUTTON_SECONDARY_SMALL }, t('model_export')),
        h('button', { type: 'button', onClick: p.onSave, disabled: !p.canSave, className: S.BUTTON_PRIMARY_SMALL }, t('model_save')))));
}
