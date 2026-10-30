// ─── Plugin settings ─────────────────────────────────────────
//
// What the user can change, for every dossier: the reading profile (tags
// offered with their shortcuts, alias properties, what suggestions propose)
// and an OCR option. Stored values are merged over the defaults, so that a
// setting added later gets its default value.

import { DEFAULT_PROFILE, type ReadingProfile } from '../profiles/default.ts';
import { SUGGESTION_KINDS, type SuggestionKind } from './suggestions.ts';
import { COUNTRIES, type Country } from './patterns/regional.ts';
import { normalizeFormModel, type FormModel } from './formModel.ts';

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
  /** Countries whose identifiers are recognized besides the French ones, none by default. */
  identifiers: {
    countries: Country[];
  };
  /** Link assistance, off by default (analysis, sections 3 and 6). */
  links: {
    /** Highlighting the words of a relation proposes the nearest elements as its ends. */
    verb: boolean;
    /** Marks in the margin for two elements of one sentence or paragraph not linked yet. */
    cooccurrence: CooccurrenceScope;
  };
  /** Form models imported by the user (docs/lecture-formulaires.md). */
  formModels: FormModel[];
}

export type CooccurrenceScope = 'off' | 'sentence' | 'paragraph';
const SCOPES: CooccurrenceScope[] = ['off', 'sentence', 'paragraph'];

/** Alt+1 to Alt+9. */
export const MAX_GRID = 9;

export const DEFAULT_SETTINGS: Settings = {
  profile: DEFAULT_PROFILE,
  ocr: { dropColor: true },
  labels: { uppercase: false },
  identifiers: { countries: [] },
  links: { verb: false, cooccurrence: 'off' },
  formModels: [],
};

const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

function uniqueNames(values: unknown[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    const name = clean(v);
    if (name && !out.some((o) => o.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

// Kinds of the settings saved before the list was recorded (1.0.0).
const FIRST_KINDS: string[] = ['phone', 'plate', 'iban', 'siret', 'nir', 'email', 'url', 'ipv4', 'ipv6', 'btc', 'eth', 'amount', 'date'];

/** Stored names, plus the default of each kind unknown when they were saved. */
function cleanMap(value: unknown, fallback: Record<string, string | undefined>, known: string[]): Record<string, string> {
  if (!value || typeof value !== 'object') return { ...fallback } as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const name = clean(v);
    if (name) out[k] = name;
  }
  for (const [k, v] of Object.entries(fallback)) {
    if (v && !known.includes(k) && !(k in out)) out[k] = v;
  }
  return out;
}

/** Usable models, one per id (the last one imported wins). */
function formModels(value: unknown): FormModel[] {
  const out: FormModel[] = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const { model } = normalizeFormModel(raw);
    if (!model) continue;
    const i = out.findIndex((m) => m.id === model.id);
    if (i >= 0) out[i] = model;
    else out.push(model);
  }
  return out;
}

/**
 * Stored settings to usable ones: defaults for anything missing, tag names
 * trimmed and without duplicates, shortcuts given by the order (Alt+1 first).
 */
export function normalizeSettings(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as {
    profile?: Partial<ReadingProfile>;
    ocr?: Partial<Settings['ocr']>;
    labels?: Partial<Settings['labels']>;
    identifiers?: { countries?: unknown };
    links?: Partial<Record<keyof Settings['links'], unknown>>;
    formModels?: unknown;
  };
  const p: Partial<ReadingProfile> = s.profile ?? {};
  const known = Array.isArray(p.suggestionKinds) ? p.suggestionKinds.filter((k) => typeof k === 'string') : FIRST_KINDS;
  const tags = Array.isArray(p.grid) ? uniqueNames(p.grid.map((g: unknown) => (g as { tag?: unknown } | null)?.tag)) : DEFAULT_PROFILE.grid.map((g) => g.tag);
  return {
    profile: {
      id: DEFAULT_PROFILE.id,
      name: DEFAULT_PROFILE.name,
      grid: tags.slice(0, MAX_GRID).map((tag, i) => ({ tag, key: String(i + 1) })),
      aliasKeys: Array.isArray(p.aliasKeys) ? uniqueNames(p.aliasKeys) : [...DEFAULT_PROFILE.aliasKeys],
      suggestionTags: cleanMap(p.suggestionTags, DEFAULT_PROFILE.suggestionTags, known),
      suggestionKeys: cleanMap(p.suggestionKeys, DEFAULT_PROFILE.suggestionKeys, known),
      suggestionKinds: [...SUGGESTION_KINDS] as SuggestionKind[],
    },
    ocr: { dropColor: typeof s.ocr?.dropColor === 'boolean' ? s.ocr.dropColor : DEFAULT_SETTINGS.ocr.dropColor },
    labels: { uppercase: typeof s.labels?.uppercase === 'boolean' ? s.labels.uppercase : DEFAULT_SETTINGS.labels.uppercase },
    identifiers: {
      countries: Array.isArray(s.identifiers?.countries) ? COUNTRIES.filter((c) => (s.identifiers!.countries as unknown[]).includes(c)) : [],
    },
    links: {
      verb: typeof s.links?.verb === 'boolean' ? s.links.verb : DEFAULT_SETTINGS.links.verb,
      cooccurrence: SCOPES.includes(s.links?.cooccurrence as CooccurrenceScope) ? (s.links!.cooccurrence as CooccurrenceScope) : DEFAULT_SETTINGS.links.cooccurrence,
    },
    formModels: formModels(s.formModels),
  };
}
