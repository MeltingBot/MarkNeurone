import { BECH32_CHARSET, bech32Checksum } from '../../../src/core/patterns/checksums.ts';

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

export type TruthKind =
  | 'phone' | 'plate' | 'iban' | 'siret' | 'nir' | 'email' | 'url' | 'ipv4' | 'ipv6' | 'btc' | 'eth' | 'amount' | 'date' | 'name';

export const TRUTH_KINDS: TruthKind[] = ['name', 'phone', 'plate', 'iban', 'siret', 'nir', 'email', 'url', 'ipv4', 'ipv6', 'btc', 'eth', 'amount', 'date'];

/** One expected suggestion: the text exactly as written in the report. */
export interface TruthItem {
  kind: TruthKind;
  value: string;
  /** Names: the element label the dictionary knows (the text may be reversed or use an initial). */
  canonical?: string;
}

export interface PageTruth {
  items: TruthItem[];
  /** Full page text, line breaks included, for character error rate. */
  text: string;
}

/**
 * A phone number as people write it: French with spaces, dots or hyphens,
 * written together, with +33 or 0033, or a foreign number (Belgium, Switzerland,
 * Spain, United Kingdom).
 */
export function phone(rng: Rng): { raw: string; value: string } {
  const value = pick(rng, ['06', '07', '01', '02', '04', '05', '09']) + digits(rng, 8);
  const pairs = value.match(/../g)!;
  const national = value.slice(1);
  const raw = pick(rng, [
    () => pairs.join(' '),
    () => pairs.join(' '),
    () => pairs.join('.'),
    () => pairs.join('-'),
    () => value,
    () => `+33 ${national[0]} ${national.slice(1).match(/../g)!.join(' ')}`,
    () => `+33${national}`,
    () => `0033 ${national[0]} ${national.slice(1).match(/../g)!.join(' ')}`,
    () => `+32 4${digits(rng, 2)} ${digits(rng, 2)} ${digits(rng, 2)} ${digits(rng, 2)}`,
    () => `+41 7${digits(rng, 1)} ${digits(rng, 3)} ${digits(rng, 2)} ${digits(rng, 2)}`,
    () => `+34 6${digits(rng, 2)} ${digits(rng, 3)} ${digits(rng, 3)}`,
    () => `+44 7${digits(rng, 3)} ${digits(rng, 6)}`,
  ])();
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

export function nir(rng: Rng): string {
  const body = String(1 + Math.floor(rng() * 2)) + digits(rng, 2) + String(1 + Math.floor(rng() * 9)).padStart(2, '0') + digits(rng, 8);
  const key = String(97 - Number(BigInt(body) % 97n)).padStart(2, '0');
  return `${body[0]} ${body.slice(1, 3)} ${body.slice(3, 5)} ${body.slice(5, 7)} ${body.slice(7, 10)} ${body.slice(10, 13)} ${key}`;
}

const HEX = '0123456789abcdef';
const chars = (rng: Rng, set: string, n: number) => Array.from({ length: n }, () => set[Math.floor(rng() * set.length)]).join('');

export const ipv4 = (rng: Rng) => [10 + Math.floor(rng() * 200), Math.floor(rng() * 256), Math.floor(rng() * 256), 1 + Math.floor(rng() * 254)].join('.');
export const ipv6 = (rng: Rng) => `2001:db8:${chars(rng, HEX, 4)}::${chars(rng, HEX, 3)}:${chars(rng, HEX, 4)}`;
/** Segwit version 0 address (20-byte program) with a valid bech32 checksum. */
export function btc(rng: Rng): string {
  const data = [0, ...Array.from({ length: 32 }, () => Math.floor(rng() * 32))];
  return `bc1${data.map((d) => BECH32_CHARSET[d]).join('')}${bech32Checksum('bc', data)}`;
}
export const eth = (rng: Rng) => `0x${chars(rng, HEX, 40)}`;
export function amount(rng: Rng): string {
  const euros = 50 + Math.floor(rng() * 9000);
  const text = euros >= 1000 ? `${Math.floor(euros / 1000)} ${String(euros % 1000).padStart(3, '0')}` : String(euros);
  return `${text} ${pick(rng, ['€', 'euros'])}`;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const ALIASES = ['Le Grand', 'Bébert', 'Le Comptable', 'Tonton'];

/**
 * Builds the paragraphs of a fictional hearing report together with every
 * suggestion it should give: identifiers, amounts, dates and the names the
 * dossier would know (people, places, companies). Paragraphs are wrapped into
 * lines by the renderer. Every kind appears at least once over the report.
 */
export function buildReport(rng: Rng, pageCount: number): { pages: string[][]; truth: Omit<PageTruth, 'text'>[] } {
  const pages: string[][] = [];
  const truth: Omit<PageTruth, 'text'>[] = [];
  let items: TruthItem[] = [];
  const add = (kind: TruthKind, value: string, canonical?: string) => {
    items.push({ kind, value, ...(canonical ? { canonical } : {}) });
    return value;
  };
  /** A person as written in a statement: usually "First LAST", sometimes reversed or with an initial. */
  const person = (canonical = `${pick(rng, FIRST)} ${pick(rng, LAST)}`) => {
    const [first, last] = canonical.split(' ');
    const r = rng();
    const written = r < 0.7 ? canonical : r < 0.85 ? `${last} ${first}` : `${first[0]}. ${last}`;
    return add('name', written, canonical);
  };
  const city = () => add('name', pick(rng, CITIES));
  const company = () => add('name', pick(rng, COMPANIES));
  const witness = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
  const day = 1 + Math.floor(rng() * 28);
  const month = pick(rng, MONTHS);

  const blocks: (() => string)[] = [
    () => {
      const pl = add('plate', plate(rng));
      return `"Le soir des faits, j'ai vu une ${pick(rng, VEHICLES)} immatriculée ${pl} stationner devant le dépôt. ` +
        `Le conducteur, que je connais sous le nom de ${person()}, est resté une vingtaine de minutes avant de repartir vers ${city()}."`;
    },
    () => {
      const name = company();
      const sr = siret(rng);
      const ib = iban(rng);
      add('siret', sr.raw);
      add('iban', ib.raw);
      return `"Les paiements passaient par la société ${name}, SIRET ${sr.raw}. Les virements étaient faits sur le compte ${ib.raw}, je l'ai lu sur une facture."`;
    },
    () => {
      const who = person();
      const a = add('phone', phone(rng).raw);
      const c = add('phone', phone(rng).raw);
      return `"${who} m'appelait toujours depuis le ${a}. Une fois, il a utilisé un autre numéro, le ${c}, en me disant que son téléphone habituel était en réparation."`;
    },
    () => {
      const who = person();
      const alias = add('name', pick(rng, ALIASES));
      const mail = add('email', `${who.split(' ').pop()!.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z]/g, '')}.${digits(rng, 2)}@exemple.test`);
      const link = add('url', `https://exemple.test/annonce/${digits(rng, 6)}`);
      return `"${who}, que tout le monde appelle ${alias}, m'écrivait à l'adresse ${mail}. Il m'a envoyé le lien ${link} pour voir le matériel."`;
    },
    () => {
      const numbers = [0, 1, 2, 3].map(() => add('phone', phone(rng).raw));
      return `"Dans son répertoire, il y avait le ${numbers[0]}, le ${numbers[1]}, le ${numbers[2]} et le ${numbers[3]}."`;
    },
    () => {
      const a = add('ipv4', ipv4(rng));
      const b = add('ipv6', ipv6(rng));
      return `"Je sais qu'il se connectait depuis l'adresse ${a}, et parfois depuis l'adresse ${b}, c'est ce que m'a montré mon neveu."`;
    },
    () => {
      const b = add('btc', btc(rng));
      const e = add('eth', eth(rng));
      return `"Il voulait être payé en Bitcoin sur l'adresse ${b} ou en Ether sur ${e}."`;
    },
    () => {
      const date = add('date', `${String(1 + Math.floor(rng() * 28)).padStart(2, '0')}/${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}/2025`);
      const sum = add('amount', amount(rng));
      const who = person();
      const n = add('nir', nir(rng));
      return `"Le ${date}, j'ai remis la somme de ${sum} à ${who}, dont le numéro de sécurité sociale ${n} figurait sur une attestation."`;
    },
  ];
  // Shuffled, then spread over the pages, so that each kind appears.
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }
  const perPage = Math.ceil(blocks.length / pageCount);

  for (let p = 0; p < pageCount; p++) {
    items = [];
    const paras: string[] = [];
    if (p === 0) {
      paras.push('PROCÈS-VERBAL D\'AUDITION DE TÉMOIN');
      paras.push(`Procédure fictive n° ${digits(rng, 5)}/${digits(rng, 4)} - Document de test généré, sans valeur.`);
      const date = add('date', `${day} ${month} deux mille vingt-cinq, à ${8 + Math.floor(rng() * 10)} heures ${10 + Math.floor(rng() * 49)}`);
      paras.push(`Le ${date}, nous, officier de police judiciaire de la brigade fictive de ${city()}, entendons la personne ci-après dénommée.`);
      const name = add('name', witness, witness);
      const street = `${1 + Math.floor(rng() * 120)} ${pick(rng, STREETS)}`;
      const place = city();
      const ph = add('phone', phone(rng).raw);
      paras.push(`Se présente ${name}, demeurant ${street} à ${place}, joignable au ${ph}, qui déclare :`);
    } else {
      paras.push(`Suite de l'audition de ${add('name', witness, witness)}.`);
    }
    for (const block of blocks.slice(p * perPage, (p + 1) * perPage)) paras.push(block());
    paras.push(p === pageCount - 1 ? 'Lecture faite par elle-même, persiste et signe avec nous.' : '(suite page suivante)');
    pages.push(paras);
    truth.push({ items });
  }
  return { pages, truth };
}
