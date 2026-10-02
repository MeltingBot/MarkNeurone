// ─── Settings window ─────────────────────────────────────────
//
// Opened from MarkNeurone's card on ZN's home page. Settings apply to every
// dossier. Tag colors are ZN's (TagSets): they are written on save.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import { DEFAULT_SETTINGS, MAX_GRID, normalizeSettings, type Settings } from '../core/settings.ts';
import type { SuggestionKind } from '../core/suggestions.ts';
import { getSettings, saveSettings } from '../services/settingsStore.ts';
import { setTagColor } from '../services/graphWriter.ts';
import type { ZnTagSet } from '../services/znTypes.ts';
import { ColorDot } from './ColorDot.tsx';
import * as S from './znStyles.ts';

const KINDS: SuggestionKind[] = ['phone', 'plate', 'iban', 'siret', 'nir', 'email', 'url', 'ipv4', 'ipv6', 'btc', 'eth', 'amount', 'date'];

const INPUT = 'w-full px-2 py-1 text-xs rounded border border-border-default bg-bg-primary text-text-primary focus:outline-none focus:border-accent';
const BUTTON_PRIMARY = 'bg-accent text-white hover:bg-accent-hover px-3 py-1.5 text-sm font-medium rounded sketchy-border disabled:opacity-50';
const BUTTON_SECONDARY = 'border border-border-default text-text-primary bg-bg-primary hover:bg-bg-secondary px-3 py-1.5 text-sm font-medium rounded sketchy-border';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const { X, Plus, ChevronUp } = api.icons;

  const [draft, setDraft] = React.useState<Settings>(() => structuredClone(getSettings()));
  /** Colors changed in this window, written to ZN's TagSets on save. */
  const [colors, setColors] = React.useState<Record<string, string | null>>({});
  const [aliasInput, setAliasInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<'tags' | 'aliases' | 'suggestions' | 'ocr'>('tags');
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
    { id: 'aliases' as const, label: t('settings_tab_aliases'), icon: api.icons.UserRound, hint: t('settings_aliases_hint') },
    { id: 'suggestions' as const, label: t('settings_tab_suggestions'), icon: api.icons.Sparkles },
    { id: 'ocr' as const, label: t('settings_tab_ocr'), icon: api.icons.ScanText },
  ];

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
        tabs.map(({ id, label, icon: Icon, hint }) =>
          h('button', {
            key: id,
            type: 'button',
            onClick: () => setTab(id),
            title: hint,
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
                h('input', { className: INPUT, value: g.tag, 'aria-label': t('field_tags'), onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setTag(i, e.target.value) }),
                h('button', { type: 'button', disabled: i === 0, onClick: () => moveUp(i), title: t('settings_move_up'), className: `${S.ICON_BUTTON} disabled:opacity-30` },
                  h(ChevronUp, { size: 14 })),
                h('button', { type: 'button', onClick: () => setProfile({ grid: profile.grid.filter((_, j) => j !== i) }), title: t('settings_remove'), className: S.ICON_BUTTON_DANGER },
                  h(X, { size: 14 }))))),
          profile.grid.length < MAX_GRID
            ? h('button', {
                type: 'button',
                onClick: () => setProfile({ grid: [...profile.grid, { tag: '', key: '' }] }),
                className: 'inline-flex items-center gap-1 px-2 py-0.5 text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary rounded border border-dashed border-border-default',
              }, h(Plus, { size: 12 }), t('tag_add'))
            : null),

        section('aliases', 
          h('div', { className: 'flex flex-wrap items-center gap-1.5' },
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

        section('suggestions', 
          h('div', { className: 'grid gap-x-2 gap-y-1 items-center', style: { gridTemplateColumns: '120px 1fr 1fr' } },
            h('span', null),
            h('span', { className: S.SMALL_LABEL }, t('field_tags')),
            h('span', { className: S.SMALL_LABEL }, t('field_key')),
            KINDS.flatMap((kind) => [
              h('span', { key: `${kind}-l`, className: 'text-xs text-text-secondary' }, t(`suggestion_kind_${kind}`)),
              h('input', {
                key: `${kind}-t`,
                className: INPUT,
                value: profile.suggestionTags[kind] ?? '',
                'aria-label': `${t(`suggestion_kind_${kind}`)} : ${t('field_tags')}`,
                onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setProfile({ suggestionTags: { ...profile.suggestionTags, [kind]: e.target.value } }),
              }),
              h('input', {
                key: `${kind}-k`,
                className: INPUT,
                value: profile.suggestionKeys[kind] ?? '',
                'aria-label': `${t(`suggestion_kind_${kind}`)} : ${t('field_key')}`,
                onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setProfile({ suggestionKeys: { ...profile.suggestionKeys, [kind]: e.target.value } }),
              }),
            ]))),

        section('ocr', 
          h('label', { className: 'flex items-center gap-2 text-xs text-text-primary' },
            h('input', {
              type: 'checkbox',
              checked: draft.ocr.dropColor,
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, ocr: { ...draft.ocr, dropColor: e.target.checked } }),
            }),
            t('settings_drop_color')))),

      h('div', { className: 'flex items-center gap-2 px-4 py-3 border-t border-border-default bg-bg-secondary' },
        h('button', { type: 'button', onClick: () => setDraft(structuredClone(normalizeSettings(DEFAULT_SETTINGS))), className: `${S.BUTTON_GHOST_SMALL} mr-auto` }, t('settings_defaults')),
        h('button', { type: 'button', onClick: onClose, className: BUTTON_SECONDARY }, t('cancel')),
        h('button', { type: 'button', disabled: busy, onClick: save, className: BUTTON_PRIMARY }, t('settings_save')))));
}
