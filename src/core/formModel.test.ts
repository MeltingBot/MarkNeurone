import { describe, expect, it } from 'vitest';
import { fillTemplate, foldLabel, normalizeFormModel } from './formModel.ts';

describe('normalizeFormModel', () => {
  it('needs a name and a signature', () => {
    expect(normalizeFormModel({ signature: ['A'] })).toEqual({ model: null, dropped: [{ reason: 'no_name' }] });
    expect(normalizeFormModel({ name: 'Fiche' })).toEqual({ model: null, dropped: [{ reason: 'no_signature' }] });
    expect(normalizeFormModel('pas un modèle').model).toBeNull();
  });

  it('accepts a label or a list of labels, without duplicates', () => {
    const { model } = normalizeFormModel({
      name: 'Fiche',
      signature: 'Fiche',
      sections: [{ title: 'Personnes', block: { startsWith: 'Nom', fields: [{ label: ['Adresse', ' adresse ', 'Domicile'], property: 'Adresse' }] } }],
    });
    expect(model?.signature).toEqual(['Fiche']);
    expect(model?.sections[0].block?.fields[0].labels).toEqual(['Adresse', 'Domicile']);
    expect(model?.sections[0].id).toBe('Personnes');
    expect(model?.id).toBe('Fiche');
  });

  it('lists what it leaves out', () => {
    const { model, dropped } = normalizeFormModel({
      name: 'Fiche',
      signature: ['Fiche'],
      document: { fields: [{ label: 'Référence' }] },
      sections: [
        { id: 'a', title: 'Faits', block: { startsWith: 'Qualification', fields: [{ property: 'X' }] } },
        { id: 'a', title: 'Doublon' },
        { title: '' },
        { id: 'b', title: 'Personnes', block: { startsWith: 'Nom', links: [{ to: 'a', label: 'liée à' }, { to: 'z', label: 'liée à' }] } },
        { id: 'c', title: 'Sans ouverture', block: {} },
        { id: 'd', title: 'Récit', text: true, block: { startsWith: 'X' } },
      ],
    });
    expect(dropped).toEqual([
      { reason: 'no_target', section: undefined, subject: 'Référence' },
      { reason: 'no_label', section: 'Faits' },
      { reason: 'duplicate_id', section: 'Doublon', subject: 'a' },
      { reason: 'no_title' },
      { reason: 'no_start', section: 'Sans ouverture' },
      { reason: 'unknown_link', section: 'Personnes', subject: 'z' },
    ]);
    expect(model?.sections.map((s) => [s.id, !!s.block])).toEqual([
      ['a', true],
      ['b', true],
      ['c', false],
      ['d', false],
    ]);
    expect(model?.sections[1].block?.links).toEqual([{ to: 'a', label: 'liée à' }]);
  });

  it('keeps known types only, text being the default', () => {
    const { model } = normalizeFormModel({
      name: 'Fiche',
      signature: ['Fiche'],
      document: { fields: [{ label: 'Date', property: 'Date', type: 'date' }, { label: 'Pages', property: 'Pages', type: 'entier' }] },
    });
    expect(model?.documentFields).toEqual([
      { labels: ['Date'], property: 'Date', type: 'date' },
      { labels: ['Pages'], property: 'Pages' },
    ]);
  });
});

describe('foldLabel', () => {
  it('ignores case, accents, spaces and a trailing colon', () => {
    expect(foldLabel('  Date de  NAISSANCE : ')).toBe('date de naissance');
    expect(foldLabel('Né(e) le')).toBe('ne(e) le');
  });
});

describe('fillTemplate', () => {
  it('fills values and drops empty parentheses', () => {
    const values: Record<string, string> = { Qualification: 'Vol de matériel', Code: '1234' };
    expect(fillTemplate('{Qualification} ({Code})', (l) => values[l])).toBe('Vol de matériel (1234)');
    expect(fillTemplate('{Qualification} ({Absent})', (l) => values[l])).toBe('Vol de matériel');
  });
});
