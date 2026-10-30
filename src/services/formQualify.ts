// ─── Validating a form block ─────────────────────────────────
//
// One validation per block (docs/lecture-formulaires.md, section 6): the
// element, then each field the user left checked, then the links chosen.
// Every object goes through the qualification actions and gets its own
// annotation, with the origin 'profile' and the passage of its value.

import type { ValueAnchor } from '../core/formReader.ts';
import { valueDate, valuePeriod, type DraftRow } from '../core/formSession.ts';
import type { Passage } from './selectionCapture.ts';
import type { ZnProperty } from './znTypes.ts';
import { getElement } from './graphWriter.ts';
import {
  qualifyAsEvent,
  qualifyAsExistingElement,
  qualifyAsExistingProperty,
  qualifyAsLink,
  qualifyAsNewElement,
  qualifyAsProperty,
  rejectSuggestion,
  type DocumentContext,
} from './qualify.ts';

/** Passage of a value, from its offsets: the reader measures its boxes. */
export type PassageOf = (anchor: ValueAnchor, text: string) => Passage;

export interface BlockValidation {
  name: { anchor: ValueAnchor; text: string };
  target: { kind: 'new'; label: string; tags: string[] } | { kind: 'existing'; elementId: string };
  /** Checked rows, with the values as the user left them. */
  rows: DraftRow[];
  links: { toId: string; label: string }[];
}

/** Property of a row: typed when its value reads as its type, text otherwise. */
export function rowProperty(row: DraftRow): ZnProperty {
  const text = row.text.trim();
  if (row.type === 'date') {
    const date = valueDate(text);
    // At noon, as the element sheet stores a day: no time zone moves it to another day.
    if (date) return { key: row.key, value: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12), type: 'date' };
  }
  if (row.type === 'number') {
    const n = Number(text.replace(/\s/g, '').replace(',', '.'));
    if (text && Number.isFinite(n)) return { key: row.key, value: n, type: 'number' };
  }
  return { key: row.key, value: text, type: 'text' };
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Same day for dates (a date written as text included), same text otherwise. */
export function sameValue(existing: ZnProperty['value'], value: ZnProperty['value']): boolean {
  const day = (v: ZnProperty['value']) => {
    const d = v instanceof Date ? v : typeof v === 'string' ? valueDate(v) : null;
    return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : null;
  };
  if (value instanceof Date || existing instanceof Date) return day(existing) !== null && day(existing) === day(value);
  return existing !== null && value !== null && fold(String(existing)) === fold(String(value));
}

async function writeRows(ctx: DocumentContext, elementId: string, rows: DraftRow[], passageOf: PassageOf): Promise<void> {
  for (const row of rows) {
    const passage = passageOf(row.anchor, row.text.trim());
    if (row.kind === 'event') {
      const period = valuePeriod(row.text);
      if (!period) continue;
      await qualifyAsEvent(ctx, passage, [elementId], { label: row.key, ...period });
    } else {
      const property = rowProperty(row);
      // Attached to an element that already has it: the passage only points to it.
      const known = getElement(elementId)?.properties.find((pr) => fold(pr.key) === fold(property.key) && sameValue(pr.value, property.value));
      if (known) await qualifyAsExistingProperty(ctx, passage, elementId, known.key);
      else await qualifyAsProperty(ctx, passage, elementId, property);
    }
  }
}

/** Creates (or attaches) the block's element and what the user kept; returns the element id. */
export async function validateBlock(ctx: DocumentContext, v: BlockValidation, passageOf: PassageOf): Promise<string> {
  const passage = passageOf(v.name.anchor, v.name.text);
  const elementId =
    v.target.kind === 'new'
      ? await qualifyAsNewElement(ctx, passage, v.target.label.trim(), v.target.tags)
      : await qualifyAsExistingElement(ctx, passage, v.target.elementId);
  await writeRows(ctx, elementId, v.rows, passageOf);
  for (const link of v.links) {
    await qualifyAsLink(ctx, { page: v.name.anchor.page, text: link.label, origin: 'profile' }, elementId, link.toId, link.label);
  }
  return elementId;
}

/** Fields of the document, onto the element carrying it. */
export async function validateDocumentFields(ctx: DocumentContext, elementId: string, rows: DraftRow[], passageOf: PassageOf): Promise<void> {
  await writeRows(ctx, elementId, rows, passageOf);
}

/** The block is not offered again for this document. */
export async function rejectBlock(ctx: DocumentContext, name: { anchor: ValueAnchor; text: string }, passageOf: PassageOf): Promise<void> {
  await rejectSuggestion(ctx, passageOf(name.anchor, name.text));
}

/** Document fields dismissed one by one. */
export async function rejectRows(ctx: DocumentContext, rows: DraftRow[], passageOf: PassageOf): Promise<void> {
  for (const row of rows) await rejectSuggestion(ctx, passageOf(row.anchor, row.text));
}
