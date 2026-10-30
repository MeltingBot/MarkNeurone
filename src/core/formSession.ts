// ─── Form session ────────────────────────────────────────────
//
// From a form reading to what the panel shows: the state of each block
// (to check, created, dismissed), the draft of a block's sheet with its
// defaults, and the values to highlight in the document.

import type { Annotation } from './model.ts';
import { fillTemplate, foldLabel, type FormModel } from './formModel.ts';
import { blockValue, type FormBlock, type FormReading, type FormValue, type ValueAnchor } from './formReader.ts';
import { findDateRange, findDates } from './dates.ts';

export const blockKey = (b: FormBlock) => `${b.sectionId}:${b.index}`;

export interface DraftRow {
  id: string;
  kind: 'property' | 'event' | 'note';
  /** Property key, or event name; for a note, the title of its section. */
  key: string;
  /** Value as read, editable before validation. */
  text: string;
  anchor: ValueAnchor;
  type: 'text' | 'date' | 'number';
  checked: boolean;
  /** Label absent from the model. */
  unknown?: true;
  /** A date was expected and none could be read: offered as text, unchecked. */
  unreadable?: true;
}

export interface BlockDraft {
  key: string;
  sectionId: string;
  index: number;
  label: string;
  tag: string | null;
  /** Passage the element is anchored on: the value its name comes from. */
  nameAnchor: ValueAnchor;
  nameText: string;
  rows: DraftRow[];
  /** Links offered toward elements created from other sections. */
  links: { to: string; label: string }[];
}

const overlaps = (a: [number, number], b: ValueAnchor) => a[0] < b.end && b.start < a[1];

/** A passage the user already answered: highlighted, or offered and dismissed. */
export function isAnswered(anchor: ValueAnchor, annotations: Annotation[]): boolean {
  return annotations.some(
    (a) =>
      a.page === anchor.page &&
      a.textRange &&
      (a.kind === 'suggestion'
        ? a.textRange[0] === anchor.start && a.textRange[1] === anchor.end
        : a.status !== 'rejected' && overlaps(a.textRange, anchor)),
  );
}

export type BlockState = { status: 'open' } | { status: 'done'; elementId: string } | { status: 'rejected' };

/** Created when an element highlight covers the block's name, dismissed when that name was. */
export function blockState(draft: Pick<BlockDraft, 'nameAnchor'>, annotations: Annotation[]): BlockState {
  const { nameAnchor } = draft;
  const mine = annotations.filter((a) => a.page === nameAnchor.page && a.textRange);
  const element = mine.find((a) => a.kind === 'element' && a.status === 'validated' && a.targetId && overlaps(a.textRange!, nameAnchor));
  if (element) return { status: 'done', elementId: element.targetId! };
  const rejected = mine.some((a) => a.kind === 'suggestion' && a.status === 'rejected' && a.textRange![0] === nameAnchor.start && a.textRange![1] === nameAnchor.end);
  return rejected ? { status: 'rejected' } : { status: 'open' };
}

/** First date of a value, or null. */
export function valueDate(text: string): Date | null {
  return findDates(text)[0]?.date ?? null;
}

/** Date or period of a value ("Entre le ... et le ..."), or null. */
export function valuePeriod(text: string): { date: Date; dateEnd?: Date } | null {
  const dates = findDates(text);
  if (!dates.length) return null;
  const range = findDateRange(dates);
  return range ? { date: range.start.date, dateEnd: range.end.date } : { date: dates[0].date };
}

function row(v: FormValue, i: number, valueOf: (label: string) => string | undefined): DraftRow | null {
  const f = v.field;
  if (v.unknown) return { id: `u${i}`, kind: 'property', key: v.label.replace(/\s*:\s*$/, ''), text: v.text, anchor: v.anchor, type: 'text', checked: false, unknown: true };
  if (!f) return null;
  if (f.note) return { id: `n${i}`, kind: 'note', key: v.label, text: v.text, anchor: v.anchor, type: 'text', checked: true };
  if (f.event) {
    const ok = valuePeriod(v.text) !== null;
    return { id: `e${i}`, kind: 'event', key: fillTemplate(f.event, valueOf) || v.label, text: v.text, anchor: v.anchor, type: 'date', checked: ok, ...(ok ? {} : { unreadable: true as const }) };
  }
  const type = f.type ?? 'text';
  const unreadable = type === 'date' && valueDate(v.text) === null;
  return {
    id: `p${i}`,
    kind: 'property',
    key: f.property!,
    text: v.text,
    anchor: v.anchor,
    type: unreadable ? 'text' : type,
    checked: !unreadable,
    ...(unreadable ? { unreadable: true as const } : {}),
  };
}

const MAX_NAME = 80;

/** Name offered for a free block: what comes before its first "Key : value" pair. */
function freeName(text: string): string {
  const head = text.split(/\s+:\s*|:\s+/)[0].trim();
  const name = head && head.length < text.length ? head : text;
  return name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 3).trimEnd()}...` : name;
}

/** The sheet of a block, with its defaults. */
export function blockDraft(block: FormBlock, model: FormModel): BlockDraft {
  const section = model.sections.find((s) => s.id === block.sectionId)!;
  const def = section.block!;
  const valueOf = (label: string) => blockValue(block, label);
  const rows = block.values.map((v, i) => row(v, i, valueOf)).filter((r): r is DraftRow => r !== null);
  let label = def.element.label ? fillTemplate(def.element.label, valueOf) : '';
  // The element is anchored on the value its name starts with.
  const first = def.element.label?.match(/\{([^}|]+)/)?.[1]?.trim();
  const nameValue = first ? block.values.find((v) => foldLabel(v.label) === foldLabel(first) || v.field?.labels.some((l) => foldLabel(l) === foldLabel(first))) : undefined;
  let nameAnchor = nameValue?.anchor ?? block.anchor;
  let nameText = nameValue?.text ?? '';
  if (block.free) {
    if (!label) label = freeName(block.free.text);
    nameAnchor = block.free.anchor;
    nameText = block.free.text;
    block.free.pairs.forEach((p, i) =>
      rows.push({ id: `k${i}`, kind: 'property', key: p.key, text: p.value, anchor: p.anchor ?? block.free!.anchor, type: 'text', checked: true }),
    );
  }
  return { key: blockKey(block), sectionId: block.sectionId, index: block.index, label, tag: def.element.tag, nameAnchor, nameText, rows, links: def.links };
}

/** Fields of the document: properties of the element carrying it. */
export function documentRows(reading: FormReading): DraftRow[] {
  return reading.document
    .map((v, i) => row(v, i, () => undefined))
    .filter((r): r is DraftRow => r !== null && r.kind !== 'event');
}

export interface FormHighlight {
  key: string;
  page: number;
  start: number;
  end: number;
  blockKey: string | null;
}

/** Values still to check: those of open blocks and of the document, not answered yet. */
export function formHighlights(drafts: BlockDraft[], docRows: DraftRow[], annotations: Annotation[]): FormHighlight[] {
  const out: FormHighlight[] = [];
  const seen = new Set<string>();
  const push = (anchor: ValueAnchor, blockKeyOf: string | null) => {
    const key = `form:${anchor.page}:${anchor.start}:${anchor.end}`;
    if (seen.has(key) || isAnswered(anchor, annotations)) return;
    seen.add(key);
    out.push({ key, ...anchor, blockKey: blockKeyOf });
  };
  for (const d of drafts) {
    if (blockState(d, annotations).status !== 'open') continue;
    push(d.nameAnchor, d.key);
    for (const r of d.rows) push(r.anchor, d.key);
  }
  for (const r of docRows) push(r.anchor, null);
  return out;
}
