import { describe, expect, it } from 'vitest';
import type { Annotation } from './model.ts';
import { cooccurrences, elementHighlights, pairKey, verbEnds } from './linkAssist.ts';
import { paragraphRanges, sentenceRanges } from './sentences.ts';

const ann = (id: string, page: number, range: [number, number], targetId: string, extra: Partial<Annotation> = {}): Annotation => ({
  id,
  documentId: 'a',
  documentHash: 'h',
  page,
  quads: [],
  text: id,
  textRange: range,
  kind: 'element',
  status: 'validated',
  origin: 'manual',
  targetId,
  createdAt: '',
  ...extra,
});

//             0         1         2         3         4         5         6         7
//             0123456789012345678901234567890123456789012345678901234567890123456789012345
const text = 'M. VALLIER a cédé ses parts à la SARL BOIS. Le gérant DUVAL\nest absent.\n\nRien ici.';
const vallier = ann('v', 1, [3, 10], 'el-vallier');
const sarl = ann('s', 1, [33, 42], 'el-sarl');
const duval = ann('d', 1, [54, 59], 'el-duval');

describe('verbEnds', () => {
  it('proposes the nearest elements before and after the relation, within the sentence', () => {
    const highlights = elementHighlights([vallier, sarl, duval], 1);
    const relation: [number, number] = [11, 29]; // "a cédé ses parts à"
    const { from, to } = verbEnds(highlights, relation, [0, 43]);
    expect([from?.elementId, to?.elementId]).toEqual(['el-vallier', 'el-sarl']);
  });

  it('leaves an end empty when the sentence has no element on that side', () => {
    const { from, to } = verbEnds(elementHighlights([sarl], 1), [11, 29], [0, 43]);
    expect(from).toBeNull();
    expect(to?.elementId).toBe('el-sarl');
  });
});

describe('sentences and paragraphs', () => {
  it('splits sentences, not at "M."', () => {
    expect(sentenceRanges(text).map(([a, b]) => text.slice(a, b).trim())[0]).toBe('M. VALLIER a cédé ses parts à la SARL BOIS.');
  });
  it('splits paragraphs at a blank line or a line ending a sentence', () => {
    expect(paragraphRanges(text).map(([a, b]) => text.slice(a, b).trim())).toEqual([
      'M. VALLIER a cédé ses parts à la SARL BOIS. Le gérant DUVAL\nest absent.',
      'Rien ici.',
    ]);
  });
});

describe('cooccurrences', () => {
  it('pairs elements of one sentence that are not linked yet', () => {
    const found = cooccurrences([text], [vallier, sarl, duval], 'sentence', new Set(), new Set());
    expect(found.map((c) => c.key)).toEqual([pairKey('el-vallier', 'el-sarl')]);
    expect(found[0].from.id).toBe('v');
  });

  it('pairs elements of one paragraph when asked', () => {
    expect(cooccurrences([text], [vallier, sarl, duval], 'paragraph', new Set(), new Set())).toHaveLength(3);
  });

  it('leaves out linked and dismissed pairs, and passages of one element', () => {
    const linked = new Set([pairKey('el-sarl', 'el-vallier')]);
    expect(cooccurrences([text], [vallier, sarl], 'sentence', linked, new Set())).toEqual([]);
    expect(cooccurrences([text], [vallier, sarl], 'sentence', new Set(), new Set([pairKey('el-vallier', 'el-sarl')]))).toEqual([]);
    expect(cooccurrences([text], [vallier, ann('v2', 1, [33, 42], 'el-vallier')], 'sentence', new Set(), new Set())).toEqual([]);
  });

  it('ignores orphans, rejected highlights and links', () => {
    const orphan = ann('o', 1, [33, 42], 'el-sarl', { orphan: true });
    expect(cooccurrences([text], [vallier, orphan], 'sentence', new Set(), new Set())).toEqual([]);
  });
});
