import { describe, expect, it } from 'vitest';
import { betweenRange, cleanSelection, sentenceAt, trimPunctuation } from './sentences.ts';

const PAGE = 'Le gérant a rencontré M. Duval le 4 mai.\nIl lui a ensuite\nremis une enveloppe. Fin du PV.';

describe('sentenceAt', () => {
  it('returns the sentence containing the passage, across line breaks', () => {
    const start = PAGE.indexOf('remis');
    const s = sentenceAt(PAGE, start, start + 5);
    expect(s?.text).toBe('Il lui a ensuite remis une enveloppe.');
  });

  it('joins sentences when the passage spans two of them', () => {
    const start = PAGE.indexOf('4 mai');
    const end = PAGE.indexOf('ensuite');
    expect(sentenceAt(PAGE, start, end)?.text).toBe(
      'Le gérant a rencontré M. Duval le 4 mai. Il lui a ensuite remis une enveloppe.',
    );
  });

  it('does not split after titles and initials', () => {
    const text = 'Me Lefort et J. Martin ont vu M. Duval. Fin.';
    const start = text.indexOf('Duval');
    expect(sentenceAt(text, start, start + 5)?.text).toBe('Me Lefort et J. Martin ont vu M. Duval.');
  });

  it('keeps offsets in the original text', () => {
    const start = PAGE.indexOf('Fin');
    const s = sentenceAt(PAGE, start, start + 3)!;
    expect(PAGE.slice(s.start, s.end).trim()).toBe('Fin du PV.');
  });
});

describe('cleanSelection', () => {
  it('collapses whitespace', () => {
    expect(cleanSelection('  Société\nArvalis   Trading ')).toBe('Société Arvalis Trading');
  });
});

describe('trimPunctuation', () => {
  it('drops punctuation caught at the edges', () => {
    expect(trimPunctuation('Castelroux."')).toBe('Castelroux');
    expect(trimPunctuation('« Société Arvalis »,')).toBe('Société Arvalis');
    expect(trimPunctuation('(M. Duval)')).toBe('M. Duval');
  });

  it('keeps inner punctuation and abbreviations at the start', () => {
    expect(trimPunctuation('WM-834-AB')).toBe('WM-834-AB');
    expect(trimPunctuation('04.60.48.05.02,')).toBe('04.60.48.05.02');
  });
});

describe('betweenRange', () => {
  const text = 'La société Arvalis a versé 15 000 € à\nM. Duval, son gérant. Fin.';
  const arvalis: [number, number] = [text.indexOf('Arvalis'), text.indexOf('Arvalis') + 7];
  const duval: [number, number] = [text.indexOf('M. Duval'), text.indexOf('M. Duval') + 8];

  it('returns the words between two passages of one sentence', () => {
    const r = betweenRange(text, arvalis, duval)!;
    expect(text.slice(r[0], r[1]).replace(/\s+/g, ' ')).toBe('a versé 15 000 € à');
  });

  it('does not depend on click order', () => {
    expect(betweenRange(text, duval, arvalis)).toEqual(betweenRange(text, arvalis, duval));
  });

  it('returns null across sentences or for adjacent passages', () => {
    const fin: [number, number] = [text.indexOf('Fin'), text.indexOf('Fin') + 3];
    expect(betweenRange(text, arvalis, fin)).toBeNull();
    const versé: [number, number] = [text.indexOf('a versé'), text.indexOf('a versé') + 7];
    expect(betweenRange(text, [arvalis[0], versé[0] - 1], versé)).toBeNull();
  });
});
