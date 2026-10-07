import { describe, expect, it } from 'vitest';
import type { Annotation } from './model.ts';
import { anchorLabel } from './anchors.ts';
import { buildExport, mergeAnnotations, parseExport, rewire, sanitizeAnnotation, EXPORT_FORMAT } from './annotationTransfer.ts';

const HASH = 'e770f9de2b679d8cc843daa088acf5b8554845b61c79a94bdabae164613401d1';

const ann = (id: string, kind: Annotation['kind'], extra: Partial<Annotation> = {}): Annotation => ({
  id,
  documentId: 'old-asset',
  documentHash: HASH,
  page: 1,
  quads: [[70, 730, 300, 742]],
  text: id,
  kind,
  status: 'validated',
  origin: 'manual',
  targetId: 'old-target',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

// UUID-like ids: the anchor token uses their first 8 hex digits.
const ELEMENT = '11111111-0000-4000-8000-000000000000';
const PROPERTY = '22222222-0000-4000-8000-000000000000';
const EVENT = '33333333-0000-4000-8000-000000000000';
const LINK = '44444444-0000-4000-8000-000000000000';
const LOST = '55555555-0000-4000-8000-000000000000';

describe('buildExport / parseExport', () => {
  it('round-trips and skips empty documents', () => {
    const file = buildExport([{ hash: HASH, annotations: [ann(ELEMENT, 'element')] }, { hash: 'empty', annotations: [] }], 'T');
    expect(file?.documents).toHaveLength(1);
    expect(parseExport(JSON.parse(JSON.stringify(file)))?.documents[0].annotations[0].id).toBe(ELEMENT);
  });

  it('returns null when there is nothing to export', () => {
    expect(buildExport([{ hash: HASH, annotations: [] }])).toBeNull();
  });

  it('refuses a foreign or newer file and drops malformed annotations', () => {
    expect(parseExport({ format: 'other', version: 1, documents: [] })).toBeNull();
    expect(parseExport({ format: EXPORT_FORMAT, version: 99, documents: [] })).toBeNull();
    const parsed = parseExport({ format: EXPORT_FORMAT, version: 1, documents: [{ hash: HASH, annotations: [{ id: 'x' }, ann(ELEMENT, 'element')] }] });
    expect(parsed?.documents[0].annotations.map((a) => a.id)).toEqual([ELEMENT]);
  });
});

describe('sanitizeAnnotation', () => {
  const file = (hash: string, annotations: unknown[]) => parseExport({ format: EXPORT_FORMAT, version: 1, documents: [{ hash, annotations }] });

  it('refuses a document hash that is not a SHA-256', () => {
    expect(file('../ann-index', [ann(ELEMENT, 'element', { documentHash: '../ann-index' })])?.documents).toEqual([]);
    expect(file(HASH.toUpperCase(), [])?.documents).toEqual([]);
  });

  it('drops an annotation filed under another document', () => {
    expect(sanitizeAnnotation(ann(ELEMENT, 'element', { documentHash: 'f'.repeat(64) }), HASH)).toBeNull();
  });

  it('drops malformed quads, pages, statuses and origins', () => {
    const bad = [
      { quads: [[1, 2, 3]] },
      { quads: [[1, 2, 3, '4']] },
      { quads: [[1, 2, 3, null]] },
      { page: 0 },
      { page: 1.5 },
      { status: 'accepted' },
      { origin: 'network' },
    ];
    for (const extra of bad) expect(sanitizeAnnotation({ ...ann(ELEMENT, 'element'), ...extra }, HASH), JSON.stringify(extra)).toBeNull();
  });

  it('keeps known fields only, with their expected types', () => {
    const a = sanitizeAnnotation(
      {
        ...ann(ELEMENT, 'event'),
        injected: '<img src=x onerror=alert(1)>',
        textRange: [4, 2],
        linkEnds: ['a'],
        eventIds: { el: 'ev', bad: 3 },
        ocr: { rawText: 'x', confidence: '90', corrected: false },
        context: 'Phrase.',
      },
      HASH,
    );
    expect(a).not.toBeNull();
    expect(a).not.toHaveProperty('injected');
    expect(a).not.toHaveProperty('textRange');
    expect(a).not.toHaveProperty('linkEnds');
    expect(a).not.toHaveProperty('ocr');
    expect(a?.eventIds).toEqual({ el: 'ev' });
    expect(a?.context).toBe('Phrase.');
  });

  it('does not let a __proto__ key change the prototype of eventIds', () => {
    const a = sanitizeAnnotation(JSON.parse(JSON.stringify(ann(ELEMENT, 'event')).replace('"kind"', '"eventIds":{"__proto__":{"polluted":"yes"}},"kind"')), HASH);
    expect(Object.getPrototypeOf(a?.eventIds)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('rewire', () => {
  const graph = {
    elements: [
      { id: 'new-el', source: `Note ; ${anchorLabel('pv.pdf', 1, ELEMENT)} ; ${anchorLabel('pv.pdf', 1, PROPERTY)} ; ${anchorLabel('pv.pdf', 1, EVENT)}`, events: [{ id: 'new-ev', source: anchorLabel('pv.pdf', 1, EVENT) }] },
      { id: 'other-el', source: anchorLabel('pv.pdf', 1, EVENT), events: [{ id: 'other-ev', source: anchorLabel('pv.pdf', 1, EVENT) }] },
    ],
    links: [{ id: 'new-link', source: anchorLabel('pv.pdf', 1, LINK), fromId: 'new-el', toId: 'other-el' }],
    assets: [{ id: 'new-asset', hash: HASH }],
  };

  it('keeps a rejected suggestion without flagging it orphan', () => {
    const [s] = rewire([ann(LOST, 'suggestion', { status: 'rejected', origin: 'dictionary' })], graph);
    expect(s.orphan).toBeUndefined();
    expect(s).toMatchObject({ kind: 'suggestion', status: 'rejected', documentId: 'new-asset' });
  });

  it('points elements, properties and documents at their new ids', () => {
    const [el, prop] = rewire([ann(ELEMENT, 'element'), ann(PROPERTY, 'property', { propertyKey: 'Téléphone' })], graph);
    expect(el).toMatchObject({ targetId: 'new-el', documentId: 'new-asset' });
    expect(prop).toMatchObject({ targetId: 'new-el', propertyKey: 'Téléphone' });
    expect(el.orphan).toBeUndefined();
  });

  it('finds every copy of an event and its new event ids', () => {
    const [ev] = rewire([ann(EVENT, 'event', { eventIds: { a: 'x', b: 'y' } })], graph);
    expect(ev.eventIds).toEqual({ 'new-el': 'new-ev', 'other-el': 'other-ev' });
    expect(ev.targetId).toBe('new-el');
  });

  it('rewires a link and its ends', () => {
    const [link] = rewire([ann(LINK, 'link', { linkEnds: ['a', 'b'] })], graph);
    expect(link).toMatchObject({ targetId: 'new-link', linkEnds: ['new-el', 'other-el'] });
  });

  it('keeps an annotation whose object was not imported, flagged orphan', () => {
    const [lost] = rewire([ann(LOST, 'element')], graph);
    expect(lost.orphan).toBe(true);
    expect(lost.text).toBe(LOST);
  });

  it('keeps no id of the exporting dossier on an orphan', () => {
    const [el, link] = rewire([ann(LOST, 'element'), ann(LOST, 'link', { linkEnds: ['old-a', 'old-b'] })], graph);
    expect(el).not.toHaveProperty('targetId');
    expect(link).not.toHaveProperty('targetId');
    expect(link).not.toHaveProperty('linkEnds');
  });
});

describe('mergeAnnotations', () => {
  it('does not duplicate an annotation already present', () => {
    const a = ann(ELEMENT, 'element');
    expect(mergeAnnotations([a], [a, ann(PROPERTY, 'property')]).map((x) => x.id)).toEqual([ELEMENT, PROPERTY]);
  });
});

describe('document reference', () => {
  it('travels with the document, cleaned', () => {
    const parsed = parseExport({ format: EXPORT_FORMAT, version: 1, documents: [{ hash: HASH, annotations: [], reference: ' PV n° 347 ; pièce 2 [mn:x' }] });
    expect(parsed?.documents[0].reference).toBe('PV n° 347 , pièce 2 (mn:x');
    const none = parseExport({ format: EXPORT_FORMAT, version: 1, documents: [{ hash: HASH, annotations: [], reference: 3 }] });
    expect(none?.documents[0]).not.toHaveProperty('reference');
  });
});

describe('rewire: property of an event', () => {
  const PROP = '66666666-0000-4000-8000-000000000000';
  it('points at the new id of the event, found by its token', () => {
    const graph = {
      elements: [{ id: 'new-el', source: anchorLabel('pv.pdf', 1, PROP), events: [{ id: 'new-ev', source: anchorLabel('pv.pdf', 1, PROP) }] }],
      links: [],
      assets: [{ id: 'new-asset', hash: HASH }],
    };
    const [p] = rewire([ann(PROP, 'property', { propertyKey: 'Lieu', eventIds: { 'old-el': 'old-ev' } })], graph);
    expect(p).toMatchObject({ targetId: 'new-el', eventIds: { 'new-el': 'new-ev' } });
  });
});
