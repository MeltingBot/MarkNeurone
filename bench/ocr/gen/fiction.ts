// Fictional content for generated test reports (procès-verbaux).
// Every name, company, number and place is invented; identifiers are random
// but carry valid check digits so that the bench can test checksum flagging.

export type Rng = () => number;

/** Deterministic PRNG so that a given seed always yields the same corpus. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const digits = (rng: Rng, n: number): string => Array.from({ length: n }, () => Math.floor(rng() * 10)).join('');

const FIRST = ['Lucien', 'Marthe', 'Gaspard', 'Odile', 'Firmin', 'Adèle', 'Hector', 'Solène', 'Ernest', 'Ninon', 'Basile', 'Clémence'];
const LAST = ['VERNADET', 'QUILLOT', 'BRASSAC', 'MORVILLE', 'DELARZE', 'FOUQUERAY', 'TRÉVOUX', 'GALANDIER', 'ROUSSIGNOL', 'PLANCHAUD'];
const STREETS = ['rue des Tanneurs', 'avenue du Vieux Moulin', 'chemin de la Croix Blanche', 'impasse des Glycines', 'boulevard Anatole Ferrand'];
const CITIES = ['Saint-Aubin-les-Bruyères', 'Montfaucon-sur-Lèze', 'Villeneuve-la-Garenne-Haute', 'Castelroux', 'Bourg-Achard-le-Vieux'];
const COMPANIES = ['SARL Ateliers Morvan Distribution', 'SAS Transports Lacombe Frères', 'EURL Bâtiment Ravel Rénovation', 'SA Négoce Céréalier du Lauragais'];
const VEHICLES = ['Peugeot 308 grise', 'Renault Clio blanche', 'Citroën Berlingo bleu', 'Volkswagen Golf noire', 'Dacia Duster rouge'];

const PLATE_LETTERS = 'ABCDEFGHJKLMNPQRSTVWXYZ';

export interface PageTruth {
  phones: string[];
  plates: string[];
  ibans: string[];
  sirets: string[];
  /** Full page text, line breaks included, for character error rate. */
  text: string;
}

export function phone(rng: Rng): { raw: string; value: string } {
  const value = pick(rng, ['06', '07', '01', '02', '04', '05', '09']) + digits(rng, 8);
  const sep = pick(rng, [' ', ' ', '.', '']);
  const raw = sep === '' ? value : value.match(/../g)!.join(sep);
  return { raw, value };
}

export function plate(rng: Rng): string {
  const l = () => PLATE_LETTERS[Math.floor(rng() * PLATE_LETTERS.length)];
  return `${l()}${l()}-${digits(rng, 3)}-${l()}${l()}`;
}

function luhnDigit(body: string): string {
  for (let d = 0; d <= 9; d++) {
    const s = body + d;
    let sum = 0;
    let dbl = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let v = s.charCodeAt(i) - 48;
      if (dbl) {
        v *= 2;
        if (v > 9) v -= 9;
      }
      sum += v;
      dbl = !dbl;
    }
    if (sum % 10 === 0) return String(d);
  }
  throw new Error('unreachable');
}

export function siret(rng: Rng): { raw: string; value: string } {
  let siren = String(1 + Math.floor(rng() * 9)) + digits(rng, 7);
  siren += luhnDigit(siren);
  let value = siren + digits(rng, 4);
  value += luhnDigit(value);
  return { raw: `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6, 9)} ${value.slice(9)}`, value };
}

export function iban(rng: Rng): { raw: string; value: string } {
  const bban = digits(rng, 23);
  const numeric = bban + '1527' + '00'; // "FR" -> 15 27
  let rem = 0;
  for (const c of numeric) rem = (rem * 10 + Number(c)) % 97;
  const check = String(98 - rem).padStart(2, '0');
  const value = `FR${check}${bban}`;
  return { raw: value.match(/.{1,4}/g)!.join(' '), value };
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Builds the paragraphs of a fictional hearing report together with the
 * identifiers it contains. Paragraphs are wrapped into lines by the renderer.
 */
export function buildReport(rng: Rng, pageCount: number): { pages: string[][]; truth: Omit<PageTruth, 'text'>[] } {
  const pages: string[][] = [];
  const truth: Omit<PageTruth, 'text'>[] = [];
  const person = () => `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
  const witness = person();
  const day = 1 + Math.floor(rng() * 28);
  const month = pick(rng, MONTHS);

  for (let p = 0; p < pageCount; p++) {
    const t = { phones: [] as string[], plates: [] as string[], ibans: [] as string[], sirets: [] as string[] };
    const paras: string[] = [];
    if (p === 0) {
      paras.push('PROCÈS-VERBAL D\'AUDITION DE TÉMOIN');
      paras.push(`Procédure fictive n° ${digits(rng, 5)}/${digits(rng, 4)} - Document de test généré, sans valeur.`);
      paras.push(
        `Le ${day} ${month} deux mille vingt-cinq, à ${8 + Math.floor(rng() * 10)} heures ${10 + Math.floor(rng() * 49)}, ` +
          `nous, officier de police judiciaire de la brigade fictive de ${pick(rng, CITIES)}, entendons la personne ci-après dénommée.`,
      );
      const ph = phone(rng);
      t.phones.push(ph.value);
      paras.push(
        `Se présente ${witness}, demeurant ${1 + Math.floor(rng() * 120)} ${pick(rng, STREETS)} à ${pick(rng, CITIES)}, ` +
          `joignable au ${ph.raw}, qui déclare :`,
      );
    } else {
      paras.push(`Suite de l'audition de ${witness}.`);
    }

    const blocks = 3 + Math.floor(rng() * 2);
    for (let b = 0; b < blocks; b++) {
      const kind = Math.floor(rng() * 4);
      if (kind === 0) {
        const pl = plate(rng);
        t.plates.push(pl);
        paras.push(
          `"Le soir des faits, j'ai vu une ${pick(rng, VEHICLES)} immatriculée ${pl} stationner devant le dépôt. ` +
            `Le conducteur, que je connais sous le nom de ${person()}, est resté une vingtaine de minutes avant de repartir vers ${pick(rng, CITIES)}."`,
        );
      } else if (kind === 1) {
        const ib = iban(rng);
        const sr = siret(rng);
        t.ibans.push(ib.value);
        t.sirets.push(sr.value);
        paras.push(
          `"Les paiements passaient par la société ${pick(rng, COMPANIES)}, SIRET ${sr.raw}. ` +
            `Les virements étaient faits sur le compte ${ib.raw}, je l'ai lu sur une facture."`,
        );
      } else if (kind === 2) {
        const a = phone(rng);
        const c = phone(rng);
        t.phones.push(a.value, c.value);
        paras.push(
          `"${person()} m'appelait toujours depuis le ${a.raw}. Une fois, il a utilisé un autre numéro, le ${c.raw}, ` +
            `en me disant que son téléphone habituel était en réparation."`,
        );
      } else {
        paras.push(
          `"Je ne sais rien de plus sur ce point. Je précise que je n'ai jamais travaillé pour cette entreprise ` +
            `et que je n'ai reçu aucune somme d'argent de la part de ${person()}."`,
        );
      }
    }
    paras.push(p === pageCount - 1 ? 'Lecture faite par elle-même, persiste et signe avec nous.' : '(suite page suivante)');
    pages.push(paras);
    truth.push(t);
  }
  return { pages, truth };
}
