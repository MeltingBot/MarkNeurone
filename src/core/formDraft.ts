// ─── Drafting a form model ───────────────────────────────────
//
// From the lines of a PDF form to a model the user adjusts: titles,
// labels and values are told apart by their font (titles larger, labels
// in a font of their own), repeated labels make blocks, lists of
// "Key : value" make free items. Nothing is final: every choice is shown
// in the model editor, tried on the document, and saved by the user.

import { foldLabel, type FormModel } from './formModel.ts';
import { formLines, keyValuePairs, type FormLine, type FormPageInput } from './formReader.ts';
import { findDateRange, findDates } from './dates.ts';

export type DraftFieldType = 'text' | 'date' | 'number' | 'event' | 'skip';
export type DraftSectionKind = 'document' | 'block' | 'list' | 'text' | 'note';

export interface DraftField {
  label: string;
  /** Other wordings of the label, kept from an existing model. */
  aliases?: string[];
  property: string;
  type: DraftFieldType;
}

export interface DraftSection {
  id: string;
  title: string;
  /** Other wordings of the title, kept from an existing model. */
  otherTitles?: string[];
  /** Text section kept as a document property, from an existing model. */
  textProperty?: string;
  kind: DraftSectionKind;
  fields: DraftField[];
  /** Label opening a block. */
  startsWith: string;
  tag: string;
  /** Name of the block's element: "{Label}", "{Label|date}". */
  nameTemplate: string;
  links: { to: string; label: string }[];
}

export interface FormDraft {
  id: string;
  name: string;
  signature: string[];
  empty: string[];
  documentLink: string;
  /** Fields before the first title: always the document's. */
  header: DraftField[];
  sections: DraftSection[];
}

const BULLET = /^[*•\-–]\s*/;
const hasLetter = (s: string) => /\p{L}/u.test(s);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const fontKey = (l: FormLine) => l.fonts.join('+');

/** Title, label or value, from the fonts of the form. */
export function classifyLines(lines: FormLine[]): ('title' | 'label' | 'value')[] {
  const byFont = new Map<string, FormLine[]>();
  for (const l of lines) byFont.set(fontKey(l), [...(byFont.get(fontKey(l)) ?? []), l]);
  const keys = [...byFont.keys()].filter((k) => k !== '');
  if (!keys.length) {
    // No fonts: a label is a short line ending with a colon.
    return lines.map((l) => (/^[^:]{1,60}:\s*$/.test(l.text) ? 'label' : 'value'));
  }
  const common = keys.reduce((a, b) => (byFont.get(b)!.length > byFont.get(a)!.length ? b : a));
  const bodySize = median(byFont.get(common)!.map((l) => l.size));
  const titleKeys = new Set(keys.filter((k) => median(byFont.get(k)!.map((l) => l.size)) >= bodySize * 1.2));
  // Labels and values alternate: the pair of fonts most often one after the other.
  const pairs = new Map<string, number>();
  lines.forEach((l, i) => {
    const next = lines[i + 1];
    if (!next || next.page !== l.page) return;
    const a = fontKey(l);
    const b = fontKey(next);
    if (a && b && a !== b && !titleKeys.has(a) && !titleKeys.has(b)) pairs.set(`${a}>${b}`, (pairs.get(`${a}>${b}`) ?? 0) + 1);
  });
  const top = [...pairs].sort((x, y) => y[1] - x[1])[0]?.[0];
  const labelKey = top ? top.split('>')[0] : null;
  return lines.map((l) => {
    const k = fontKey(l);
    if (titleKeys.has(k)) return 'title';
    // A code in the label font (digits only) is a value.
    if (k === labelKey && hasLetter(l.text) && l.text.length <= 60) return 'label';
    return 'value';
  });
}

/** "Victime(s)" > "Victime": a tag offered from a title. */
function tagOf(title: string): string {
  return title.replace(/\((?:e|s|es|x)\)/gi, '').replace(/\s+/g, ' ').trim();
}

function slug(s: string): string {
  return foldLabel(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rubrique';
}

function guessType(samples: string[]): DraftFieldType {
  const filled = samples.filter((s) => s.trim());
  if (!filled.length) return 'text';
  if (filled.some((s) => findDateRange(findDates(s)))) return 'event';
  if (filled.every((s) => findDates(s).length > 0)) return 'date';
  return 'text';
}

interface RawSection {
  title: string | null;
  labels: Map<string, { label: string; count: number; samples: string[] }>;
  firstLabel: string | null;
  values: string[];
}

/** A first model for the document, to adjust in the editor. */
export function draftFromPages(pages: FormPageInput[], name: string): FormDraft {
  const lines = formLines(pages);
  const kinds = classifyLines(lines);
  const raws: RawSection[] = [{ title: null, labels: new Map(), firstLabel: null, values: [] }];
  const titles: string[] = [];
  let current: { label: string; samples: string[] } | null = null;
  lines.forEach((l, i) => {
    const sec = raws[raws.length - 1];
    if (kinds[i] === 'title') {
      titles.push(l.text);
      raws.push({ title: l.text, labels: new Map(), firstLabel: null, values: [] });
      current = null;
    } else if (kinds[i] === 'label') {
      const key = foldLabel(l.text);
      const entry = sec.labels.get(key) ?? { label: l.text.replace(/\s*:\s*$/, ''), count: 0, samples: [] };
      entry.count++;
      sec.labels.set(key, entry);
      sec.firstLabel ??= key;
      current = { label: key, samples: entry.samples };
      entry.samples.push('');
    } else {
      sec.values.push(l.text);
      if (current) current.samples[current.samples.length - 1] = `${current.samples[current.samples.length - 1]} ${l.text}`.trim();
    }
  });

  // Values found under several labels and without digits: "Non renseigné".
  const seen = new Map<string, Set<string>>();
  for (const r of raws) for (const [key, e] of r.labels) for (const s of e.samples) if (s && !/\d/.test(s)) seen.set(s, (seen.get(s) ?? new Set()).add(key));
  const empty = [...seen].filter(([, keys]) => keys.size >= 3).map(([s]) => s);
  const isEmpty = (s: string) => !s || empty.includes(s) || /^[xX\s.]+$/.test(s);

  const fieldsOf = (r: RawSection): DraftField[] =>
    [...r.labels.values()].map((e) => ({ label: e.label, property: e.label, type: guessType(e.samples.filter((s) => !isEmpty(s))) }));

  const ids = new Set<string>();
  const sections: DraftSection[] = [];
  for (const r of raws.slice(1)) {
    const title = r.title!;
    let id = slug(title);
    for (let n = 2; ids.has(id); n++) id = `${slug(title)}-${n}`;
    ids.add(id);
    const fields = fieldsOf(r);
    const first = r.firstLabel ? r.labels.get(r.firstLabel)! : null;
    const items = r.values.filter((v) => BULLET.test(v) || keyValuePairs(v).length >= 2).length;
    let kind: DraftSectionKind;
    if (items) kind = 'list';
    else if (!fields.length) kind = 'text';
    else if ((first && first.count > 1) || /\((?:e|s|es|x)\)/i.test(title)) kind = 'block';
    else kind = 'document';
    // Named after its first field with letters (a code is not a name), and
    // its date when it has one: blocks of the same kind stay apart.
    const named = [...r.labels.values()].find((e) => e.samples.some((s) => !isEmpty(s) && hasLetter(s))) ?? first;
    const dated = fields.find((f) => f.type === 'event');
    const nameTemplate = named ? `{${named.label}}${dated && dated.label !== named.label ? ` {${dated.label}|date}` : ''}` : '';
    sections.push({
      id,
      title,
      kind,
      fields,
      startsWith: first?.label ?? '',
      tag: kind === 'block' || kind === 'list' ? tagOf(title) : '',
      nameTemplate,
      links: [],
    });
  }
  // A section holding the label that opens blocks elsewhere has the same blocks
  // (a section left empty in this copy of the form).
  for (const s of sections) {
    if (s.kind !== 'document') continue;
    const twin = sections.find((o) => o !== s && o.kind === 'block' && s.fields.some((f) => foldLabel(f.label) === foldLabel(o.startsWith)));
    if (!twin) continue;
    s.kind = 'block';
    s.startsWith = twin.startsWith;
    s.tag = tagOf(s.title);
    s.nameTemplate = `{${twin.startsWith}}`;
  }
  // A title with nothing under it (the form's own title) only signs the model,
  // and names it when no name is given.
  const kept = sections.filter((s, i) => s.fields.length || raws[i + 1].values.length);
  const formTitle = sections.find((s, i) => !s.fields.length && !raws[i + 1].values.length)?.title;
  name = name || formTitle || 'Formulaire';
  return {
    id: slug(name),
    name,
    signature: titles.slice(0, 2),
    empty,
    documentLink: '',
    header: fieldsOf(raws[0]).filter((f) => f.type !== 'event'),
    sections: kept,
  };
}

/** The draft as an importable model (the JSON format of the documentation). */
export function draftToRaw(d: FormDraft): Record<string, unknown> {
  const used = (f: DraftField) => f.type !== 'skip' && f.property.trim();
  const labelOf = (f: DraftField) => (f.aliases?.length ? [f.label, ...f.aliases] : f.label);
  const field = (f: DraftField, eventName?: string) =>
    f.type === 'event'
      ? { label: labelOf(f), event: eventName ?? `{${f.label}}` }
      : { label: labelOf(f), property: f.property.trim(), ...(f.type !== 'text' ? { type: f.type } : {}) };
  const docField = (f: DraftField) => field(f.type === 'event' ? { ...f, type: 'date' } : f);
  const documentFields = [...d.header, ...d.sections.filter((s) => s.kind === 'document').flatMap((s) => s.fields)].filter(used).map(docField);
  return {
    id: d.id,
    name: d.name,
    signature: d.signature.filter((s) => s.trim()),
    empty: d.empty.filter((s) => s.trim()),
    ...(d.documentLink.trim() ? { documentLink: d.documentLink.trim() } : {}),
    document: { fields: documentFields },
    sections: d.sections.map((s) => {
      const base = { id: s.id, title: s.otherTitles?.length ? [s.title, ...s.otherTitles] : s.title };
      const links = s.links.filter((l) => l.label.trim());
      if (s.kind === 'block') {
        const first = s.nameTemplate.match(/\{([^}|]+)/)?.[1];
        return {
          ...base,
          block: {
            startsWith: s.startsWith,
            element: { tag: s.tag.trim() || null, label: s.nameTemplate.trim() || null },
            fields: s.fields.filter(used).map((f) => field(f, first ? `{${first}}` : undefined)),
            links,
          },
        };
      }
      if (s.kind === 'list') return { ...base, block: { startsWith: '*', element: { tag: s.tag.trim() || null, label: null }, free: true, links } };
      return { ...base, text: true, ...(s.kind === 'note' ? { note: true } : s.kind === 'text' && s.textProperty ? { property: s.textProperty } : {}) };
    }),
  };
}

/** An existing model back in the editor. */
export function draftFromModel(m: FormModel): FormDraft {
  const fieldOf = (f: FormModel['documentFields'][number]): DraftField => ({
    label: f.labels[0],
    ...(f.labels.length > 1 ? { aliases: f.labels.slice(1) } : {}),
    property: f.property ?? f.labels[0],
    type: f.event ? 'event' : (f.type ?? 'text'),
  });
  return {
    id: m.id,
    name: m.name,
    signature: m.signature,
    empty: m.empty,
    documentLink: m.documentLink ?? '',
    header: m.documentFields.map(fieldOf),
    sections: m.sections.map((s) => {
      const b = s.block;
      const kind: DraftSectionKind = b ? (b.free ? 'list' : 'block') : s.textField?.note ? 'note' : 'text';
      return {
        id: s.id,
        title: s.titles[0],
        ...(s.titles.length > 1 ? { otherTitles: s.titles.slice(1) } : {}),
        ...(s.textField?.property ? { textProperty: s.textField.property } : {}),
        kind,
        fields: b && !b.free ? b.fields.map(fieldOf) : [],
        startsWith: b && !b.free ? (b.startsWith[0] ?? '') : '',
        tag: b?.element.tag ?? '',
        nameTemplate: b?.element.label ?? '',
        links: b?.links ?? [],
      };
    }),
  };
}

/** Labels of the document missing from the model, added unused: the user sees what the form holds. */
export function withDetected(d: FormDraft, detected: FormDraft): FormDraft {
  const known = (fields: DraftField[], label: string) => fields.some((f) => [f.label, ...(f.aliases ?? [])].some((l) => foldLabel(l) === foldLabel(label)));
  // Document fields come back in the header: those read in a section return to it.
  let header = d.header;
  const placed = d.sections.map((s) => {
    const same = detected.sections.find((o) => [s.title, ...(s.otherTitles ?? [])].some((t) => foldLabel(t) === foldLabel(o.title)));
    if (s.kind !== 'text' || s.textProperty || !same || same.kind !== 'document') return s;
    const mine = header.filter((f) => same.fields.some((o) => known([f], o.label)));
    if (!mine.length) return s;
    header = header.filter((f) => !mine.includes(f));
    return { ...s, kind: 'document' as const, fields: mine };
  });
  d = { ...d, header, sections: placed };
  const allDoc = [...d.header, ...d.sections.flatMap((s) => (s.kind === 'document' ? s.fields : []))];
  return {
    ...d,
    sections: d.sections.map((s) => {
      const same = detected.sections.find((o) => [s.title, ...(s.otherTitles ?? [])].some((t) => foldLabel(t) === foldLabel(o.title)));
      if (!same || (s.kind !== 'block' && s.kind !== 'document')) return s;
      const pool = s.kind === 'document' ? allDoc : s.fields;
      const extra = same.fields.filter((f) => !known(pool, f.label) && !known(d.header, f.label)).map((f) => ({ ...f, type: 'skip' as const }));
      return extra.length ? { ...s, fields: [...s.fields, ...extra] } : s;
    }),
  };
}
