import { describe, expect, it } from 'vitest';
import { findInPages, normalizeForSearch } from './search.ts';

describe('normalizeForSearch', () => {
  it('drops case and accents, collapses whitespace, and maps back', () => {
    const n = normalizeForSearch('Le  Dépôt\nÉtat');
    expect(n.text).toBe('le depot etat');
    // "depot" starts at the original "D".
    expect(n.map[n.text.indexOf('depot')]).toBe(4);
  });
});

describe('findInPages', () => {
  const pages = [
    'Solène DELARZE, demeurant 23 impasse des Glycines à\nVilleneuve-la-Garenne-Haute.',
    'Rien ici.',
    'Retour à villeneuve-la-garenne-haute le soir, puis VILLENEUVE.',
  ];

  it('finds every occurrence, insensitive to case and accents', () => {
    const hits = findInPages(pages, 'villeneuve-la-garenne');
    expect(hits.map((h) => h.page)).toEqual([1, 3]);
    expect(pages[0].slice(hits[0].start, hits[0].end)).toBe('Villeneuve-la-Garenne');
  });

  it('matches across a line break', () => {
    const [hit] = findInPages(pages, 'glycines a villeneuve');
    expect(pages[0].slice(hit.start, hit.end)).toBe('Glycines à\nVilleneuve');
  });

  it('matches accented text from a plain query, and the reverse', () => {
    expect(findInPages(pages, 'solene')).toHaveLength(1);
    expect(findInPages(['Solene'], 'Solène')).toHaveLength(1);
  });

  it('returns nothing for an empty query', () => {
    expect(findInPages(pages, '   ')).toEqual([]);
  });

  it('counts repeated occurrences on one page', () => {
    expect(findInPages(pages, 'villeneuve').filter((h) => h.page === 3)).toHaveLength(2);
  });
});
