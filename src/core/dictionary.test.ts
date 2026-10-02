import { describe, expect, it } from 'vitest';
import { defaultAttachment, findCandidates, matchName, normalizeName } from './dictionary.ts';

describe('normalizeName', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalizeName("  Société  ARVALIS-Trading, l'Été ")).toBe('societe arvalis trading l ete');
  });
});

describe('matchName', () => {
  it('detects an exact match', () => {
    expect(matchName('jean MARTIN', 'Jean Martin')).toBe('exact');
    expect(matchName('Trévoux', 'TREVOUX')).toBe('exact');
  });

  it('detects a first name / last name inversion', () => {
    expect(matchName('MARTIN Jean', 'Jean Martin')).toBe('reordered');
  });

  it('detects initials, in either order', () => {
    expect(matchName('J. Martin', 'Jean Martin')).toBe('initials');
    expect(matchName('MARTIN J.', 'Jean Martin')).toBe('initials');
  });

  it('rejects partial or loose matches', () => {
    expect(matchName('Martin', 'Jean Martin')).toBeNull();
    expect(matchName('J. M.', 'Jean Martin')).toBeNull();
    expect(matchName('Jacques Martin', 'Jean Martin')).toBeNull();
  });
});

describe('candidates and default attachment', () => {
  const elements = [
    { id: 'a', label: 'Jean Martin', aliases: [] },
    { id: 'b', label: 'Jacques Martin', aliases: [] },
    { id: 'c', label: 'Société Arvalis', aliases: ['Arvalis Trading'] },
  ];

  it('lists every compatible element, exact first', () => {
    expect(findCandidates('J. Martin', elements).map((c) => c.elementId)).toEqual(['a', 'b']);
  });

  it('never attaches by default on initials', () => {
    expect(defaultAttachment(findCandidates('J. Martin', elements))).toBeNull();
  });

  it('attaches by default on a single exact match, aliases included', () => {
    expect(defaultAttachment(findCandidates('ARVALIS TRADING', elements))).toBe('c');
  });

  it('does not attach by default when homonyms already exist', () => {
    const twins = [
      { id: 'a', label: 'Jean Martin', aliases: [] },
      { id: 'z', label: 'Jean Martin', aliases: [] },
    ];
    expect(defaultAttachment(findCandidates('Jean Martin', twins))).toBeNull();
  });
});
