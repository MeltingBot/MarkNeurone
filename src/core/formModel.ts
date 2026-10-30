// ─── Form models ─────────────────────────────────────────────
//
// A form model describes a document type produced by software: section
// titles, repeated blocks and the labels of their fields, and what each
// value becomes in the graph. Models are user configuration, imported as
// JSON (docs/lecture-formulaires.md, section 3); none is built in.

import { findDates } from './dates.ts';

export interface FormField {
  /** Label and its alternative wordings. */
  labels: string[];
  /** The value becomes this property of the block's element. */
  property?: string;
  /** Property type; 'text' when absent. */
  type?: 'text' | 'date' | 'number';
  /** The value is a date or a period: an event of the element, named by this template. */
  event?: string;
}

export interface FormBlockDef {
  /** Label that opens a new block; '*' opens one at each line starting with a bullet. */
  startsWith: string[];
  element: { tag: string | null; label: string | null };
  fields: FormField[];
  /** No labels: the block's text is offered as is. */
  free: boolean;
  links: { to: string; label: string }[];
}

export interface FormSection {
  id: string;
  titles: string[];
  /** Absent: a section of free text, left to the usual highlighting. */
  block?: FormBlockDef;
  /** Free text section whose whole text is a property of the document. */
  textField?: FormField;
}

export interface FormModel {
  id: string;
  name: string;
  /** Labels that must all be on the first page for the model to be offered. */
  signature: string[];
  /** Values read as empty. */
  empty: string[];
  /** Fields outside blocks: properties of the element carrying the document. */
  documentFields: FormField[];
  sections: FormSection[];
  /** Label of a link from each block's element to the element carrying the document. */
  documentLink?: string;
}

export const BULLET = '*';

/** Part of an imported model left out, for the import message. */
export interface ModelIssue {
  reason: 'no_name' | 'no_signature' | 'no_title' | 'duplicate_id' | 'no_start' | 'no_label' | 'no_target' | 'unknown_link';
  /** Title of the section concerned; absent for the document's fields and the model itself. */
  section?: string;
  /** Field label, or link target. */
  subject?: string;
}

/** Case, accents, spaces and a trailing colon do not count. */
export function foldLabel(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '')
    .trim();
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function textList(v: unknown): string[] {
  const list = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  for (const item of list) {
    const s = text(item);
    if (s && !out.some((o) => foldLabel(o) === foldLabel(s))) out.push(s);
  }
  return out;
}

const TYPES = ['text', 'date', 'number'] as const;

function field(raw: unknown, section: string | undefined, dropped: ModelIssue[]): FormField | null {
  const f = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const labels = textList(f.label ?? f.labels);
  if (!labels.length) {
    dropped.push({ reason: 'no_label', section });
    return null;
  }
  const property = text(f.property);
  const event = text(f.event);
  if (!property && !event) {
    dropped.push({ reason: 'no_target', section, subject: labels[0] });
    return null;
  }
  const type = TYPES.find((t) => t === f.type);
  return { labels, ...(property ? { property } : {}), ...(event ? { event } : {}), ...(type && type !== 'text' ? { type } : {}) };
}

function fields(raw: unknown, section: string | undefined, dropped: ModelIssue[]): FormField[] {
  return (Array.isArray(raw) ? raw : []).map((f) => field(f, section, dropped)).filter((f): f is FormField => f !== null);
}

function block(raw: unknown, section: string, dropped: ModelIssue[]): FormBlockDef | null {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const startsWith = textList(b.startsWith);
  if (!startsWith.length) {
    dropped.push({ reason: 'no_start', section });
    return null;
  }
  const el = (b.element && typeof b.element === 'object' ? b.element : {}) as Record<string, unknown>;
  const links = (Array.isArray(b.links) ? b.links : [])
    .map((l) => (l && typeof l === 'object' ? (l as Record<string, unknown>) : {}))
    .map((l) => ({ to: text(l.to), label: text(l.label) }))
    .filter((l) => l.to && l.label);
  return {
    startsWith,
    element: { tag: text(el.tag) || null, label: text(el.label) || null },
    fields: fields(b.fields, section, dropped),
    free: b.free === true,
    links,
  };
}

/**
 * Imported JSON to a usable model, or null when it cannot be one. What is
 * left out is listed in `dropped`, to be shown to the user. A model already
 * normalized (exported) is accepted as well: `labels`, `titles`, `documentFields`.
 */
export function normalizeFormModel(raw: unknown): { model: FormModel | null; dropped: ModelIssue[] } {
  const dropped: ModelIssue[] = [];
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = text(m.name);
  const signature = textList(m.signature);
  if (!name) return { model: null, dropped: [{ reason: 'no_name' }] };
  if (!signature.length) return { model: null, dropped: [{ reason: 'no_signature' }] };
  const doc = (m.document && typeof m.document === 'object' ? m.document : {}) as Record<string, unknown>;
  const documentFields = fields(doc.fields ?? m.documentFields, undefined, dropped);
  const sections: FormSection[] = [];
  for (const rawSection of (Array.isArray(m.sections) ? m.sections : [])) {
    const s = (rawSection && typeof rawSection === 'object' ? rawSection : {}) as Record<string, unknown>;
    const titles = textList(s.title ?? s.titles);
    if (!titles.length) {
      dropped.push({ reason: 'no_title' });
      continue;
    }
    const id = text(s.id) || titles[0];
    if (sections.some((o) => o.id === id)) {
      dropped.push({ reason: 'duplicate_id', section: titles[0], subject: id });
      continue;
    }
    const def = s.block !== undefined && s.text !== true ? block(s.block, titles[0], dropped) : null;
    const textProperty = !def ? text(s.property) || text((s.textField as Record<string, unknown> | undefined)?.property) : '';
    sections.push({ id, titles, ...(def ? { block: def } : {}), ...(textProperty ? { textField: { labels: titles, property: textProperty } } : {}) });
  }
  for (const s of sections) {
    if (!s.block) continue;
    s.block.links = s.block.links.filter((l) => {
      const ok = sections.some((o) => o.id === l.to && o.block);
      if (!ok) dropped.push({ reason: 'unknown_link', section: s.titles[0], subject: l.to });
      return ok;
    });
  }
  return {
    model: {
      id: text(m.id) || name,
      name,
      signature,
      empty: textList(m.empty),
      documentFields,
      sections,
      ...(text(m.documentLink) ? { documentLink: text(m.documentLink) } : {}),
    },
    dropped,
  };
}

/** First date of a value as dd/mm/yyyy, with its hour when it has one. */
function firstDate(value: string): string | undefined {
  const d = findDates(value)[0];
  if (!d) return undefined;
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${p(d.date.getDate())}/${p(d.date.getMonth() + 1)}/${d.date.getFullYear()}`;
  return d.hasTime ? `${day} ${p(d.date.getHours())}:${p(d.date.getMinutes())}` : day;
}

/**
 * Replaces each {Label} by the value of that field, or empties the
 * template's part. {Label|date} keeps the first date of the value, to tell
 * apart blocks of one kind ("{Qualification} {Période|date}").
 */
export function fillTemplate(template: string, valueOf: (label: string) => string | undefined): string {
  return template
    .replace(/\{([^}|]+)(\|date)?\}/g, (_, label: string, date?: string) => {
      const value = valueOf(label.trim());
      return (value !== undefined && date ? firstDate(value) : value) ?? '';
    })
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
