// ─── Settings window ─────────────────────────────────────────
//
// Opened from MarkNeurone's card on ZN's home page. Settings apply to every
// dossier. Tag colors are ZN's (TagSets): they are written on save.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import { DEFAULT_SETTINGS, MAX_GRID, normalizeSettings, type Settings } from '../core/settings.ts';
import type { CooccurrenceScope } from '../core/settings.ts';
import { SUGGESTION_KINDS } from '../core/suggestions.ts';
import { COUNTRIES, KIND_COUNTRY, type Country, type RegionalKind } from '../core/patterns/regional.ts';
import { getSettings, saveSettings } from '../services/settingsStore.ts';
import { setTagColor } from '../services/graphWriter.ts';
import type { ZnTagSet } from '../services/znTypes.ts';
import { ColorDot } from './ColorDot.tsx';
import { TagSetPicker } from './TagSetPicker.tsx';
import * as S from './znStyles.ts';
import { normalizeFormModel, type FormModel, type ModelIssue } from '../core/formModel.ts';


const INPUT = 'w-full px-2 py-1 text-xs rounded border border-border-default bg-bg-primary text-text-primary focus:outline-none focus:border-accent';
const BUTTON_PRIMARY = 'bg-accent text-white hover:bg-accent-hover px-3 py-1.5 text-sm font-medium rounded sketchy-border disabled:opacity-50';
const BUTTON_SECONDARY = 'border border-border-default text-text-primary bg-bg-primary hover:bg-bg-secondary px-3 py-1.5 text-sm font-medium rounded sketchy-border';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const { X, ChevronUp } = api.icons;

  const [draft, setDraft] = React.useState<Settings>(() => structuredClone(getSettings()));
  /** Colors changed in this window, written to ZN's TagSets on save. */
  const [colors, setColors] = React.useState<Record<string, string | null>>({});
  const [aliasInput, setAliasInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<'tags' | 'recognition' | 'links' | 'forms'>('tags');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const tagSets: ZnTagSet[] = api.stores.useTagSetStore.getState().getAll();
  const colorOf = (tag: string) =>
    tag in colors ? colors[tag] : tagSets.find((ts) => ts.name.toLowerCase() === tag.toLowerCase())?.defaultVisual.color ?? null;

  const profile = draft.profile;
  const setProfile = (changes: Partial<Settings['profile']>) => setDraft({ ...draft, profile: { ...profile, ...changes } });
  const setTag = (i: number, tag: string) => setProfile({ grid: profile.grid.map((g, j) => (j === i ? { ...g, tag } : g)) });
  const moveUp = (i: number) => {
    const grid = [...profile.grid];
    [grid[i - 1], grid[i]] = [grid[i], grid[i - 1]];
    setProfile({ grid });
  };
  const addAlias = () => {
    const key = aliasInput.trim();
    if (key && !profile.aliasKeys.some((k) => k.toLowerCase() === key.toLowerCase())) setProfile({ aliasKeys: [...profile.aliasKeys, key] });
    setAliasInput('');
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveSettings(draft);
      for (const [tag, color] of Object.entries(colors)) if (tag.trim()) await setTagColor(tag.trim(), color);
      onClose();
    } catch (err) {
      console.error('MarkNeurone: cannot save settings', err);
      api.toast.error(t('settings_error'));
      setBusy(false);
    }
  };

  // Shortcuts follow the order of the rows, as normalizeSettings will store them.
  const shown = normalizeSettings(draft).profile.grid;

  /** Content of one tab; null for the others. */
  const section = (id: typeof tab, content: ReactTypes.ReactNode, more: ReactTypes.ReactNode = null) =>
    tab === id ? h('div', { className: 'space-y-2' }, content, more) : null;
  // Tabs as in ZN's modals (StorageModal).
  const tabs = [
    { id: 'tags' as const, label: t('settings_tab_tags'), icon: api.icons.Tag },
    { id: 'recognition' as const, label: t('settings_tab_recognition'), icon: api.icons.ScanSearch },
    { id: 'links' as const, label: t('settings_tab_links'), icon: api.icons.Link2 },
    { id: 'forms' as const, label: t('settings_tab_forms'), icon: api.icons.ClipboardList },
  ];

  // ─── Form models: imported from JSON, kept on save ───────
  const issueText = (i: ModelIssue) => t(`form_issue_${i.reason}`, { section: i.section ?? t('form_document'), subject: i.subject ?? '' });
  const importModel = async (file: File) => {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      api.toast.error(t('settings_forms_invalid'));
      return;
    }
    const { model, dropped } = normalizeFormModel(raw);
    if (!model) {
      api.toast.error(`${t('settings_forms_invalid')} ${dropped.map(issueText).join(' ; ')}`);
      return;
    }
    const others = draft.formModels.filter((m) => m.id !== model.id);
    setDraft({ ...draft, formModels: [...others, model] });
    if (dropped.length) api.toast.warning(t('settings_forms_dropped', { name: model.name, list: dropped.map(issueText).join(' ; ') }));
  };
  const exportModel = (model: FormModel) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const scopes: CooccurrenceScope[] = ['off', 'sentence', 'paragraph'];
  const countries = draft.identifiers.countries;
  const toggleCountry = (c: Country, on: boolean) =>
    setDraft({ ...draft, identifiers: { countries: COUNTRIES.filter((x) => (x === c ? on : countries.includes(x))) } });
  // Kinds of a country left out are not offered.
  const kinds = SUGGESTION_KINDS.filter((k) => !(k in KIND_COUNTRY) || countries.includes(KIND_COUNTRY[k as RegionalKind]));
  const checkbox = (label: string, checked: boolean, onChange: ((on: boolean) => void) | null) =>
    h('label', { key: label, className: `flex items-center gap-1.5 text-xs ${onChange ? 'text-text-primary' : 'text-text-tertiary'}` },
      h('input', {
        type: 'checkbox',
        checked,
        disabled: !onChange,
        onChange: onChange ? (e: ReactTypes.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked) : undefined,
      }),
      label);
  /** A labelled block of the recognition tab, labelled like ZN's fields. */
  const block = (label: string, hint: string | null, content: ReactTypes.ReactNode) =>
    h('div', { className: 'space-y-1.5' }, h('label', { className: S.LABEL, title: hint ?? undefined }, label), content);

  return h('div', {
    className: 'fixed inset-0 z-50 flex items-center justify-center',
    onKeyDown: (e: ReactTypes.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
  },
    h('div', { className: 'absolute inset-0 bg-text-primary/40', onClick: onClose, 'aria-hidden': true }),
    h('div', {
      role: 'dialog',
      'aria-modal': true,
      'aria-label': t('settings_title'),
      className: 'relative bg-bg-primary sketchy-border-soft modal-shadow max-h-[80vh] overflow-hidden flex flex-col',
      style: { width: 560 },
    },
      h('div', { className: 'flex items-center justify-between px-4 py-3 border-b border-border-default' },
        h('h2', { className: 'text-sm font-semibold text-text-primary' }, t('settings_title')),
        h('button', { type: 'button', onClick: onClose, title: t('reader_close'), className: S.ICON_BUTTON }, h(X, { size: 16 }))),

      h('div', { className: 'flex border-b border-border-default px-4' },
        tabs.map(({ id, label, icon: Icon }) =>
          h('button', {
            key: id,
            type: 'button',
            onClick: () => setTab(id),
            className: `flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === id ? 'border-accent text-accent' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`,
          }, h(Icon, { size: 13 }), label))),

      h('div', { className: 'p-4 overflow-y-auto flex-1', style: { minHeight: 320 } },
        section('tags', 
          h('div', { className: 'space-y-1' },
            profile.grid.map((g, i) =>
              // The shortcut is in the tooltip, not in a column.
              h('div', { key: i, className: 'flex items-center gap-2', title: shown[i] ? `Alt+${shown[i].key}` : undefined },
                h(ColorDot, { color: colorOf(g.tag), size: 10, onChoose: (c: string | null) => setColors({ ...colors, [g.tag]: c }) }),
                h('div', { className: 'flex-1 min-w-0' },
                  h(TagSetPicker, {
                    value: g.tag,
                    tagSets,
                    colorOf,
                    hideDot: true,
                    exclude: profile.grid.filter((_, j) => j !== i).map((x) => x.tag),
                    onChange: (name: string | null) => name && setTag(i, name),
                  })),
                h('button', { type: 'button', disabled: i === 0, onClick: () => moveUp(i), title: t('settings_move_up'), className: `${S.ICON_BUTTON} disabled:opacity-30` },
                  h(ChevronUp, { size: 14 })),
                h('button', { type: 'button', onClick: () => setProfile({ grid: profile.grid.filter((_, j) => j !== i) }), title: t('settings_remove'), className: S.ICON_BUTTON_DANGER },
                  h(X, { size: 14 }))))),
          profile.grid.length < MAX_GRID
            ? h(TagSetPicker, {
                value: null,
                tagSets,
                colorOf,
                addButton: true,
                exclude: profile.grid.map((x) => x.tag),
                onChange: (name: string | null) => name && setProfile({ grid: [...profile.grid, { tag: name, key: '' }] }),
              })
            : null),

        section('recognition', h('div', { className: 'space-y-5' },
          block(t('settings_aliases'), t('settings_aliases_hint'), h('div', { className: 'flex flex-wrap items-center gap-1.5' },
            profile.aliasKeys.map((k) =>
              h('span', { key: k, className: S.TAG_CHIP }, k,
                h('button', { type: 'button', onClick: () => setProfile({ aliasKeys: profile.aliasKeys.filter((x) => x !== k) }), className: 'hover:text-error focus:outline-none', 'aria-label': t('settings_remove') },
                  h(X, { size: 12 })))),
            h('input', {
              className: 'px-2 py-0.5 text-xs bg-bg-secondary border border-border-default rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary',
              style: { width: 140 },
              value: aliasInput,
              placeholder: t('settings_alias_placeholder'),
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setAliasInput(e.target.value),
              onKeyDown: (e: ReactTypes.KeyboardEvent) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAlias();
                }
              },
              onBlur: addAlias,
            }))),

          // French identifiers are always looked for.
          block(t('settings_identifiers'), null, h('div', { className: 'flex flex-wrap items-center gap-4' },
            checkbox(t('settings_country_fr'), true, null),
            COUNTRIES.map((c) => checkbox(t(`settings_country_${c}`), countries.includes(c), (on) => toggleCountry(c, on))))),

          h('div', { className: 'grid gap-x-2 gap-y-1 items-center', style: { gridTemplateColumns: '120px 1fr 1fr' } },
            h('span', null),
            h('span', { className: S.SMALL_LABEL }, t('settings_col_tag')),
            h('span', { className: S.SMALL_LABEL }, t('field_key')),
            kinds.flatMap((kind) => [
              h('span', { key: `${kind}-l`, className: 'text-xs text-text-secondary' }, t(`suggestion_kind_${kind}`)),
              h(TagSetPicker, {
                key: `${kind}-t`,
                value: profile.suggestionTags[kind] ?? null,
                tagSets,
                colorOf,
                allowNone: true,
                onChange: (name: string | null) => setProfile({ suggestionTags: { ...profile.suggestionTags, [kind]: name ?? '' } }),
              }),
              h('input', {
                key: `${kind}-k`,
                className: INPUT,
                value: profile.suggestionKeys[kind] ?? '',
                'aria-label': `${t(`suggestion_kind_${kind}`)} : ${t('field_key')}`,
                onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setProfile({ suggestionKeys: { ...profile.suggestionKeys, [kind]: e.target.value } }),
              }),
            ])),

          h('label', { className: 'flex items-center gap-2 text-xs text-text-primary' },
            h('input', {
              type: 'checkbox',
              checked: draft.labels.uppercase,
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, labels: { uppercase: e.target.checked } }),
            }),
            t('settings_uppercase')),

          h('label', { className: 'flex items-center gap-2 text-xs text-text-primary' },
            h('input', {
              type: 'checkbox',
              checked: draft.ocr.dropColor,
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, ocr: { ...draft.ocr, dropColor: e.target.checked } }),
            }),
            t('settings_drop_color')))),

        // Both off by default: the analyst turns them on knowingly.
        section('links', h('div', { className: 'space-y-5' },
          h('label', { className: 'flex items-start gap-2 text-xs text-text-primary' },
            h('input', {
              type: 'checkbox',
              className: 'mt-0.5',
              checked: draft.links.verb,
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, links: { ...draft.links, verb: e.target.checked } }),
            }),
            t('settings_verb')),
          block(t('settings_cooccurrence'), null,
            h('div', { className: 'flex rounded border border-border-default overflow-hidden text-xs', role: 'radiogroup', 'aria-label': t('settings_cooccurrence'), style: { width: 300 } },
              scopes.map((scope) =>
                h('button', {
                  key: scope,
                  type: 'button',
                  role: 'radio',
                  'aria-checked': draft.links.cooccurrence === scope,
                  onClick: () => setDraft({ ...draft, links: { ...draft.links, cooccurrence: scope } }),
                  className: `flex-1 px-2 py-1 ${draft.links.cooccurrence === scope ? 'bg-accent/10 text-accent font-medium' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`,
                }, t(`settings_cooccurrence_${scope}`))))))),

        section('forms', h('div', { className: 'space-y-2' },
          draft.formModels.length
            ? draft.formModels.map((m) =>
                h('div', { key: m.id, className: 'flex items-center gap-2 px-2 py-1.5 rounded border border-border-default' },
                  h('div', { className: 'flex-1 min-w-0' },
                    h('div', { className: 'text-xs font-medium text-text-primary truncate' }, m.name),
                    h('div', { className: S.HINT }, m.sections.filter((x) => x.block).map((x) => x.titles[0]).join(' · '))),
                  h('button', { type: 'button', onClick: () => exportModel(m), title: t('settings_forms_export'), 'aria-label': t('settings_forms_export'), className: S.ICON_BUTTON },
                    h(api.icons.Download, { size: 14 })),
                  h('button', {
                    type: 'button',
                    onClick: () => setDraft({ ...draft, formModels: draft.formModels.filter((x) => x.id !== m.id) }),
                    title: t('settings_remove'),
                    'aria-label': t('settings_remove'),
                    className: S.ICON_BUTTON_DANGER,
                  }, h(X, { size: 14 }))))
            : h('p', { className: 'text-xs text-text-tertiary' }, t('settings_forms_none')),
          h('input', {
            ref: fileRef,
            type: 'file',
            accept: '.json,application/json',
            className: 'hidden',
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) importModel(file).catch((err: unknown) => console.error('MarkNeurone: cannot import the form model', err));
            },
          }),
          h('button', {
            type: 'button',
            onClick: () => fileRef.current?.click(),
            className: 'inline-flex items-center gap-1 px-2 py-0.5 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary rounded border border-dashed border-border-default',
          }, h(api.icons.Upload, { size: 12 }), t('settings_forms_import'))))),

      h('div', { className: 'flex items-center gap-2 px-4 py-3 border-t border-border-default bg-bg-secondary' },
        h('button', { type: 'button', onClick: () => setDraft({ ...structuredClone(normalizeSettings(DEFAULT_SETTINGS)), formModels: draft.formModels }), className: `${S.BUTTON_GHOST_SMALL} mr-auto` }, t('settings_defaults')),
        h('button', { type: 'button', onClick: onClose, className: BUTTON_SECONDARY }, t('cancel')),
        h('button', { type: 'button', disabled: busy, onClick: save, className: BUTTON_PRIMARY }, t('settings_save')))));
}
