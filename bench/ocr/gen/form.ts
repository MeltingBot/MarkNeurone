// Generates a fictional generated form ("Fiche de signalement") with a text
// layer, to try form reading in ZN: labels in bold italic above their values,
// section titles in bold, repeated blocks, a block cut by a page break, and
// the text written in an order other than the reading order (titles first).
// Its model is gen/fiche-signalement.model.json.
//
// Usage: tsx gen/form.ts [--out out/forms]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PDFDocument, type SKRSContext2D } from '@napi-rs/canvas';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 50;
const BOTTOM = 70;
const FONT = '"Liberation Sans"';

type Entry = [label: string, value: string];
interface Section {
  title: string;
  blocks: Entry[][];
  /** Bulleted free lines instead of label and value. */
  free?: string[][];
  /** Plain text paragraph. */
  text?: string;
}

const FORM: Section[] = [
  {
    title: 'Références',
    blocks: [[
      ['Référence', 'FS-2026-0417'],
      ['Service', 'Service de démonstration'],
      ['Date de la fiche', '06/02/2026'],
      ['Rédacteur', 'Agent Claude DEMO'],
    ]],
  },
  {
    title: 'Faits signalés',
    blocks: [
      [['Qualification', 'Vol de matériel'], ['Code', '1234'], ['Période', 'Entre le 03/02/2026 22:00 et le 04/02/2026 06:30'], ['Adresse', '12 rue des Tilleuls'], ['Commune', 'Villefictive'], ['Pays', 'France']],
      [['Qualification', 'Dégradation de bien'], ['Code', '5678'], ['Période', 'Le 05/02/2026 14:00'], ['Adresse', 'XXXX'], ['Commune', 'Autreville'], ['Pays', 'France']],
    ],
  },
  {
    title: 'Personnes concernées',
    blocks: [
      [['Nom', 'Camille ARNOUX'], ['Sexe', 'Féminin'], ['Date de naissance', '12/04/1987'], ['Adresse', '4 impasse des Lilas 99000 Villefictive'], ['Téléphone', '06 12 34 56 78'], ['Courriel', 'camille.arnoux@exemple.test'], ['Profession', 'Menuisière'], ['Lieu de naissance', 'Non renseigné']],
      [['Nom', 'Bastien LORIOT'], ['Sexe', 'Masculin'], ['Date de naissance', 'Non renseigné'], ['Adresse', 'Non renseigné'], ['Téléphone', '07 98 76 54 32'], ['Courriel', 'Non renseigné'], ['Profession', 'Non renseigné'], ['Lieu de naissance', 'Non renseigné']],
      [['Nom', 'Société EXEMPLAR SARL'], ['Sexe', 'Sans objet'], ['Date de naissance', 'Sans objet'], ['Adresse', '8 zone artisanale 99000 Villefictive'], ['Téléphone', 'Non renseigné'], ['Courriel', 'contact@exemplar.test'], ['Profession', 'Sans objet'], ['Lieu de naissance', 'Sans objet']],
    ],
  },
  { title: 'Personnes mises en cause', blocks: [[['Nom', 'Non renseigné']]] },
  {
    title: 'Récit',
    blocks: [],
    text: 'Dans la nuit du 3 au 4 février, du matériel de chantier est dérobé dans un local fermé. Le lendemain, la vitre d\'un véhicule stationné à proximité est brisée. Un fourgon est retrouvé sur place.',
  },
  {
    title: 'Objets',
    blocks: [],
    free: [
      ['* Véhicule utilitaire (retrouvé) : Marque : EXEMPLAR - Modèle : CARGO 2 - Couleur : Blanc -', 'Immatriculation : AB-123-CD - Date de mise en circulation : 07/07/2014'],
      ['* Perceuse sans fil, marque Outilfix, numéro de série OF-55821'],
    ],
  },
  { title: 'Suites données', blocks: [[['Mesure', 'Constatations'], ['Transmission', 'Néant']]] },
];

interface Draw {
  page: number;
  /** Titles are written before the rest of their page. */
  title: boolean;
  text: string;
  x: number;
  y: number;
  font: string;
  size: number;
}

/** Lays the form out in reading order; returns what each page draws. */
function layout(): Draw[] {
  const out: Draw[] = [];
  let page = 0;
  let y = MARGIN;
  const room = (h: number) => {
    if (y + h > A4.h - BOTTOM) {
      page++;
      y = MARGIN;
    }
  };
  const put = (text: string, font: string, size: number, x: number, title = false) => {
    room(size + 4);
    out.push({ page, title, text, x, y, font, size });
    y += size + 4;
  };
  put('Fiche de signalement', `bold 16px ${FONT}`, 16, A4.w / 2 - 80, true);
  y += 10;
  for (const s of FORM) {
    y += 8;
    put(s.title, `bold 11px ${FONT}`, 11, MARGIN, true);
    for (const block of s.blocks) {
      y += 4;
      for (const [label, value] of block) {
        put(label, `bold italic 7px ${FONT}`, 7, MARGIN + 20);
        put(value, `7px ${FONT}`, 7, MARGIN + 20);
      }
    }
    if (s.text) put(s.text.slice(0, 120), `7px ${FONT}`, 7, MARGIN + 20), put(s.text.slice(120), `7px ${FONT}`, 7, MARGIN + 20);
    if (s.free) {
      put('Véhicule', `bold italic 7px ${FONT}`, 7, MARGIN + 20);
      for (const lines of s.free) for (const line of lines) put(line, `7px ${FONT}`, 7, MARGIN + 20);
    }
  }
  return out;
}

function main() {
  const { values } = parseArgs({ options: { out: { type: 'string', default: 'out/forms' } } });
  mkdirSync(values.out!, { recursive: true });
  const draws = layout();
  const pages = Math.max(...draws.map((d) => d.page)) + 1;
  const doc = new PDFDocument();
  for (let p = 0; p < pages; p++) {
    const ctx = doc.beginPage(A4.w, A4.h) as unknown as SKRSContext2D;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4.w, A4.h);
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    const mine = draws.filter((d) => d.page === p);
    // Titles first, then the rest from the bottom up: the file order is not the reading order.
    for (const d of [...mine.filter((x) => x.title), ...mine.filter((x) => !x.title).reverse()]) {
      ctx.font = d.font;
      ctx.fillText(d.text, d.x, d.y);
    }
    ctx.font = `7px ${FONT}`;
    ctx.fillText(`Page ${p + 1} / ${pages}`, A4.w / 2 - 15, A4.h - 30);
    doc.endPage();
  }
  const file = join(values.out!, 'fiche-signalement.pdf');
  writeFileSync(file, doc.close());
  console.log(`${file} (${pages} pages)`);
}

main();
