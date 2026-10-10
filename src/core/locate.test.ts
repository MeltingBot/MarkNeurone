import { describe, expect, it } from 'vitest';
import { locatePassage } from './locate.ts';

const p1 = 'Le 24 septembre 2025, nous entendons Paulette MARTIN. Se présente Paul DURAND, gérant de la société ALPHA.\n'
  + 'Il déclare avoir vendu le véhicule à Hector PLANCHAUD le 3 mars 2024.';
const p2 = 'Paul DURAND confirme. La société ALPHA a été dissoute le 1er juin 2025.';
const pages = [p1, p2];
const at = (page: number, from: string, to?: string) => {
  const text = pages[page - 1];
  const start = text.indexOf(from);
  return { page, start, end: to ? text.indexOf(to, start) + to.length : start + from.length };
};

describe('locatePassage', () => {
  it('finds an element by its whole name, not inside another word', () => {
    expect(locatePassage(pages, { kind: 'element', text: 'Paul DURAND' })).toEqual(at(1, 'Paul DURAND'));
    // "Paul" alone: Paulette is skipped.
    expect(locatePassage(pages, { kind: 'element', text: 'paul' })).toEqual(at(1, 'Paul DURAND', 'Paul'));
  });

  it('keeps to the part of the document the extraction came from', () => {
    const start = p2.indexOf('Paul');
    expect(locatePassage(pages, { kind: 'element', text: 'Paul DURAND', hint: { page: 2, start, end: p2.length } })).toEqual(at(2, 'Paul DURAND'));
  });

  it('takes, in one sentence, the words from one end of a link to the other', () => {
    expect(locatePassage(pages, { kind: 'link', text: 'Paul DURAND', otherName: 'ALPHA' })).toEqual(at(1, 'Paul DURAND', 'ALPHA'));
    expect(locatePassage(pages, { kind: 'link', text: 'Paulette MARTIN', otherName: 'ALPHA' })).toBeNull();
  });

  it('takes the words from the name to the date of an event, or the sentence of a date found once', () => {
    expect(locatePassage(pages, { kind: 'event', text: 'Hector PLANCHAUD', date: '2024-03-03' })).toEqual(at(1, 'Hector PLANCHAUD', '2024'));
    // The date alone, borne by one sentence only.
    expect(locatePassage(pages, { kind: 'event', text: 'Dissolution ALPHA SAS', date: '2025-06-01' })).toEqual(at(2, 'La société', '2025.'));
    expect(locatePassage(pages, { kind: 'event', text: 'X', date: '2020-01-01' })).toBeNull();
  });

  it('starts from a quotation when one is given', () => {
    expect(locatePassage(pages, { kind: 'element', text: 'ALPHA', context: 'La société ALPHA a été dissoute' })).toEqual(at(2, 'ALPHA'));
    expect(locatePassage(pages, { kind: 'link', text: 'Paul DURAND', otherName: 'ALPHA', context: 'Paul DURAND confirme' })).toEqual(at(2, 'Paul DURAND confirme'));
  });

  it('returns null when the name is not in the document', () => {
    expect(locatePassage(pages, { kind: 'element', text: 'Jean DUPONT' })).toBeNull();
    expect(locatePassage([], { kind: 'element', text: 'Paul' })).toBeNull();
  });
});
