import { describe, expect, it } from 'vitest';
import { normalizeFormModel } from './formModel.ts';
import { readForm, type FormPageInput, type FormTextItem } from './formReader.ts';
import { draftFromPages, draftToRaw } from './formDraft.ts';
import { positionalLayout } from './formPositional.ts';
import { blockDraft } from './formSession.ts';
import { pdfPageText } from './pageText.ts';

// Fictional form printed with boxes: bands in capitals (B, size 10), labels
// under the boxes (P, size 6), empty boxes as a symbol (S). The filled text
// (F, size 9) and the crosses come after the printed form, as when software
// writes over a blank form.
type Item = [str: string, x: number, y: number, font: 'B' | 'P' | 'S' | 'F', size?: number];
const BOX = '';
const PRINTED: Item[] = [
  ['DEMANDE D’INSCRIPTION FICTIVE', 100, 800, 'B', 13],
  [BOX, 150, 770, 'S', 8], ['Première demande', 162, 770, 'P', 8],
  [BOX, 250, 770, 'S', 8], ['Renouvellement', 262, 770, 'P', 8],
  ['MATÉRIEL', 34, 740, 'B'],
  ['Numéro de série', 40, 700, 'P'],
  ['Date d’achat', 200, 700, 'P'],
  ['Marque', 90, 660, 'P'],
  ['DEMANDEUR', 34, 620, 'B'],
  ['NOM et PRÉNOM', 60, 580, 'P'],
  ['Jour', 62, 550, 'P'], ['Mois', 88, 550, 'P'], ['Année', 123, 550, 'P'], ['Commune', 172, 550, 'P'],
  ['Code postal', 60, 520, 'P'], ['Commune', 150, 520, 'P'],
  ['Sexe :', 40, 490, 'P', 8], ['M', 70, 490, 'P', 8], [BOX, 80, 490, 'S', 8], ['F', 96, 490, 'P', 8], [BOX, 106, 490, 'S', 8],
  ['MANDATAIRE', 34, 450, 'B'],
  ['NOM et PRÉNOM', 60, 410, 'P'],
  ['Commune', 150, 380, 'P'],
];
const FILLED: Item[] = [
  ['X', 150, 770, 'F'],
  ['SN-48213-B', 40, 713, 'F'],
  ...'21102026'.split('').map((d, i): Item => [d, 200 + i * 12 + (i >= 2 ? 4 : 0) + (i >= 4 ? 4 : 0), 713, 'F']),
  ['EXEMPLAR', 40, 673, 'F'],
  ['ARNOUX Camille', 60, 593, 'F'],
  ...'14031984'.split('').map((d, i): Item => [d, 60 + i * 11 + (i >= 2 ? 4 : 0) + (i >= 4 ? 4 : 0), 559, 'F']),
  ['VILLEFICTIVE', 172, 559, 'F'],
  ...'99000'.split('').map((d, i): Item => [d, 62 + i * 11, 533, 'F']),
  ['AUTREVILLE', 150, 533, 'F'],
  ['X', 106, 490, 'F'],
];

function page(items: Item[]): FormPageInput {
  return {
    height: 842,
    items: items.map(([str, x, y, font, size]): FormTextItem => {
      const s = size ?? (font === 'B' ? 10 : font === 'F' ? 9 : 6);
      return { str, transform: [s, 0, 0, s, x, y], width: str.length * s * 0.5, fontName: font, hasEOL: true };
    }),
  };
}

const PAGE = page([...PRINTED, ...FILLED]);

describe('positional forms', () => {
  it('tells the filled text from the printed form by the fonts that come after it', () => {
    const layout = positionalLayout([PAGE]);
    expect([...new Set(layout.filled.map((w) => w.font))]).toEqual(['F']);
    // Printed only: nothing comes after the form in fonts of its own.
    expect(positionalLayout([page(PRINTED)]).filled).toEqual([]);
    expect(layout.boxes).toHaveLength(4);
  });

  const draft = draftFromPages([PAGE], '');

  it('drafts sections from the bands, and fields from the labels under filled boxes', () => {
    expect(draft.layout).toBe('positional');
    expect(draft.name).toBe('Demande d’inscription fictive');
    expect(draft.sections.map((s) => [s.title, s.kind])).toEqual([
      ['DEMANDE D’INSCRIPTION FICTIVE', 'document'],
      ['MATÉRIEL', 'block'],
      ['DEMANDEUR', 'block'],
      ['MANDATAIRE', 'block'],
    ]);
    const demandeur = draft.sections[2];
    // Each printed box is also offered as a yes or no, unused.
    expect(demandeur.fields.filter((f) => f.type === 'skip').map((f) => f.label)).toEqual(['M', 'F']);
    expect(demandeur.fields.filter((f) => f.type !== 'skip').map((f) => [f.label, f.type])).toEqual([
      ['NOM et PRÉNOM', 'text'],
      ['Jour', 'read'],
      ['Mois', 'read'],
      ['Année', 'read'],
      ['Commune', 'text'],
      ['Code postal', 'text'],
      ['Commune #2', 'text'],
      ['Cases cochées', 'checks'],
      ['Date', 'date'],
    ]);
    // Empty in this copy, the band prints the same labels as another one.
    expect(draft.sections[3].fields.map((f) => f.label)).toEqual(['NOM et PRÉNOM', 'Commune']);
  });

  it('reads values above their labels, boxed digits, crosses and repeated labels', () => {
    const { model, dropped } = normalizeFormModel(draftToRaw(draft));
    expect(dropped).toEqual([]);
    const r = readForm([PAGE], model!);
    const shown = (sectionId: string) =>
      r.blocks.find((b) => b.sectionId === sectionId)!.values.filter((v) => v.field?.offer !== false).map((v) => [v.field?.property, v.text]);
    expect(r.document.map((v) => [v.field?.property, v.text])).toEqual([['Cases cochées', 'Première demande']]);
    expect(shown('materiel')).toEqual([
      ['Numéro de série', 'SN-48213-B'],
      ['Date d’achat', '21/10/2026'],
      ['Marque', 'EXEMPLAR'],
    ]);
    expect(shown('demandeur')).toEqual([
      ['NOM et PRÉNOM', 'ARNOUX Camille'],
      ['Commune', 'VILLEFICTIVE'],
      ['Code postal', '99000'],
      ['Commune 2', 'AUTREVILLE'],
      ['Cases cochées', 'F'],
      ['Date', '14/03/1984'],
    ]);
    // Nothing filled under the third band: no block.
    expect(r.blocks.map((b) => b.sectionId)).toEqual(['materiel', 'demandeur']);
    // Nor when its only values are the noes of empty boxes.
    const d = structuredClone(draft);
    d.sections[3].fields.push({ label: 'Commune', property: 'Inutile', type: 'boolean' });
    expect(readForm([PAGE], normalizeFormModel(draftToRaw(d)).model!).blocks.map((b) => b.sectionId)).toEqual(['materiel', 'demandeur']);
  });

  it('reads a printed box as yes or no, crossed or not', () => {
    const d = structuredClone(draft);
    for (const s of d.sections) for (const f of s.fields) if (f.type === 'skip') f.type = 'boolean';
    const r = readForm([PAGE], normalizeFormModel(draftToRaw(d)).model!);
    const yesNo = (values: typeof r.document) => values.filter((v) => v.field?.type === 'boolean').map((v) => [v.label, v.text]);
    expect(yesNo(r.document)).toEqual([['Première demande', 'Oui'], ['Renouvellement', 'Non']]);
    expect(yesNo(r.blocks.find((b) => b.sectionId === 'demandeur')!.values)).toEqual([['M', 'Non'], ['F', 'Oui']]);
    // A no from an empty box waits for the user; a yes is offered checked.
    const model = normalizeFormModel(draftToRaw(d)).model!;
    const rows = blockDraft(r.blocks.find((b) => b.sectionId === 'demandeur')!, model).rows.filter((x) => x.type === 'boolean');
    expect(rows.map((x) => [x.key, x.text, x.checked])).toEqual([['M', 'Non', false], ['F', 'Oui', true]]);
  });

  it('anchors each value on its words in the page text', () => {
    const { model } = normalizeFormModel(draftToRaw(draft));
    const r = readForm([PAGE], model!);
    const text = pdfPageText(PAGE.items).text;
    const at = (label: string) => {
      const v = r.blocks.flatMap((b) => b.values).find((x) => x.label === label)!;
      return text.slice(v.anchor.start, v.anchor.end).replace(/\s+/g, '');
    };
    expect(at('Numéro de série')).toBe('SN-48213-B');
    expect(at('Date d’achat')).toBe('21102026');
  });
});

describe('PDF form fields', () => {
  // Fictional form with fields: printed labels left of the fields, numbered
  // headings, a choice, a single box, an address split around "@", a table.
  type P = [str: string, x: number, y: number, size?: number];
  const printed: P[] = [
    ['DEMANDE D’AIDE FICTIVE', 100, 800, 14],
    ['1.', 36, 760, 10], ['Demandeur', 50, 760, 10],
    ['1.1.', 36, 740, 9], ['Identité', 56, 740, 9],
    ['Nom :', 40, 720], ['Prénom :', 300, 720],
    ['Courriel :', 40, 700], ['@', 200, 700],
    ['Voie :', 40, 680], ['Pays :', 300, 680],
    ['1', 36, 60, 7], ['Note de bas de page sans intérêt.', 46, 60, 7],
    ['2.', 36, 640, 10], ['Projet', 50, 640, 10],
    ['Nature :', 40, 620], ['Travaux', 120, 620], ['Étude', 200, 620],
    ['Urgent', 52, 600],
    ['Montant', 200, 580], ['Part', 300, 580],
    ['État', 40, 560], ['Région', 40, 545],
  ];
  const widgets: import('./formReader.ts').FormWidget[] = [
    { name: 'id_nom', kind: 'text', value: 'ARNOUX', rect: [80, 717, 280, 729] },
    { name: 'id_prenom', kind: 'text', value: 'Camille', rect: [345, 717, 540, 729] },
    { name: 'id_mail1', kind: 'text', value: 'c.arnoux', rect: [90, 697, 198, 709] },
    { name: 'id_mail2', kind: 'text', value: 'exemple.test', rect: [208, 697, 400, 709] },
    { name: 'id_voie', kind: 'text', value: 'rue des Tilleuls', rect: [70, 677, 290, 689] },
    { name: 'id_pays', kind: 'text', value: '', rect: [330, 677, 540, 689] },
    { name: 'nature', kind: 'check', value: '1', on: false, rect: [108, 618, 116, 626] },
    { name: 'nature', kind: 'check', value: '2', on: true, rect: [188, 618, 196, 626] },
    { name: 'Case 7', kind: 'check', value: 'Yes', on: true, rect: [40, 598, 48, 606] },
    { name: 'cell_1', kind: 'text', value: '1 200', rect: [200, 557, 260, 566] },
    { name: 'cell_2', kind: 'text', value: '40 %', rect: [300, 557, 360, 566] },
    { name: 'cell_3', kind: 'text', value: '1 800', rect: [200, 542, 260, 551] },
    { name: 'cell_4', kind: 'text', value: '60 %', rect: [300, 542, 360, 551] },
  ];
  const fieldsPage: FormPageInput = {
    height: 842,
    items: printed.map(([str, x, y, size]): FormTextItem => {
      const s = size ?? 9;
      return { str, transform: [s, 0, 0, s, x, y], width: str.length * s * 0.45, fontName: 'P', hasEOL: true };
    }),
    widgets,
  };
  const draft = draftFromPages([fieldsPage], '');

  it('drafts sections from first-level headings, fields named by the form', () => {
    expect(draft.layout).toBe('fields');
    expect(draft.sections.map((s) => [s.title, s.kind])).toEqual([
      ['Demandeur', 'block'],
      ['Projet', 'block'],
    ]);
    const used = (i: number) => draft.sections[i].fields.filter((f) => f.type !== 'skip').map((f) => [f.label, f.property, f.type]);
    expect(used(0)).toEqual([
      ['id_nom', 'Nom', 'text'],
      ['id_prenom', 'Prénom', 'text'],
      ['id_mail1', 'Courriel', 'read'],
      // Read only: the label above it does not matter.
      ['id_mail2', 'Prénom', 'read'],
      ['id_voie', 'Voie', 'text'],
      ['', 'Courriel', 'text'],
    ]);
    // An empty field is listed unused.
    expect(draft.sections[0].fields.find((f) => f.label === 'id_pays')).toMatchObject({ property: 'Pays', type: 'skip' });
    expect(used(1)).toEqual([
      ['nature', 'Nature', 'text'],
      ['cell_1', 'État · Montant', 'text'],
      ['cell_2', 'État · Part', 'text'],
      ['cell_3', 'Région · Montant', 'text'],
      ['cell_4', 'Région · Part', 'text'],
      ['Case 7', 'Cases cochées', 'checks'],
    ]);
  });

  it('reads values from the fields, options from the boxes checked', () => {
    const { model, dropped } = normalizeFormModel(draftToRaw(draft));
    expect(dropped).toEqual([]);
    const r = readForm([fieldsPage], model!);
    const shown = (id: string) => r.blocks.find((b) => b.sectionId === id)!.values.filter((v) => v.field?.offer !== false).map((v) => [v.field?.property, v.text]);
    expect(shown('demandeur')).toEqual([
      ['Nom', 'ARNOUX'],
      ['Prénom', 'Camille'],
      ['Voie', 'rue des Tilleuls'],
      ['Courriel', 'c.arnoux@exemple.test'],
    ]);
    expect(shown('projet')).toEqual([
      ['Nature', 'Étude'],
      ['État · Montant', '1 200'],
      ['État · Part', '40 %'],
      ['Région · Montant', '1 800'],
      ['Région · Part', '60 %'],
      ['Cases cochées', 'Urgent'],
    ]);
    // A box as its own yes or no, next to the checked options.
    const d = structuredClone(draft);
    for (const f of d.sections[1].fields) if (f.label === 'Case 7' && f.type === 'skip') f.type = 'boolean';
    const r2 = readForm([fieldsPage], normalizeFormModel(draftToRaw(d)).model!);
    expect(r2.blocks.find((b) => b.sectionId === 'projet')!.values.filter((v) => v.label === 'Case 7').map((v) => [v.field?.property, v.text])).toEqual([
      ['Urgent', 'Oui'],
      ['Cases cochées', 'Urgent'],
    ]);
    // The passage of a value is its printed label.
    const text = pdfPageText(fieldsPage.items).text;
    const nom = r.blocks[0].values[0];
    expect(text.slice(nom.anchor.start, nom.anchor.end)).toBe('Nom :');
  });
});
