import { describe, expect, it } from 'vitest';
import { normalizeFormModel, type FormModel } from './formModel.ts';
import { blockValue, keyValuePairs, matchesSignature, readForm, type FormPageInput, type FormTextItem } from './formReader.ts';
import { pdfPageText } from './pageText.ts';

// Fictional form: titles in font T, labels in font L, values in font V.
const SIZE = 10;
const HEIGHT = 842;

interface Row {
  str: string;
  font?: 'T' | 'L' | 'V';
  x?: number;
  /** Blank rows left before this one. */
  skip?: number;
}

/** Items of one page, one row per line from the top; `order` gives the file order of the rows. */
function page(rows: Row[], order?: number[]): FormPageInput {
  let skipped = 0;
  const items: FormTextItem[] = rows.map((r, i) => ({
    str: r.str,
    transform: [SIZE, 0, 0, SIZE, r.x ?? 60, 780 - (i + (skipped += r.skip ?? 0)) * 14],
    width: r.str.length * SIZE * 0.5,
    fontName: r.font ?? 'V',
    hasEOL: true,
  }));
  return { items: order ? order.map((i) => items[i]) : items, height: HEIGHT };
}

const T = (str: string): Row => ({ str, font: 'T' });
const L = (str: string): Row => ({ str, font: 'L' });
const V = (str: string): Row => ({ str, font: 'V' });

const MODEL: FormModel = normalizeFormModel({
  id: 'fiche',
  name: 'Fiche de signalement',
  signature: ['Fiche de signalement', 'Faits signalés'],
  empty: ['Non renseigné', 'Sans objet'],
  document: { fields: [{ label: 'Référence', property: 'Référence' }, { label: 'Date de la fiche', property: 'Date', type: 'date' }] },
  sections: [
    {
      id: 'faits',
      title: 'Faits signalés',
      block: {
        startsWith: 'Qualification',
        element: { tag: 'Fait', label: '{Qualification}' },
        fields: [
          { label: 'Qualification', property: 'Qualification' },
          { label: 'Période', event: '{Qualification}' },
          { label: ['Adresse', 'Lieu'], property: 'Adresse' },
          { label: 'Commune', property: 'Commune' },
        ],
      },
    },
    {
      id: 'personnes',
      title: ['Personnes concernées', 'Personne(s) concernée(s)'],
      block: {
        startsWith: 'Nom',
        element: { tag: 'Personne', label: '{Nom}' },
        fields: [
          { label: 'Date de naissance', property: 'Date de naissance', type: 'date' },
          { label: 'Téléphone', property: 'Téléphone' },
        ],
        links: [{ to: 'faits', label: 'concernée par' }],
      },
    },
    { id: 'objets', title: 'Objets', block: { startsWith: '*', element: { tag: null, label: null }, free: true } },
    { id: 'recit', title: 'Récit', text: true },
  ],
}).model!;

const FIRST_PAGE: Row[] = [
  T('Fiche de signalement'),
  T('Références'),
  L('Référence'),
  V('FS-2026-0417'),
  L('Date de la fiche'),
  V('06/02/2026'),
  T('Faits signalés'),
  L('Qualification'),
  V('Vol de matériel'),
  L('Période'),
  V('Entre le 03/02/2026 22:00 et le 04/02/2026 06:30'),
  L('Adresse'),
  V('12 rue des Tilleuls'),
  L('Commune'),
  V('Villefictive'),
  L('Qualification'),
  V('Dégradation'),
  L('Lieu'),
  V('XXXX'),
  T('Personnes concernées'),
  L('Nom'),
  V('Camille ARNOUX'),
  L('Date de naissance'),
  V('12/04/1987'),
  L('Téléphone'),
  V('Non renseigné'),
  L('Nom'),
  V('Bastien LORIOT'),
];

const values = (block: { values: { label: string; text: string }[] }) => block.values.map((v) => [v.label, v.text]);

describe('readForm', () => {
  it('reads document fields, sections and repeated blocks', () => {
    const r = readForm([page(FIRST_PAGE)], MODEL);
    expect(r.document.map((v) => [v.label, v.text])).toEqual([
      ['Référence', 'FS-2026-0417'],
      ['Date de la fiche', '06/02/2026'],
    ]);
    expect(r.blocks.map((b) => [b.sectionId, b.index])).toEqual([
      ['faits', 0],
      ['faits', 1],
      ['personnes', 0],
      ['personnes', 1],
    ]);
    expect(values(r.blocks[0])).toEqual([
      ['Qualification', 'Vol de matériel'],
      ['Période', 'Entre le 03/02/2026 22:00 et le 04/02/2026 06:30'],
      ['Adresse', '12 rue des Tilleuls'],
      ['Commune', 'Villefictive'],
    ]);
    // Masked and empty values give nothing.
    expect(values(r.blocks[1])).toEqual([['Qualification', 'Dégradation']]);
    expect(values(r.blocks[2])).toEqual([
      ['Nom', 'Camille ARNOUX'],
      ['Date de naissance', '12/04/1987'],
    ]);
    expect(r.blocks[2].values[0].field).toBeNull();
    expect(r.blocks[2].values[1].field?.property).toBe('Date de naissance');
    expect(blockValue(r.blocks[3], 'Nom')).toBe('Bastien LORIOT');
  });

  it('follows the layout, not the order of the text in the file', () => {
    // Titles first, then the rest backwards.
    const titles = FIRST_PAGE.map((r, i) => (r.font === 'T' ? i : -1)).filter((i) => i >= 0);
    const rest = FIRST_PAGE.map((_, i) => i).filter((i) => !titles.includes(i)).reverse();
    const shuffled = page(FIRST_PAGE, [...titles, ...rest]);
    const r = readForm([shuffled], MODEL);
    expect(r.blocks.map((b) => blockValue(b, 'Nom') ?? blockValue(b, 'Qualification'))).toEqual([
      'Vol de matériel',
      'Dégradation',
      'Camille ARNOUX',
      'Bastien LORIOT',
    ]);
    // Offsets point to the value in the page text shared with the reader.
    const text = pdfPageText(shuffled.items).text;
    for (const v of [...r.document, ...r.blocks.flatMap((b) => b.values)]) {
      expect(text.slice(v.anchor.start, v.anchor.end)).toBe(v.text);
      expect(v.whole).toBe(true);
    }
  });

  it('carries a block over a page break', () => {
    const p1 = page([T('Fiche de signalement'), T('Personnes concernées'), L('Nom'), V('Camille ARNOUX'), L('Date de naissance')]);
    const p2 = page([V('12/04/1987'), L('Téléphone'), V('06 12 34 56 78'), L('Nom'), V('Bastien LORIOT')]);
    const r = readForm([p1, p2], MODEL);
    expect(r.blocks).toHaveLength(2);
    expect(values(r.blocks[0])).toEqual([
      ['Nom', 'Camille ARNOUX'],
      ['Date de naissance', '12/04/1987'],
      ['Téléphone', '06 12 34 56 78'],
    ]);
    expect(r.blocks[0].values[1].anchor.page).toBe(2);
  });

  it('drops page numbers and lines repeated at the top of each page', () => {
    const header = { str: 'Service de démonstration', font: 'V' as const };
    const withBands = (rows: Row[], n: number): FormPageInput => {
      const p = page(rows);
      p.items.push({ str: header.str, transform: [SIZE, 0, 0, SIZE, 60, 820], width: 100, fontName: 'V', hasEOL: true });
      p.items.push({ str: `Page ${n} / 2`, transform: [SIZE, 0, 0, SIZE, 280, 20], width: 50, fontName: 'V', hasEOL: true });
      return p;
    };
    const r = readForm(
      [withBands([T('Personnes concernées'), L('Nom'), V('Camille ARNOUX'), L('Téléphone')], 1), withBands([V('06 12 34 56 78')], 2)],
      MODEL,
    );
    expect(values(r.blocks[0])).toEqual([
      ['Nom', 'Camille ARNOUX'],
      ['Téléphone', '06 12 34 56 78'],
    ]);
  });

  it('joins a value written on several lines', () => {
    const r = readForm([page([T('Faits signalés'), L('Qualification'), V('Vol de matériel'), L('Adresse'), V('12 rue des Tilleuls'), V('Bâtiment B')])], MODEL);
    expect(blockValue(r.blocks[0], 'Adresse')).toBe('12 rue des Tilleuls Bâtiment B');
  });

  it('matches labels whatever the case, accents and colon', () => {
    const r = readForm([page([T('PERSONNE(S) CONCERNEE(S)'), L('NOM :'), V('Camille ARNOUX'), L('date de naissance'), V('12/04/1987')])], MODEL);
    expect(values(r.blocks[0])).toEqual([
      ['NOM :', 'Camille ARNOUX'],
      ['date de naissance', '12/04/1987'],
    ]);
  });

  it('reads "Label : value" on one line', () => {
    const p = page([T('Personnes concernées'), V('Nom : Camille ARNOUX'), V('Téléphone : 06 12 34 56 78')]);
    const r = readForm([p], MODEL);
    expect(values(r.blocks[0])).toEqual([
      ['Nom', 'Camille ARNOUX'],
      ['Téléphone', '06 12 34 56 78'],
    ]);
    const text = pdfPageText(p.items).text;
    const phone = r.blocks[0].values[1].anchor;
    expect(text.slice(phone.start, phone.end)).toBe('06 12 34 56 78');
  });

  it('tells unknown labels and unknown sections by their font', () => {
    const r = readForm(
      [
        page([
          T('Personnes concernées'),
          L('Nom'),
          V('Camille ARNOUX'),
          L('Profession'),
          V('Menuisière'),
          L('Téléphone'),
          V('06 12 34 56 78'),
          T('Suites données'),
          L('Mesure'),
          V('Classement'),
          V('Texte qui ne doit pas rejoindre la personne'),
        ]),
      ],
      MODEL,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].values.map((v) => [v.label, v.text, v.unknown])).toEqual([
      ['Nom', 'Camille ARNOUX', false],
      ['Profession', 'Menuisière', true],
      ['Téléphone', '06 12 34 56 78', false],
    ]);
  });

  it('takes the line after a label as its value, even in the labels\' font', () => {
    const r = readForm(
      [
        page([
          T('Faits signalés'),
          L('Qualification'),
          L('Vol de matériel'),
          L('Code'),
          L('1234'),
          L('Commune'),
          V('Villefictive'),
          L('Qualification'),
          V('Dégradation'),
          L('Commune'),
          V('Autreville'),
        ]),
      ],
      MODEL,
    );
    expect(r.blocks[0].values.map((v) => [v.label, v.text, v.unknown])).toEqual([
      ['Qualification', 'Vol de matériel', false],
      ['Code', '1234', true],
      ['Commune', 'Villefictive', false],
    ]);
  });

  it('reads free blocks, one per bullet, with their key-value pairs', () => {
    const p = page([
          T('Objets'),
          L('Véhicule'),
          V('* Véhicule utilitaire (retrouvé) : Marque : EXEMPLAR - Modèle : CARGO 2 -'),
          V('Couleur : Blanc - Immatriculation : AB-123-CD'),
          V('* Sac de sport noir'),
          T('Récit'),
          V('Texte libre sans proposition.'),
        ]);
    const r = readForm([p], MODEL);
    expect(r.blocks.map((b) => [b.sectionId, b.free?.text])).toEqual([
      ['objets', 'Véhicule utilitaire (retrouvé) : Marque : EXEMPLAR - Modèle : CARGO 2 - Couleur : Blanc - Immatriculation : AB-123-CD'],
      ['objets', 'Sac de sport noir'],
    ]);
    expect(r.blocks[0].free?.pairs.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: 'Marque', value: 'EXEMPLAR' },
      { key: 'Modèle', value: 'CARGO 2' },
      { key: 'Couleur', value: 'Blanc' },
      { key: 'Immatriculation', value: 'AB-123-CD' },
    ]);
    // Each value is anchored on itself, the second line included.
    const text = pdfPageText(p.items).text;
    expect(r.blocks[0].free?.pairs.map((x) => x.anchor && text.slice(x.anchor.start, x.anchor.end))).toEqual(['EXEMPLAR', 'CARGO 2', 'Blanc', 'AB-123-CD']);
  });

  it('reads items grouped under a label without bullets, and document fields among them', () => {
    const model = normalizeFormModel({
      id: 'fiche',
      name: 'Fiche',
      signature: ['Objets'],
      document: {
        fields: [
          { label: 'Montant estimé', property: 'Montant' },
          { label: 'Date du dépôt', property: 'Date du dépôt', type: 'date' },
        ],
      },
      sections: [
        { id: 'objets', title: 'Objets', block: { startsWith: '*', element: { tag: null, label: null }, free: true } },
        { id: 'divers', title: 'Divers', text: true },
      ],
    }).model!;
    const p = page([
      T('Objets'),
      L('Objets perdus'),
      V('Objet divers (Perdu) : Nature : SAC A DOS - Description : toile - bleu'),
      L('Véhicules'),
      V('Vélo de route'),
      L('Montant estimé'),
      V('1 200 euros'),
      T('Divers'),
      L('Autres informations'),
      V('- Date du dépôt : 21/09/2026'),
      V('- Personne informée : néant'),
    ]);
    const r = readForm([p], model);
    expect(r.blocks.map((b) => b.free?.text)).toEqual(['Objet divers (Perdu) : Nature : SAC A DOS - Description : toile - bleu', 'Vélo de route']);
    expect(r.blocks[0].free?.pairs.map(({ key, value }) => [key, value])).toEqual([
      ['Nature', 'SAC A DOS'],
      ['Description', 'toile - bleu'],
    ]);
    expect(r.document.map((v) => [v.label, v.text])).toEqual([
      ['Montant estimé', '1 200 euros'],
      ['Date du dépôt', '21/09/2026'],
    ]);
  });

  it('splits items under one label at a blank space, not at a line break', () => {
    const p = page([
      L('Référence'),
      V('FS-2026-0417'),
      T('Objets'),
      L('Objets perdus'),
      { str: 'Sac (Perdu) : Couleur : Bleu - Matière :', skip: 1 },
      V('Toile'),
      { str: 'Montre (Perdue) : Marque : EXEMPLAR', skip: 1 },
    ]);
    expect(readForm([p], MODEL).blocks.map((b) => b.free?.text)).toEqual([
      'Sac (Perdu) : Couleur : Bleu - Matière : Toile',
      'Montre (Perdue) : Marque : EXEMPLAR',
    ]);
  });

  it('reads a text section kept whole as a document value', () => {
    const model = normalizeFormModel({
      id: 'fiche',
      name: 'Fiche',
      signature: ['Récit'],
      documentLink: 'mentionné dans',
      document: { fields: [{ label: 'Référence', property: 'Référence' }] },
      sections: [
        { id: 'recit', title: 'Récit', text: true, property: 'Récit' },
        { id: 'suite', title: 'Suite', text: true },
      ],
    }).model!;
    expect(model.documentLink).toBe('mentionné dans');
    const p = page([L('Référence'), V('FS-1'), T('Récit'), V('Première ligne du récit,'), V('suite du récit.'), T('Suite'), V('Rien.')]);
    const r = readForm([p], model);
    expect(r.document.map((v) => [v.label, v.field?.property, v.text, v.whole])).toEqual([
      ['Référence', 'Référence', 'FS-1', true],
      ['Récit', 'Récit', 'Première ligne du récit, suite du récit.', true],
    ]);
  });

  it('anchors a value split apart in the file on its first piece', () => {
    // The second line of the address is written at the end of the file.
    const rows = [T('Faits signalés'), L('Qualification'), V('Vol de matériel'), L('Adresse'), V('12 rue des Tilleuls'), V('Bâtiment B'), L('Commune'), V('Villefictive')];
    const p = page(rows, [0, 1, 2, 3, 4, 6, 7, 5]);
    const v = readForm([p], MODEL).blocks[0].values.find((x) => x.label === 'Adresse')!;
    expect(v.text).toBe('12 rue des Tilleuls Bâtiment B');
    expect(v.whole).toBe(false);
    expect(pdfPageText(p.items).text.slice(v.anchor.start, v.anchor.end)).toBe('12 rue des Tilleuls');
  });

  it('works without fonts, with the labels of the model only', () => {
    const p = page(FIRST_PAGE);
    for (const it of p.items) delete it.fontName;
    const r = readForm([p], MODEL);
    expect(r.blocks).toHaveLength(4);
    expect(blockValue(r.blocks[2], 'Date de naissance')).toBe('12/04/1987');
  });
});

describe('matchesSignature', () => {
  it('needs every signature label on the first page', () => {
    expect(matchesSignature(page(FIRST_PAGE), MODEL)).toBe(true);
    expect(matchesSignature(page([T('Fiche de signalement'), T('Personnes concernées')]), MODEL)).toBe(false);
  });
});

describe('keyValuePairs', () => {
  it('keeps hours in values and skips parts without a key', () => {
    expect(keyValuePairs('Objet retrouvé - Heure : 12:30 - Lieu :parking')).toEqual([
      { key: 'Heure', value: '12:30' },
      { key: 'Lieu', value: 'parking' },
    ]);
  });
});
