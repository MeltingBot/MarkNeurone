// ─── Settings store ──────────────────────────────────────────
//
// Global plugin data (not tied to a dossier), loaded once at start and kept
// in memory; components re-render through subscribe/getSettingsVersion.

import { getHostAPI } from '../hostAPI.ts';
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from '../core/settings.ts';
import type { ReadingProfile } from '../profiles/default.ts';

const KEY = 'settings';

let current: Settings = normalizeSettings(DEFAULT_SETTINGS);
let version = 0;
const listeners = new Set<() => void>();

function publish(next: Settings): void {
  current = next;
  version++;
  listeners.forEach((l) => l());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSettingsVersion = () => version;
export const getSettings = (): Settings => current;
export const getProfile = (): ReadingProfile => current.profile;

export async function loadSettings(): Promise<void> {
  publish(normalizeSettings(await getHostAPI().pluginData.getGlobal(KEY)));
}

export async function saveSettings(next: Settings): Promise<void> {
  const clean = normalizeSettings(next);
  await getHostAPI().pluginData.setGlobal(KEY, clean);
  publish(clean);
}

// ─── Opening the settings window from the home card ──────────

let opener: ((open: boolean) => void) | null = null;
export function setSettingsOpener(fn: ((open: boolean) => void) | null): void {
  opener = fn;
}
export function openSettings(): void {
  opener?.(true);
}
