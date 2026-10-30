import { describe, expect, it } from 'vitest';
import { normalizeFormModel, type FormModel } from './formModel.ts';
import type { FormBlock, FormReading } from './formReader.ts';
import type { Annotation } from './model.ts';
import { blockDraft, blockState, documentRows, formHighlights, isAnswered, valuePeriod } from './formSession.ts';
import { normalizeSettings } from './settings.ts';

const MODEL: FormModel = normalizeFormModel({
  name: 'Fiche',
  signature: ['Fiche'],
  document: { fields: [{ label: 'Date de la fiche', property: 'Date', type: 'date' }] },
  sections: [
    {
      id: 'faits',
      title: 'Faits',
      block: {
        startsWith: 'Qualification',
        element: { tag: 'Fait', label: '{Qualification} ({Code})' },
        fields: [
          { label: 'Qualification', property: 'Qualification' },
          { label: 'Code', property: 'Code' },
          { label: 'Période', event: '{Qualification}' },
        ],
      },
    },
    {
      id: 'personnes',
      title: 'Personnes',
      block: {
        startsWith: 'Nom',
        element: { tag: 'Personne', label: '{Nom}' },
        fields: [{ label: 'Date de naissance', property: 'Date de naissance', type: 'date' }],
        links: [{ to: 'faits', label: 'concernée par' }],
      },
    },
    { id: 'objets', title: 'Objets', block: { startsWith: '*', element: { tag: null, label: null }, free: true } },
  ],
}).model!;

const at = (start: number, end: number, page = 1) => ({ page, start, end });
const field = (sectionId: string, label: string) => {
  const s = MODEL.sections.find((x) => x.id === sectionId)!;
  return s.block!.fields.find((f) => f.labels.includes(label)) ?? null;
};
const value = (sectionId: string, label: string, text: string, anchor: ReturnType<typeof at>, unknown = false) => ({
  label,
  field: unknown ? null : field(sectionId, label),
  unknown,
  text,
  anchor,
  whole: true,
});

const FACT: FormBlock = {
  sectionId: 'faits',
  index: 0,
  anchor: at(0, 13),
  values: [
    value('faits', 'Qualification', 'Vol de matériel', at(14, 29)),
    value('faits', 'Code', '1234', at(35, 39)),
    value('faits', 'Période', 'Entre le 03/02/2026 22:00 et le 04/02/2026 06:30', at(48, 97)),
  ],
};
const PERSON: FormBlock = {
  sectionId: 'personnes',
  index: 0,
  anchor: at(110, 113),
  values: [
    value('personnes', 'Nom', 'Camille ARNOUX', at(114, 128)),
    value('personnes', 'Date de naissance', 'inconnue', at(147, 155)),
    value('personnes', 'Profession', 'Menuisière', at(167, 177), true),
  ],
};
const OBJECT: FormBlock = {
  sectionId: 'objets',
  index: 0,
  anchor: at(200, 260),
  values: [],
  free: { text: 'Véhicule utilitaire : Marque : EXEMPLAR - Couleur : Blanc', anchor: at(202, 260), whole: true, pairs: [{ key: 'Marque', value: 'EXEMPLAR' }, { key: 'Couleur', value: 'Blanc' }] },
};

const annotation = (changes: Partial<Annotation>): Annotation => ({
  id: 'a', documentId: 'd', documentHash: 'h', page: 1, quads: [], text: '', kind: 'element', status: 'validated', origin: 'profile', createdAt: '', ...changes,
});

describe('blockDraft', () => {
  it('names the element from the template and anchors it on the first value of the name', () => {
    const d = blockDraft(FACT, MODEL);
    expect(d.label).toBe('Vol de matériel (1234)');
    expect(d.tag).toBe('Fait');
    expect(d.nameAnchor).toEqual(at(14, 29));
    expect(d.rows.map((r) => [r.kind, r.key, r.type, r.checked])).toEqual([
      ['property', 'Qualification', 'text', true],
      ['property', 'Code', 'text', true],
      ['event', 'Vol de matériel', 'date', true],
    ]);
  });

  it('offers unknown labels unchecked and unreadable dates as text', () => {
    const d = blockDraft(PERSON, MODEL);
    expect(d.label).toBe('Camille ARNOUX');
    expect(d.links).toEqual([{ to: 'faits', label: 'concernée par' }]);
    expect(d.rows.map((r) => [r.key, r.type, r.checked, !!r.unknown, !!r.unreadable])).toEqual([
      ['Date de naissance', 'text', false, false, true],
      ['Profession', 'text', false, true, false],
    ]);
  });

  it('names a free block by what comes before its pairs, and offers the pairs', () => {
    const d = blockDraft(OBJECT, MODEL);
    expect(d.label).toBe('Véhicule utilitaire');
    expect(d.tag).toBeNull();
    expect(d.nameAnchor).toEqual(at(202, 260));
    expect(d.rows.map((r) => [r.key, r.text, r.checked])).toEqual([
      ['Marque', 'EXEMPLAR', true],
      ['Couleur', 'Blanc', true],
    ]);
  });
});

describe('documentRows', () => {
  it('reads document fields as properties', () => {
    const reading: FormReading = { document: [{ label: 'Date de la fiche', field: MODEL.documentFields[0], unknown: false, text: '06/02/2026', anchor: at(5, 15), whole: true }], blocks: [] };
    expect(documentRows(reading).map((r) => [r.key, r.type, r.checked])).toEqual([['Date', 'date', true]]);
  });
});

describe('valuePeriod', () => {
  it('reads a period or a single date', () => {
    const p = valuePeriod('Entre le 03/02/2026 22:00 et le 04/02/2026 06:30')!;
    expect([p.date.getDate(), p.date.getHours(), p.dateEnd?.getDate(), p.dateEnd?.getHours()]).toEqual([3, 22, 4, 6]);
    expect(valuePeriod('Le 05/02/2026')?.dateEnd).toBeUndefined();
    expect(valuePeriod('inconnue')).toBeNull();
  });
});

describe('block state and highlights', () => {
  const drafts = [blockDraft(FACT, MODEL), blockDraft(PERSON, MODEL)];

  it('is created once an element highlight covers its name, dismissed when its name was', () => {
    expect(blockState(drafts[0], [])).toEqual({ status: 'open' });
    expect(blockState(drafts[0], [annotation({ textRange: [14, 29], targetId: 'el1' })])).toEqual({ status: 'done', elementId: 'el1' });
    expect(blockState(drafts[0], [annotation({ kind: 'suggestion', status: 'rejected', textRange: [14, 29] })])).toEqual({ status: 'rejected' });
    // Another page, or a rejected highlight, does not count.
    expect(blockState(drafts[0], [annotation({ page: 2, textRange: [14, 29], targetId: 'el1' })])).toEqual({ status: 'open' });
  });

  it('highlights the values of open blocks not answered yet', () => {
    const keys = (anns: Annotation[]) => formHighlights(drafts, [], anns).map((h) => `${h.start}-${h.blockKey}`);
    expect(keys([])).toEqual(['14-faits:0', '35-faits:0', '48-faits:0', '114-personnes:0', '147-personnes:0', '167-personnes:0']);
    // The fact is created: its values are no longer offered; a property already there is skipped.
    expect(keys([annotation({ textRange: [14, 29], targetId: 'el1' }), annotation({ kind: 'property', textRange: [147, 155] })])).toEqual([
      '114-personnes:0',
      '167-personnes:0',
    ]);
  });

  it('tells answered passages like the other suggestions', () => {
    expect(isAnswered(at(10, 20), [annotation({ kind: 'suggestion', status: 'rejected', textRange: [10, 20] })])).toBe(true);
    expect(isAnswered(at(10, 20), [annotation({ kind: 'suggestion', status: 'rejected', textRange: [10, 21] })])).toBe(false);
    expect(isAnswered(at(10, 20), [annotation({ status: 'rejected', textRange: [12, 14] })])).toBe(false);
  });
});

describe('settings', () => {
  it('keeps imported models through a save, normalized once', () => {
    const once = normalizeSettings({ formModels: [MODEL, { name: 'sans signature' }] });
    expect(once.formModels).toHaveLength(1);
    expect(normalizeSettings(JSON.parse(JSON.stringify(once))).formModels).toEqual(once.formModels);
  });
});
