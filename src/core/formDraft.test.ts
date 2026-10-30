import { describe, expect, it } from 'vitest';
import { normalizeFormModel } from './formModel.ts';
import { readForm, type FormPageInput, type FormTextItem } from './formReader.ts';
import { draftFromModel, draftFromPages, draftToRaw, withDetected } from './formDraft.ts';

// Fictional form: titles in font T (larger), labels in L, values in V.
type Row = [string, 'T' | 'L' | 'V'];
function page(rows: Row[]): FormPageInput {
  let y = 800;
  const items: FormTextItem[] = rows.map(([str, font]) => {
    const size = font === 'T' ? 13 : 10;
    y -= size + 6;
    return { str, transform: [size, 0, 0, size, 60, y], width: str.length * size * 0.5, fontName: font, hasEOL: true };
  });
  return { items, height: 842 };
}

const ROWS: Row[] = [
  ['Fiche de signalement', 'T'],
  ['Références', 'T'],
  ['Référence', 'L'], ['FS-2026-0417', 'V'],
  ['Date de la fiche', 'L'], ['06/02/2026', 'V'],
  ['Faits signalés', 'T'],
  ['Code', 'L'], ['1234', 'L'],
  ['Qualification', 'L'], ['Vol de matériel', 'V'],
  ['Période', 'L'], ['Entre le 03/02/2026 22:00 et le 04/02/2026 06:30', 'V'],
  ['Commune', 'L'], ['Non renseigné', 'V'],
  ['Code', 'L'], ['5678', 'L'],
  ['Qualification', 'L'], ['Dégradation de bien', 'V'],
  ['Période', 'L'], ['Le 05/02/2026 14:00', 'V'],
  ['Commune', 'L'], ['Autreville', 'V'],
  ['Personne(s) concernée(s)', 'T'],
  ['Nom', 'L'], ['Camille ARNOUX', 'V'],
  ['Téléphone', 'L'], ['Non renseigné', 'V'],
  ['Date de naissance', 'L'], ['Non renseigné', 'V'],
  ['Personnes mises en cause', 'T'],
  ['Nom', 'L'], ['Non renseigné', 'V'],
  ['Objets', 'T'],
  ['* Vélo : Marque : EXEMPLAR - Couleur : Bleu', 'V'],
  ['Récit', 'T'],
  ['Texte libre du récit.', 'V'],
];

describe('draftFromPages', () => {
  const draft = draftFromPages([page(ROWS)], '');

  it('tells sections apart and guesses what each is', () => {
    expect(draft.name).toBe('Fiche de signalement');
    expect(draft.signature).toEqual(['Fiche de signalement', 'Références']);
    expect(draft.sections.map((s) => [s.title, s.kind, s.startsWith])).toEqual([
      ['Références', 'document', 'Référence'],
      ['Faits signalés', 'block', 'Code'],
      ['Personne(s) concernée(s)', 'block', 'Nom'],
      // Empty here, but opened by the label of the blocks above.
      ['Personnes mises en cause', 'block', 'Nom'],
      ['Objets', 'list', ''],
      ['Récit', 'text', ''],
    ]);
    expect(draft.empty).toEqual(['Non renseigné']);
  });

  it('names blocks after a field with letters and their date, and finds periods and dates', () => {
    const faits = draft.sections[1];
    expect(faits.nameTemplate).toBe('{Qualification} {Période|date}');
    expect(faits.fields.map((f) => [f.label, f.type])).toEqual([
      ['Code', 'text'],
      ['Qualification', 'text'],
      ['Période', 'event'],
      ['Commune', 'text'],
    ]);
    expect(draft.sections[0].fields.find((f) => f.label === 'Date de la fiche')?.type).toBe('date');
    expect(draft.sections[2].tag).toBe('Personne concernée');
    // A date of birth is not part of a name, a period is.
    expect(draft.sections[2].nameTemplate).toBe('{Nom}');
  });

  it('gives a model that reads the document', () => {
    const { model, dropped } = normalizeFormModel(draftToRaw(draft));
    expect(dropped).toEqual([]);
    const r = readForm([page(ROWS)], model!);
    expect(r.blocks.map((b) => b.sectionId)).toEqual(['faits-signales', 'faits-signales', 'personne-s-concernee-s', 'objets']);
    expect(r.document.map((v) => v.text)).toEqual(['FS-2026-0417', '06/02/2026']);
  });

  it('comes back from a saved model unchanged, with the labels it lacks offered unused', () => {
    const raw = draftToRaw(draft);
    const model = normalizeFormModel(raw).model!;
    const back = draftFromModel(model);
    expect(normalizeFormModel(draftToRaw(back)).model).toEqual(model);
    // Back in the editor, the document's fields return to their section.
    const shown = withDetected(back, draft);
    expect(shown.header).toEqual([]);
    expect(shown.sections[0]).toMatchObject({ kind: 'document', fields: [{ label: 'Référence' }, { label: 'Date de la fiche' }] });
    expect(normalizeFormModel(draftToRaw(shown)).model).toEqual(model);
    back.sections[1].fields = back.sections[1].fields.filter((f) => f.label !== 'Commune');
    const merged = withDetected(back, draft);
    expect(merged.sections[1].fields.at(-1)).toMatchObject({ label: 'Commune', type: 'skip' });
  });
});
