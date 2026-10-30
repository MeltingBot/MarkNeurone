import { describe, expect, it } from 'vitest';
import { normalizeFormModel } from './formModel.ts';
import { readForm, type FormPageInput, type FormTextItem } from './formReader.ts';
import { draftFromPages, draftToRaw } from './formDraft.ts';
import { positionalLayout } from './formPositional.ts';
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
    expect(demandeur.fields.map((f) => [f.label, f.type])).toEqual([
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
