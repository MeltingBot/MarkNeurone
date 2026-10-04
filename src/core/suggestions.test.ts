import { describe, expect, it } from 'vitest';
import type { Annotation } from './model.ts';
import { buildSuggestions, scanNames } from './suggestions.ts';

const el = (id: string, label: string, aliases: string[] = []) => ({ id, label, aliases });
const spans = (text: string, matches: { start: number; end: number }[]) => matches.map((m) => text.slice(m.start, m.end));

describe('scanNames', () => {
  const elements = [el('terrier', 'Jules TERRIER', ['Le Grand']), el('castel', 'Castelroux'), el('x', 'Xu')];

  it('finds labels and aliases regardless of case and accents', () => {
    const text = 'Vu à CASTELROUX par jules terrier, dit le grand.';
    const found = scanNames(text, elements);
    expect(spans(text, found)).toEqual(['CASTELROUX', 'jules terrier', 'le grand']);
    expect(found.map((m) => m.elementIds)).toEqual([['castel'], ['terrier'], ['terrier']]);
  });

  it('accepts reversed order and an initial, over a line break', () => {
    const text = 'TERRIER Jules, puis J. Terrier et TERRIER,\nJ.';
    const found = scanNames(text, elements);
    expect(spans(text, found)).toEqual(['TERRIER Jules', 'J. Terrier', 'TERRIER,\nJ']);
    expect(found.map((m) => m.match)).toEqual(['reordered', 'initials', 'initials']);
  });

  it('ignores names too short to be told apart, and partial words', () => {
    expect(scanNames('Xu est là, Castelrouxien aussi', elements)).toEqual([]);
  });

  it('gives one span to homonyms', () => {
    const found = scanNames('Marie DUPONT est venue.', [el('a', 'Marie DUPONT'), el('b', 'Marie Dupont')]);
    expect(found).toEqual([{ start: 0, end: 12, elementIds: ['a', 'b'], match: 'exact' }]);
  });

  it('prefers the longer name', () => {
    const text = 'Jules TERRIER';
    expect(spans(text, scanNames(text, [el('a', 'Terrier'), el('b', 'Jules Terrier')]))).toEqual(['Jules TERRIER']);
  });
});

describe('buildSuggestions', () => {
  const text = 'Jules TERRIER au 04 60 48 05 02 le 16 février 2025.';
  const ann = (extra: Partial<Annotation>): Annotation => ({
    id: 'a', documentId: 'd', documentHash: 'h', page: 1, quads: [], text: '', kind: 'element', status: 'validated', origin: 'manual', createdAt: '', ...extra,
  });

  it('lists names and patterns of every page', () => {
    const out = buildSuggestions([text, 'rien'], [el('t', 'Jules Terrier')], []);
    expect(out.map((s) => [s.page, s.source, s.kind, text.slice(s.start, s.end)])).toEqual([
      [1, 'dictionary', 'name', 'Jules TERRIER'],
      [1, 'pattern', 'phone', '04 60 48 05 02'],
      [1, 'pattern', 'date', '16 février 2025'],
    ]);
  });

  it('drops what is already highlighted or rejected', () => {
    const out = buildSuggestions([text], [el('t', 'Jules Terrier')], [
      ann({ textRange: [6, 13] }),
      ann({ kind: 'suggestion', status: 'rejected', origin: 'pattern', textRange: [17, 31] }),
    ]);
    expect(out.map((s) => s.kind)).toEqual(['date']);
  });

  it('prefers a known element over its pattern', () => {
    const out = buildSuggestions([text], [el('p', '04 60 48 05 02')], []);
    expect(out.find((s) => s.start === 17)).toMatchObject({ source: 'dictionary', elementIds: ['p'] });
  });
});
