import { describe, expect, it } from 'vitest';
import type { Annotation } from './model.ts';
import { documentIndex } from './documentIndex.ts';

const ann = (id: string, page: number, start: number, extra: Partial<Annotation>): Annotation => ({
  id,
  documentId: 'a',
  documentHash: 'h',
  page,
  quads: [],
  text: id,
  textRange: [start, start + 3],
  kind: 'element',
  status: 'validated',
  origin: 'manual',
  createdAt: '',
  ...extra,
});

describe('documentIndex', () => {
  it('lists highlighted elements by first appearance, with their passage count', () => {
    const index = documentIndex([
      ann('1', 2, 10, { targetId: 'martin' }),
      ann('2', 1, 50, { targetId: 'vallier' }),
      ann('3', 1, 5, { kind: 'property', targetId: 'martin' }),
      ann('4', 3, 0, { kind: 'event', targetId: 'vallier', eventIds: { vallier: 'e1', carrere: 'e2' } }),
    ]);
    expect(index.map((e) => [e.elementId, e.count, e.first.id])).toEqual([
      ['martin', 2, '3'],
      ['vallier', 2, '2'],
      ['carrere', 1, '4'],
    ]);
  });

  it('leaves out links, suggestions, rejected and orphan highlights', () => {
    expect(
      documentIndex([
        ann('1', 1, 0, { kind: 'link', targetId: 'l' }),
        ann('2', 1, 0, { kind: 'suggestion', status: 'rejected' }),
        ann('3', 1, 0, { targetId: 'x', orphan: true }),
      ]),
    ).toEqual([]);
  });
});

describe('documentIndex, passages to check', () => {
  it('lists elements whose passages are still to be checked, and counts them', () => {
    const index = documentIndex([
      ann('1', 1, 10, { targetId: 'claire', status: 'suggested', origin: 'oneneurone' }),
      ann('2', 1, 50, { targetId: 'claire' }),
      ann('3', 1, 70, { targetId: 'thomas', status: 'rejected' }),
    ]);
    expect(index.map((e) => [e.elementId, e.count, e.toCheck])).toEqual([['claire', 2, 1]]);
  });
});
