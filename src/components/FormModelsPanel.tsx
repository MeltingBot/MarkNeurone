// ─── Form models panel ───────────────────────────────────────
//
// The models of the settings, managed from the reader: open one on the
// document, change it in the editor, export, delete, import, or draft a
// new one from the document. No need to go back to the home page.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { FormModel } from '../core/formModel.ts';
import * as S from './znStyles.ts';

interface Props {
  models: FormModel[];
  /** Ids of the models whose signature is on the document's first page. */
  matching: Set<string>;
  onOpen: (model: FormModel) => void;
  onEdit: (model: FormModel) => void;
  onExport: (model: FormModel) => void;
  onDelete: (model: FormModel) => void;
  onImport: (file: File) => void;
  onCreate: () => void;
  onClose: () => void;
  onCollapse: () => void;
}

export function FormModelsPanel(p: Props) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  // Models of this document first.
  const models = [...p.models].sort((a, b) => Number(p.matching.has(b.id)) - Number(p.matching.has(a.id)) || a.name.localeCompare(b.name));

  const iconButton = (title: string, icon: ReactTypes.ElementType, onClick: () => void, danger = false) =>
    h('button', { type: 'button', onClick, title, 'aria-label': title, className: `${danger ? S.ICON_BUTTON_DANGER : S.ICON_BUTTON} shrink-0` }, h(icon, { size: 13 }));

  return h('aside', { className: 'flex flex-col shrink-0 border-l border-border-default bg-bg-primary', style: { width: 'var(--mn-panel-width, 360px)' }, 'aria-label': t('models_title') },
    h('div', { className: 'flex items-center gap-2 px-4 py-3 border-b border-border-default' },
      h(api.icons.ClipboardList, { size: 14, className: 'text-text-tertiary shrink-0' }),
      h('span', { className: 'flex-1 text-sm font-semibold text-text-primary truncate' }, t('models_title')),
      iconButton(t('models_close'), api.icons.X, p.onClose),
      iconButton(t('sheet_collapse'), api.icons.PanelRightClose, p.onCollapse)),
    h('div', { className: 'flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1.5' },
      models.length
        ? models.map((m) => {
            const fits = p.matching.has(m.id);
            if (deleting === m.id) {
              return h('div', { key: m.id, className: 'flex items-center gap-2 px-2 py-1.5 rounded border border-border-default text-xs' },
                h('span', { className: 'flex-1 min-w-0 truncate text-text-primary' }, t('models_delete_confirm', { name: m.name })),
                h('button', { type: 'button', className: 'text-xs text-error hover:underline', onClick: () => { setDeleting(null); p.onDelete(m); } }, t('models_delete')),
                h('button', { type: 'button', className: 'text-xs text-accent hover:underline', onClick: () => setDeleting(null) }, t('cancel')));
            }
            return h('div', { key: m.id, className: 'flex items-center gap-1 rounded border border-border-default' },
              h('button', {
                type: 'button',
                disabled: !fits,
                onClick: () => p.onOpen(m),
                title: fits ? t('form_open_named', { name: m.name }) : t('models_not_matching'),
                className: 'flex-1 min-w-0 flex flex-col items-start px-2 py-1.5 text-left rounded hover:bg-bg-secondary disabled:hover:bg-transparent',
              },
                h('span', { className: `w-full truncate text-xs ${fits ? 'text-text-primary' : 'text-text-tertiary'}` }, m.name),
                h('span', { className: `${S.HINT} w-full truncate` }, m.sections.map((s) => s.titles[0]).join(', '))),
              iconButton(t('form_model_edit'), api.icons.Pencil, () => p.onEdit(m)),
              iconButton(t('settings_forms_export'), api.icons.Download, () => p.onExport(m)),
              iconButton(t('models_delete'), api.icons.Trash2, () => setDeleting(m.id), true));
          })
        : h('p', { className: 'text-xs text-text-tertiary' }, t('settings_forms_none'))),
    h('div', { className: 'px-4 py-3 border-t border-border-default bg-bg-secondary' },
      h('input', {
        ref: fileRef,
        type: 'file',
        accept: '.json,application/json',
        className: 'hidden',
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) p.onImport(file);
        },
      }),
      h('div', { className: S.BUTTON_ROW },
        h('button', { type: 'button', onClick: () => fileRef.current?.click(), className: S.BUTTON_SECONDARY_SMALL }, t('settings_forms_import')),
        h('button', { type: 'button', onClick: p.onCreate, className: S.BUTTON_PRIMARY_SMALL }, t('models_create')))));
}
