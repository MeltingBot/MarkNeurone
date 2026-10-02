import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MAX_GRID, normalizeSettings } from './settings.ts';

describe('normalizeSettings', () => {
  it('gives the defaults when nothing is stored', () => {
    expect(normalizeSettings(undefined)).toEqual(normalizeSettings(DEFAULT_SETTINGS));
    expect(normalizeSettings(null).ocr.dropColor).toBe(true);
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
      profile: { aliasKeys: ['Surnom', ' ', 'surnom'], suggestionTags: { phone: 'Ligne', iban: '' }, suggestionKeys: { phone: 'Numéro' } },
      ocr: { dropColor: false },
    });
    expect(s.profile.aliasKeys).toEqual(['Surnom']);
    expect(s.profile.suggestionTags).toEqual({ phone: 'Ligne' });
    expect(s.profile.suggestionKeys).toEqual({ phone: 'Numéro' });
    expect(s.ocr.dropColor).toBe(false);
  });
});
