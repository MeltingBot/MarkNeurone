// ─── Plugin settings ─────────────────────────────────────────
//
// What the user can change, for every dossier: the reading profile (tags
// offered with their shortcuts, alias properties, what suggestions propose)
// and an OCR option. Stored values are merged over the defaults, so that a
// setting added later gets its default value.

import { DEFAULT_PROFILE, type ReadingProfile } from '../profiles/default.ts';

export interface Settings {
  profile: ReadingProfile;
  ocr: {
    /** Remove coloured ink (stamps) before recognition. */
    dropColor: boolean;
  };
  labels: {
    /** Offer the passage in capitals as the name of a new element. */
    uppercase: boolean;
  };
}

/** Alt+1 to Alt+9. */
export const MAX_GRID = 9;

export const DEFAULT_SETTINGS: Settings = { profile: DEFAULT_PROFILE, ocr: { dropColor: true }, labels: { uppercase: false } };

const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

function uniqueNames(values: unknown[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const name = clean(v);
    if (name && !out.some((o) => o.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

function cleanMap(value: unknown, fallback: Record<string, string | undefined>): Record<string, string> {
  if (!value || typeof value !== 'object') return { ...fallback } as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const name = clean(v);
    if (name) out[k] = name;
  }
  return out;
}

/**
 * Stored settings to usable ones: defaults for anything missing, tag names
 * trimmed and without duplicates, shortcuts given by the order (Alt+1 first).
 */
export function normalizeSettings(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as { profile?: Partial<ReadingProfile>; ocr?: Partial<Settings['ocr']>; labels?: Partial<Settings['labels']> };
  const p: Partial<ReadingProfile> = s.profile ?? {};
  const tags = Array.isArray(p.grid) ? uniqueNames(p.grid.map((g: unknown) => (g as { tag?: unknown } | null)?.tag)) : DEFAULT_PROFILE.grid.map((g) => g.tag);
  return {
    profile: {
      id: DEFAULT_PROFILE.id,
      name: DEFAULT_PROFILE.name,
      grid: tags.slice(0, MAX_GRID).map((tag, i) => ({ tag, key: String(i + 1) })),
      aliasKeys: Array.isArray(p.aliasKeys) ? uniqueNames(p.aliasKeys) : [...DEFAULT_PROFILE.aliasKeys],
      suggestionTags: cleanMap(p.suggestionTags, DEFAULT_PROFILE.suggestionTags),
      suggestionKeys: cleanMap(p.suggestionKeys, DEFAULT_PROFILE.suggestionKeys),
    },
    ocr: { dropColor: typeof s.ocr?.dropColor === 'boolean' ? s.ocr.dropColor : DEFAULT_SETTINGS.ocr.dropColor },
    labels: { uppercase: typeof s.labels?.uppercase === 'boolean' ? s.labels.uppercase : DEFAULT_SETTINGS.labels.uppercase },
  };
}
