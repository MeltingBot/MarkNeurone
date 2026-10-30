import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Annotation } from '../core/model.ts';

const calls: { fn: string; args: unknown[] }[] = [];
const graphEls: Record<string, { id: string; source: string; events: { source?: string }[] }> = {};
const graphLinks: Record<string, { id: string; fromId: string; toId: string; source: string }> = {};
const saved: Annotation[] = [];

vi.mock('../hostAPI.ts', () => ({ getHostAPI: () => ({ generateUUID: () => '1a2b3c4d-0000-4000-8000-000000000000' }) }));
vi.mock('./graphWriter.ts', () => ({
  attachAnchor: async (...args: unknown[]) => void calls.push({ fn: 'attachAnchor', args }),
  attachEventAnchor: async (...args: unknown[]) => void calls.push({ fn: 'attachEventAnchor', args }),
  addProperty: async (...args: unknown[]) => void calls.push({ fn: 'addProperty', args }),
  createElement: async (...args: unknown[]) => {
    calls.push({ fn: 'createElement', args });
    return { id: 'new' };
  },
  attachImage: async (...args: unknown[]) => void calls.push({ fn: 'attachImage', args }),
  getElement: (id: string) => graphEls[id] ?? (id === 'el' ? { id, label: 'Jean DUPONT' } : undefined),
  getLink: (id: string) => graphLinks[id],
  deleteLink: async (...args: unknown[]) => void calls.push({ fn: 'deleteLink', args }),
  deleteElements: async (...args: unknown[]) => void calls.push({ fn: 'deleteElements', args }),
  detachAnchor: async (...args: unknown[]) => void calls.push({ fn: 'detachAnchor', args }),
  detachLinkAnchor: async (...args: unknown[]) => void calls.push({ fn: 'detachLinkAnchor', args }),
}));
vi.mock('./annotationStore.ts', () => ({
  saveAnnotation: async (_dossierId: string, a: Annotation) => void saved.push(a),
  removeAnnotation: async (...args: unknown[]) => void calls.push({ fn: 'removeAnnotation', args }),
}));
const { clearDocument, planClear, qualifyAsExistingElement, qualifyAsExistingProperty, qualifyAsNewElement, removeOrphans, validatePassage } = await import('./qualify.ts');

const ctx = { dossierId: 'd', asset: { id: 'a', hash: 'h', filename: 'pv.pdf', mimeType: 'application/pdf', size: 1 }, reference: 'PV n° 347' };
const passage = { page: 2, quads: [], text: '06 12 34 56 78', clientBox: { left: 0, top: 0, right: 0, bottom: 0 } };

describe('qualifyAsExistingProperty', () => {
  beforeEach(() => {
    calls.length = 0;
    saved.length = 0;
  });

  it('anchors the passage on the element, without touching its properties', async () => {
    await qualifyAsExistingProperty(ctx, passage, 'el', 'Téléphone');
    expect(calls).toEqual([{ fn: 'attachAnchor', args: ['el', '[PV n° 347 p.2](mn:1a2b3c4d)'] }]);
    expect(saved[0]).toMatchObject({ kind: 'property', targetId: 'el', propertyKey: 'Téléphone', text: '06 12 34 56 78' });
    expect(saved[0]).not.toHaveProperty('eventIds');
  });

  it('anchors the passage on an event of the element, and keeps the event', async () => {
    await qualifyAsExistingProperty(ctx, passage, 'el', 'Lieu', 'ev');
    expect(calls).toEqual([{ fn: 'attachEventAnchor', args: ['el', 'ev', '[PV n° 347 p.2](mn:1a2b3c4d)'] }]);
    expect(saved[0]).toMatchObject({ kind: 'property', targetId: 'el', propertyKey: 'Lieu', eventIds: { el: 'ev' } });
  });
});

describe('framed picture', () => {
  // 1x1 JPEG-like payload: only the data URL shape matters here.
  const picture = {
    page: 3,
    quads: [[10, 20, 110, 220]] as [number, number, number, number][],
    text: '',
    area: true as const,
    preview: { image: `data:image/jpeg;base64,${btoa('jpeg')}`, lines: [], framed: true },
    clientBox: { left: 0, top: 0, right: 0, bottom: 0 },
  };

  beforeEach(() => {
    calls.length = 0;
    saved.length = 0;
  });

  it('makes an element named by the user, with the picture on it', async () => {
    await qualifyAsNewElement(ctx, picture, 'Photo du véhicule', ['Véhicule'], { attachImage: true });
    expect(calls[0]).toEqual({ fn: 'createElement', args: ['Photo du véhicule', ['Véhicule'], '[PV n° 347 p.3](mn:1a2b3c4d)', undefined] });
    expect(saved[0]).toMatchObject({ kind: 'element', targetId: 'new', text: 'Photo du véhicule', area: true, quads: picture.quads });
    expect(saved[0]).not.toHaveProperty('textRange');
    const image = calls.find((c) => c.fn === 'attachImage');
    expect(image?.args[0]).toBe('new');
    const file = image?.args[1] as File;
    expect([file.name, file.type, file.size]).toEqual(['PV n° 347 p.3.jpg', 'image/jpeg', 4]);
  });

  it('on an existing element, the passage takes its name', async () => {
    await qualifyAsExistingElement(ctx, picture, 'el', { attachImage: true });
    expect(saved[0]).toMatchObject({ targetId: 'el', text: 'Jean DUPONT', area: true });
    expect(calls.map((c) => c.fn)).toEqual(['attachAnchor', 'attachImage']);
  });

  it('leaves the element without the picture when the user unticks it', async () => {
    await qualifyAsNewElement(ctx, picture, 'Signature', [], { attachImage: false });
    expect(calls.map((c) => c.fn)).toEqual(['createElement']);
  });
});

describe('validatePassage', () => {
  it('turns a passage to check into a validated one, keeping its origin', async () => {
    saved.length = 0;
    const a = { id: 'x', documentId: 'a', documentHash: 'h', page: 1, quads: [], text: 'ALPHA', kind: 'element', status: 'suggested', origin: 'oneneurone', createdAt: '' } as Annotation;
    await validatePassage(ctx, a);
    expect(saved[0]).toMatchObject({ id: 'x', status: 'validated', origin: 'oneneurone' });
  });
});

describe('removeOrphans', () => {
  it('removes only the highlights whose object is gone, never a graph object', async () => {
    calls.length = 0;
    const base = { documentId: 'a', documentHash: 'h', page: 1, quads: [], text: 'x', status: 'validated', origin: 'oneneurone', createdAt: '' };
    await removeOrphans('d', [
      { ...base, id: 'o1', kind: 'element', targetId: 'gone', orphan: true },
      { ...base, id: 'o2', kind: 'link', targetId: 'lost', linkEnds: ['a', 'b'], orphan: true },
      { ...base, id: 'ok', kind: 'element', targetId: 'el' },
    ] as Annotation[]);
    expect(calls.filter((c) => c.fn === 'removeAnnotation').map((c) => c.args[2])).toEqual(['o1', 'o2']);
    expect(calls.some((c) => c.args.includes('ok'))).toBe(false);
  });
});

describe('clearing a document', () => {
  const ann = (id: string, kind: Annotation['kind'], targetId: string, extra: Partial<Annotation> = {}): Annotation =>
    ({ id, documentId: 'a', documentHash: 'h', page: 1, quads: [], text: 'x', kind, status: 'validated', origin: 'profile', targetId, createdAt: '', ...extra }) as Annotation;
  const anchor = (id: string) => `[PV p.1](mn:${id.slice(0, 8)})`;

  it('removes only the elements created here with no other source, and links between elements that stay', async () => {
    calls.length = 0;
    graphEls.e1 = { id: 'e1', source: `${anchor('11111111')} ; ${anchor('22222222')}`, events: [] };
    graphEls.e2 = { id: 'e2', source: `${anchor('33333333')} ; [PV autre p.4](mn:99999999)`, events: [] };
    graphEls.e3 = { id: 'e3', source: anchor('44444444'), events: [] };
    graphEls.e4 = { id: 'e4', source: '', events: [] };
    graphLinks.l1 = { id: 'l1', fromId: 'e2', toId: 'e3', source: anchor('55555555') };
    graphLinks.l2 = { id: 'l2', fromId: 'e1', toId: 'e2', source: anchor('66666666') };
    const list = [
      ann('11111111', 'element', 'e1', { created: true }),
      ann('22222222', 'property', 'e1', { propertyKey: 'Téléphone' }),
      ann('33333333', 'element', 'e2', { created: true }),
      ann('44444444', 'element', 'e3'),
      ann('55555555', 'link', 'l1', { linkEnds: ['e2', 'e3'] }),
      ann('66666666', 'link', 'l2', { linkEnds: ['e1', 'e2'] }),
    ];
    const plan = planClear(list);
    // e2 has another document, e3 was only attached here.
    expect(plan.elementIds).toEqual(['e1']);
    // l2 goes with e1.
    expect(plan.linkIds).toEqual(['l1']);
    await clearDocument('d', plan, true);
    expect(calls.slice(0, 2)).toEqual([{ fn: 'deleteLink', args: ['l1'] }, { fn: 'deleteElements', args: [['e1']] }]);
    expect(calls.filter((c) => c.fn === 'removeAnnotation')).toHaveLength(6);
  });

  it('keeps the graph when the user only clears the highlights', async () => {
    calls.length = 0;
    await clearDocument('d', { annotations: [ann('11111111', 'element', 'e1', { created: true })], elementIds: ['e1'], linkIds: [] }, false);
    expect(calls.map((c) => c.fn)).toEqual(['detachAnchor', 'removeAnnotation']);
  });
});
