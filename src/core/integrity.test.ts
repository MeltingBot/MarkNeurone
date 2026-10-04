import { describe, expect, it } from 'vitest';
import type { Annotation } from './model.ts';
import { anchorLabel } from './anchors.ts';
import { reconcile } from './integrity.ts';

const ann = (id: string, kind: Annotation['kind'], extra: Partial<Annotation> = {}): Annotation => ({
  id,
  documentId: 'asset',
  documentHash: 'hash',
  page: 1,
  quads: [],
  text: id,
  kind,
  status: 'validated',
  origin: 'manual',
  createdAt: '',
  ...extra,
});

const A_EL = 'aaaaaaaa-0000-4000-8000-000000000000';
const B_EL = 'bbbbbbbb-0000-4000-8000-000000000000';
const B_EV = 'cccccccc-0000-4000-8000-000000000000';
const B_LINK = 'dddddddd-0000-4000-8000-000000000000';
const label = (id: string) => anchorLabel('pv.pdf', 1, id);

// Before: "Jean Martin" (A) and "J. Martin" (B), each read in the PV; B has an
// event and a link to C. The user merges B into A in ZN.
const annotations = [
  ann(A_EL, 'element', { targetId: 'A' }),
  ann(B_EL, 'element', { targetId: 'B' }),
  ann(B_EV, 'event', { targetId: 'B', eventIds: { B: 'ev1' } }),
  ann(B_LINK, 'link', { targetId: 'L', linkEnds: ['B', 'C'] }),
];

const afterMerge = {
  elements: [
    // ZN concatenates sources and moves events onto the target.
    { id: 'A', source: `${label(A_EL)} ; ${label(B_EL)} ; ${label(B_EV)}`, events: [{ id: 'ev1', source: label(B_EV) }] },
    { id: 'C', source: '' },
  ],
  // The link is retargeted from B to A.
  links: [{ id: 'L', source: label(B_LINK), fromId: 'A', toId: 'C' }],
};

describe('reconcile after a merge', () => {
  const { annotations: out, changed } = reconcile(annotations, afterMerge);
  const byId = Object.fromEntries(out.map((a) => [a.id, a]));

  it('follows the merged element to the target', () => {
    expect(byId[B_EL]).toMatchObject({ targetId: 'A' });
    expect(byId[B_EL].orphan).toBeUndefined();
  });

  it('follows the moved event', () => {
    expect(byId[B_EV]).toMatchObject({ targetId: 'A', eventIds: { A: 'ev1' } });
  });

  it('updates the ends of a retargeted link', () => {
    expect(byId[B_LINK].linkEnds).toEqual(['A', 'C']);
  });

  it('reports where the merged element went', () => {
    expect(reconcile(annotations, afterMerge).moved).toEqual({ B: 'A' });
  });

  it('leaves untouched what did not move', () => {
    expect(byId[A_EL]).toBe(annotations[0]);
    expect(changed).toBe(3);
  });
});

describe('reconcile after undoing a merge', () => {
  it('sends the passage back to the restored element', () => {
    // After the merge the passage points at A; the undo restores B with its own source.
    const merged = ann(B_EL, 'element', { targetId: 'A' });
    const restored = {
      elements: [
        { id: 'A', source: label(A_EL) },
        { id: 'B', source: label(B_EL) },
      ],
      links: [],
    };
    const { annotations: out, moved } = reconcile([merged], restored);
    expect(out[0].targetId).toBe('B');
    // A still exists: a sheet open on A must not jump to B.
    expect(moved).toEqual({});
  });

  it('keeps a target whose source was edited by hand', () => {
    const { annotations: out, changed } = reconcile([ann(A_EL, 'element', { targetId: 'A' })], { elements: [{ id: 'A', source: 'réécrit' }], links: [] });
    expect(out[0].targetId).toBe('A');
    expect(changed).toBe(0);
  });
  it('leaves a rejected suggestion alone', () => {
    const rejected = ann(B_EL, 'suggestion', { status: 'rejected', origin: 'pattern' });
    const { annotations: out, changed } = reconcile([rejected], { elements: [{ id: 'A', source: '' }], links: [] });
    expect(changed).toBe(0);
    expect(out[0]).toEqual(rejected);
  });
});

describe('reconcile after a deletion and an undo', () => {
  it('flags an annotation whose element is gone, keeping its last target', () => {
    const { annotations: out } = reconcile([ann(A_EL, 'element', { targetId: 'A' })], { elements: [], links: [] });
    expect(out[0]).toMatchObject({ orphan: true, targetId: 'A' });
  });

  it('restores it when the element comes back', () => {
    const orphan = ann(A_EL, 'element', { targetId: 'A', orphan: true });
    const { annotations: out, changed } = reconcile([orphan], { elements: [{ id: 'A', source: label(A_EL) }], links: [] });
    expect(out[0].orphan).toBeUndefined();
    expect(changed).toBe(1);
  });

  it('reports no change when everything is in place', () => {
    const { changed } = reconcile([ann(A_EL, 'element', { targetId: 'A' })], { elements: [{ id: 'A', source: label(A_EL) }], links: [] });
    expect(changed).toBe(0);
  });
});

describe('property of an event', () => {
  const PROP = 'eeeeeeee-0000-4000-8000-000000000000';
  it('follows its event when the element is merged into another', () => {
    const a = ann(PROP, 'property', { targetId: 'B', propertyKey: 'Lieu', eventIds: { B: 'ev1' } });
    const graph = {
      elements: [{ id: 'A', source: label(PROP), events: [{ id: 'ev1', source: label(PROP) }] }],
      links: [],
    };
    const { annotations: [next] } = reconcile([a], graph);
    expect(next).toMatchObject({ targetId: 'A', eventIds: { A: 'ev1' } });
  });
});
