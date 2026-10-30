// ─── Form model files ────────────────────────────────────────
//
// Reading an imported JSON model, giving one back as a file, and keeping
// models in the settings: shared by the settings and the reader's panel.

import { normalizeFormModel, type FormModel, type ModelIssue } from '../core/formModel.ts';
import { getSettings, saveSettings } from './settingsStore.ts';

export type ModelFileResult = { model: FormModel; dropped: ModelIssue[] } | { model: null; dropped: ModelIssue[]; notJson?: true };

export async function readModelFile(file: File): Promise<ModelFileResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { model: null, dropped: [], notJson: true };
  }
  return normalizeFormModel(raw);
}

/** The model as a JSON file, saved by the browser (nothing leaves the computer). */
export function downloadModel(model: FormModel): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${model.name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Adds the model to the settings; one of the same id is replaced. */
export async function storeModel(model: FormModel): Promise<void> {
  const settings = getSettings();
  await saveSettings({ ...settings, formModels: [...settings.formModels.filter((m) => m.id !== model.id), model] });
}

export async function removeModel(id: string): Promise<void> {
  const settings = getSettings();
  await saveSettings({ ...settings, formModels: settings.formModels.filter((m) => m.id !== id) });
}
