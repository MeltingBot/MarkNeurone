import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MAX_GRID, normalizeSettings } from './settings.ts';
import { SUGGESTION_KINDS } from './suggestions.ts';

describe('normalizeSettings', () => {
  it('gives the defaults when nothing is stored', () => {
    expect(normalizeSettings(undefined)).toEqual(normalizeSettings(DEFAULT_SETTINGS));
    expect(normalizeSettings(null).ocr.dropColor).toBe(true);
    expect(normalizeSettings(null).labels.uppercase).toBe(false);
    expect(normalizeSettings({}).profile.grid[0]).toEqual({ tag: 'Personne', key: '1' });
  });

  it('cleans tag names and gives shortcuts by order', () => {
    const s = normalizeSettings({ profile: { grid: [{ tag: ' Témoin ' }, { tag: 'témoin' }, { tag: '' }, { tag: 'Suspect' }] } });
    expect(s.profile.grid).toEqual([{ tag: 'Témoin', key: '1' }, { tag: 'Suspect', key: '2' }]);
  });

  it('keeps at most nine tags', () => {
    const grid = Array.from({ length: 12 }, (_, i) => ({ tag: `T${i}` }));
    expect(normalizeSettings({ profile: { grid } }).profile.grid).toHaveLength(MAX_GRID);
  });

  it('keeps the stored values and drops empty ones', () => {
    const s = normalizeSettings({
      profile: {
        aliasKeys: ['Surnom', ' ', 'surnom'],
        suggestionTags: { phone: 'Ligne', iban: '' },
        suggestionKeys: { phone: 'Numéro' },
        suggestionKinds: SUGGESTION_KINDS,
      },
      ocr: { dropColor: false },
      labels: { uppercase: true },
    });
    expect(s.profile.aliasKeys).toEqual(['Surnom']);
    expect(s.profile.suggestionTags).toEqual({ phone: 'Ligne' });
    expect(s.profile.suggestionKeys).toEqual({ phone: 'Numéro' });
    expect(s.ocr.dropColor).toBe(false);
    expect(s.labels.uppercase).toBe(true);
  });
});

describe('suggestion kinds added after the settings were saved', () => {
  it('get their default tag and key, and the choices made stay', () => {
    // Saved with 1.0.0: no list of kinds, the Belgian number did not exist.
    const s = normalizeSettings({ profile: { suggestionTags: { phone: 'Ligne' }, suggestionKeys: { phone: 'Numéro' } } });
    expect(s.profile.suggestionTags).toEqual({ phone: 'Ligne', be_bce: 'Entreprise', ch_ide: 'Entreprise', lu_rcs: 'Entreprise', lu_tva: 'Entreprise' });
    expect(s.profile.suggestionKeys.be_nn).toBe('Numéro national');
    expect(s.profile.suggestionKeys.iban).toBeUndefined();
  });

  it('stay empty once the user has emptied them', () => {
    const s = normalizeSettings({ profile: { suggestionTags: {}, suggestionKeys: {}, suggestionKinds: SUGGESTION_KINDS } });
    expect(s.profile.suggestionTags).toEqual({});
    expect(s.profile.suggestionKeys).toEqual({});
  });
});

describe('link assistance settings', () => {
  it('are off by default', () => {
    expect(normalizeSettings(null).links).toEqual({ verb: false, cooccurrence: 'off' });
  });
  it('keep valid stored values only', () => {
    expect(normalizeSettings({ links: { verb: true, cooccurrence: 'paragraph' } }).links).toEqual({ verb: true, cooccurrence: 'paragraph' });
    expect(normalizeSettings({ links: { verb: 'yes', cooccurrence: 'page' } }).links).toEqual({ verb: false, cooccurrence: 'off' });
  });
});
