// ─── Form reading ────────────────────────────────────────────
//
// Reads a generated form with a model (core/formModel.ts): sections, blocks,
// labels and their values (docs/lecture-formulaires.md, section 4).
//
// The order of the text in the file is not the reading order: lines are
// rebuilt from the positions of pdf.js items, sorted top to bottom, and the
// pages put end to end. Each value is still returned with its offsets in the
// page text every other part of the plugin uses (core/pageText.ts).

import { pdfPageText, type PdfTextItem } from './pageText.ts';
import { BULLET, fillTemplate, foldLabel, type FormField, type FormModel, type FormSection } from './formModel.ts';
import { readFields, readPositional } from './formPositional.ts';

export interface FormTextItem extends PdfTextItem {
  width?: number;
  fontName?: string;
}

export interface FormPageInput {
  items: FormTextItem[];
  /** Page height in PDF units, to tell headers and footers. */
  height: number;
  /** Fields of a PDF form on the page (their values are not in the text). */
  widgets?: FormWidget[];
}

/** A field of a PDF form, as pdf.js gives its annotation. */
export interface FormWidget {
  /** Field name, stable from one copy of the form to the next. */
  name: string;
  kind: 'text' | 'check';
  /** Text of a text field; export value of a box ("Yes", "2"). */
  value: string;
  /** Box checked. */
  on?: boolean;
  /** [x0, y0, x1, y1] in PDF units, origin at the bottom left. */
  rect: [number, number, number, number];
}

/** Offsets in the page text (pdfPageText). */
export interface ValueAnchor {
  page: number;
  start: number;
  end: number;
}

export interface FormValue {
  /** Label as written in the document. */
  label: string;
  /** Field of the model; null for the label opening a block when it is no field, or an unknown label. */
  field: FormField | null;
  /** Label absent from the model, told by its font. */
  unknown: boolean;
  text: string;
  anchor: ValueAnchor;
  /** false when the value lies in pieces apart in the page text: the anchor covers its first piece. */
  whole: boolean;
}

export interface FormBlock {
  sectionId: string;
  /** Rank of the block in its section, from 0. */
  index: number;
  /** First line of the block. */
  anchor: ValueAnchor;
  values: FormValue[];
  /** Free block: its text, and the "Key : value" pairs found in it. */
  free?: { text: string; anchor: ValueAnchor; whole: boolean; pairs: FreePair[] };
}

/** "Key : value" pair of a free block; its anchor is the value itself when found on one line. */
export interface FreePair {
  key: string;
  value: string;
  anchor?: ValueAnchor;
}

export interface FormReading {
  /** Fields outside blocks (model.documentFields). */
  document: FormValue[];
  blocks: FormBlock[];
}

// ─── Lines ───────────────────────────────────────────────────

interface Piece {
  /** Index in the kept items of the page. */
  item: number;
  /** Where the item's string starts in the line text. */
  at: number;
}

interface Line {
  page: number;
  y: number;
  /** Untrimmed text; `from`/`to` bound the trimmed part. */
  raw: string;
  from: number;
  to: number;
  text: string;
  pieces: Piece[];
  fonts: Set<string>;
  /** Font size of its first item. */
  size: number;
}

interface PageData {
  text: string;
  starts: number[];
  kept: FormTextItem[];
}

const sizeOf = (t: number[]) => Math.hypot(t[2] ?? 0, t[3] ?? 0) || Math.abs(t[3] ?? 0) || 10;

function pageLines(pageNumber: number, data: PageData): Line[] {
  const placed = data.kept
    .map((it, item) => ({ it, item, t: it.transform ?? [1, 0, 0, 1, 0, 0] }))
    .filter((p) => p.it.str!.trim() !== '')
    .sort((a, b) => b.t[5] - a.t[5] || a.t[4] - b.t[4]);
  const groups: (typeof placed)[] = [];
  for (const p of placed) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].t[5] - p.t[5]) <= sizeOf(last[0].t) * 0.5) last.push(p);
    else groups.push([p]);
  }
  return groups.map((group) => {
    group.sort((a, b) => a.t[4] - b.t[4]);
    let raw = '';
    const pieces: Piece[] = [];
    const fonts = new Set<string>();
    let prevEnd: number | null = null;
    for (const p of group) {
      const str = p.it.str!;
      if (raw) {
        const gap = prevEnd === null ? Infinity : p.t[4] - prevEnd;
        if (gap > sizeOf(p.t) * 0.15 && !/\s$/.test(raw) && !/^\s/.test(str)) raw += ' ';
      }
      pieces.push({ item: p.item, at: raw.length });
      raw += str;
      prevEnd = typeof p.it.width === 'number' ? p.t[4] + p.it.width : null;
      if (p.it.fontName) fonts.add(p.it.fontName);
    }
    const from = raw.length - raw.trimStart().length;
    const to = raw.trimEnd().length;
    return { page: pageNumber, y: group[0].t[5], raw, from, to, text: raw.slice(from, to), pieces, fonts, size: sizeOf(group[0].t) };
  });
}

const PAGE_NUMBER = /^(page\s*)?\d+\s*((\/|sur)\s*\d+)?$/i;
const BAND = 0.1;

/** Lines repeated at the top or bottom of several pages, and page numbers there. */
function withoutRunningLines(lines: Line[], heights: number[]): Line[] {
  const inBand = (l: Line) => {
    const h = heights[l.page - 1] || 842;
    return l.y > h * (1 - BAND) || l.y < h * BAND;
  };
  const pagesOf = new Map<string, Set<number>>();
  for (const l of lines) {
    if (!inBand(l)) continue;
    const key = `${foldLabel(l.text)}@${Math.round(l.y)}`;
    const set = pagesOf.get(key) ?? new Set<number>();
    set.add(l.page);
    pagesOf.set(key, set);
  }
  return lines.filter((l) => {
    if (!inBand(l)) return true;
    if (PAGE_NUMBER.test(l.text)) return false;
    return (pagesOf.get(`${foldLabel(l.text)}@${Math.round(l.y)}`)?.size ?? 0) < 2;
  });
}

// ─── Offsets ─────────────────────────────────────────────────

/** Part of a line, in line text offsets. */
interface Span {
  line: Line;
  from: number;
  to: number;
}

const whole = (line: Line): Span => ({ line, from: line.from, to: line.to });

function spanRange(span: Span, data: PageData): [number, number] | null {
  const { pieces } = span.line;
  let start: number | null = null;
  let end: number | null = null;
  for (const p of pieces) {
    const len = data.kept[p.item].str!.length;
    if (p.at + len <= span.from || p.at >= span.to) continue;
    const s = data.starts[p.item] + Math.max(0, span.from - p.at);
    const e = data.starts[p.item] + Math.min(len, span.to - p.at);
    start = start === null ? s : Math.min(start, s);
    end = end === null ? e : Math.max(end, e);
  }
  return start === null || end === null ? null : [start, end];
}

/**
 * Offsets of a value made of spans: one range when its pieces follow one
 * another in the page text (only blanks between), else its first piece.
 */
function anchorOf(spans: Span[], pages: PageData[]): { anchor: ValueAnchor; whole: boolean } | null {
  const ranges: { page: number; start: number; end: number }[] = [];
  for (const span of spans) {
    const r = spanRange(span, pages[span.line.page - 1]);
    if (r) ranges.push({ page: span.line.page, start: r[0], end: r[1] });
  }
  if (!ranges.length) return null;
  const first = ranges[0];
  const samePage = ranges.filter((r) => r.page === first.page).sort((a, b) => a.start - b.start);
  const text = pages[first.page - 1].text;
  // Runs of ranges joined by blanks only, in page text order.
  const runs: { start: number; end: number }[] = [];
  for (const r of samePage) {
    const last = runs[runs.length - 1];
    if (last && r.start >= last.end && text.slice(last.end, r.start).trim() === '') last.end = Math.max(last.end, r.end);
    else if (last && r.start < last.end) last.end = Math.max(last.end, r.end);
    else runs.push({ start: r.start, end: r.end });
  }
  const run = runs.find((r) => r.start <= first.start && first.start < r.end) ?? runs[0];
  return {
    anchor: { page: first.page, start: run.start, end: run.end },
    whole: runs.length === 1 && ranges.every((r) => r.page === first.page),
  };
}

// ─── Reading ─────────────────────────────────────────────────

function buildPages(pages: FormPageInput[]): { data: PageData[]; lines: Line[] } {
  const data = pages.map((p) => pdfPageText(p.items) as PageData);
  const lines = data.flatMap((d, i) => pageLines(i + 1, d));
  return { data, lines: withoutRunningLines(lines, pages.map((p) => p.height)) };
}

/** A line of the form in reading order, running headers and page numbers left out. */
export interface FormLine {
  text: string;
  fonts: string[];
  size: number;
  page: number;
}

/** Lines of the pages, as the reader rebuilds them: for drafting a model. */
export function formLines(pages: FormPageInput[]): FormLine[] {
  return buildPages(pages).lines.map((l) => ({ text: l.text, fonts: [...l.fonts].sort(), size: l.size, page: l.page }));
}

/** Whether every signature label of the model is on the first page. */
export function matchesSignature(firstPage: FormPageInput, model: FormModel): boolean {
  const texts = buildPages([firstPage]).lines.map((l) => foldLabel(l.text));
  return model.signature.every((sig) => {
    const s = foldLabel(sig);
    return texts.some((t) => t === s || t.includes(s));
  });
}

const BULLET_LINE = /^[*•\-–]\s*/;
/** Space between two lines, in font sizes, above which they belong to two items. */
const ITEM_GAP = 2;
const MASKED = /^[xX\s.]+$/;
const INLINE = /^(.+?)\s*:\s*(.*)$/;

interface LabelHit {
  label: string;
  field: FormField | null;
  /** Value on the same line, after "Label :". */
  inline: Span | null;
  opensBlock: boolean;
}

/** Labels a line may be, with what each means. */
interface LabelEntry {
  field: FormField | null;
  opensBlock: boolean;
}

function labelIndex(fields: FormField[], startsWith: string[] = []): Map<string, LabelEntry> {
  const index = new Map<string, LabelEntry>();
  // Composed fields and checked options are not printed labels.
  for (const f of fields) if (!f.value && !f.checks) for (const l of f.labels) index.set(foldLabel(l), { field: f, opensBlock: false });
  for (const s of startsWith) {
    if (s === BULLET) continue;
    const key = foldLabel(s);
    index.set(key, { field: index.get(key)?.field ?? null, opensBlock: true });
  }
  return index;
}

function matchLabel(line: Line, index: Map<string, LabelEntry>): LabelHit | null {
  const exact = index.get(foldLabel(line.text));
  if (exact) return { label: line.text, field: exact.field, inline: null, opensBlock: exact.opensBlock };
  // "- Label : value" in a list reads as "Label : value".
  const m = INLINE.exec(line.text.replace(BULLET_LINE, ''));
  if (!m) return null;
  const entry = index.get(foldLabel(m[1]));
  if (!entry) return null;
  const valueAt = line.from + line.text.length - m[2].length;
  return {
    label: m[1].trim(),
    field: entry.field,
    inline: m[2].trim() ? { line, from: valueAt, to: line.to } : null,
    opensBlock: entry.opensBlock,
  };
}

/** "Key : value" pairs of a free text, its parts split by " - ". */
export function keyValuePairs(text: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const part of text.split(/\s+-\s+/)) {
    // A colon with a space on one side at least: "12:30" stays a value.
    const bits = part.split(/\s+:\s*|:\s+/);
    if (bits.length < 2) {
      // A part without a key goes on with the previous value: "6 mm - cuivre".
      const last = out[out.length - 1];
      if (last && part.trim()) last.value = `${last.value} - ${part.trim()}`;
      continue;
    }
    const key = bits[bits.length - 2].trim();
    const value = bits[bits.length - 1].trim();
    if (key && value && key.length <= 40 && /\p{L}/u.test(key)) out.push({ key, value });
  }
  return out;
}

/**
 * Each pair's value looked for in the lines of the block, in reading order:
 * a value found on one line gets its own anchor.
 */
function anchoredPairs(pairs: { key: string; value: string }[], spans: Span[], pages: PageData[]): FreePair[] {
  const ranges = spans
    .map((span) => ({ page: span.line.page, range: spanRange(span, pages[span.line.page - 1]) }))
    .filter((r): r is { page: number; range: [number, number] } => r.range !== null);
  let line = 0;
  let from = ranges[0]?.range[0] ?? 0;
  return pairs.map((pair) => {
    for (let i = line; i < ranges.length; i++) {
      const { page, range } = ranges[i];
      const text = pages[page - 1].text;
      const start = text.slice(0, range[1]).indexOf(pair.value, i === line ? from : range[0]);
      if (start < 0) continue;
      line = i;
      from = start + pair.value.length;
      return { ...pair, anchor: { page, start, end: from } };
    }
    return pair;
  });
}

/** Reads the form; pages in document order, from the first. */
export function readForm(pages: FormPageInput[], model: FormModel): FormReading {
  const read = model.layout === 'positional' ? readPositional : model.layout === 'fields' ? readFields : readByLines;
  const reading = withComposed(read(pages, model), model);
  // A section left empty gives only noes from its empty boxes: no block.
  const said = (v: FormValue) => !(v.field?.type === 'boolean' && /^non$/i.test(v.text.trim()));
  return { ...reading, blocks: reading.blocks.filter((b) => b.values.some(said) || b.free) };
}

/** Composed fields ("{Jour}/{Mois}/{Année}"), anchored on the first value they use. */
function withComposed(reading: FormReading, model: FormModel): FormReading {
  const compose = (fields: FormField[], values: FormValue[]): FormValue[] => {
    const valueOf = (label: string) => values.find((v) => foldLabel(v.label) === foldLabel(label) || v.field?.labels.some((l) => foldLabel(l) === foldLabel(label)))?.text;
    const out: FormValue[] = [];
    for (const f of fields) {
      if (!f.value) continue;
      const text = fillTemplate(f.value, valueOf);
      const used = [...f.value.matchAll(/\{([^}|]+)/g)].map((m) => m[1].trim());
      const first = values.find((v) => used.some((u) => foldLabel(v.label) === foldLabel(u) || v.field?.labels.some((l) => foldLabel(l) === foldLabel(u))));
      if (text.replace(/[\s/.:,-]/g, '') && first) out.push({ label: f.labels[0], field: f, unknown: false, text, anchor: first.anchor, whole: false });
    }
    return out;
  };
  return {
    document: [...reading.document, ...compose(model.documentFields, reading.document)],
    blocks: reading.blocks.map((b) => {
      const def = model.sections.find((s) => s.id === b.sectionId)?.block;
      return def ? { ...b, values: [...b.values, ...compose(def.fields, b.values)] } : b;
    }),
  };
}

function readByLines(pages: FormPageInput[], model: FormModel): FormReading {
  const { data, lines } = buildPages(pages);
  const empty = new Set(model.empty.map(foldLabel));
  const isEmpty = (text: string) => !text.trim() || empty.has(foldLabel(text)) || MASKED.test(text);

  const sectionOf = (line: Line): FormSection | undefined => {
    const t = foldLabel(line.text);
    return model.sections.find((s) => s.titles.some((title) => foldLabel(title) === t));
  };
  const docIndex = labelIndex(model.documentFields);
  const blockIndex = new Map<string, Map<string, LabelEntry>>();
  for (const s of model.sections) if (s.block) blockIndex.set(s.id, labelIndex(s.block.fields, s.block.startsWith));

  // Fonts of known titles, known labels and their values: a line in a label
  // font only is an unknown label, one in a title font only an unknown section.
  // A font counts for what it is used most: a few values written like labels
  // (a code in bold) do not make the labels' font a value font.
  const titleFonts = new Set<string>();
  const asLabel = new Map<string, number>();
  const asValue = new Map<string, number>();
  const bump = (counts: Map<string, number>, fonts: Set<string>) => fonts.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1));
  const allLabels = new Map<string, LabelEntry>([...docIndex, ...[...blockIndex.values()].flatMap((m) => [...m])]);
  lines.forEach((line, i) => {
    if (sectionOf(line)) line.fonts.forEach((f) => titleFonts.add(f));
    else if (matchLabel(line, allLabels)) {
      bump(asLabel, line.fonts);
      const next = lines[i + 1];
      if (next && !sectionOf(next) && !matchLabel(next, allLabels)) bump(asValue, next.fonts);
    }
  });
  const labelFonts = new Set([...asLabel].filter(([f, n]) => n > (asValue.get(f) ?? 0)).map(([f]) => f));
  for (const f of [...titleFonts]) if (labelFonts.has(f) || asValue.has(f)) titleFonts.delete(f);
  const onlyIn = (line: Line, fonts: Set<string>) => line.fonts.size > 0 && [...line.fonts].every((f) => fonts.has(f));

  const reading: FormReading = { document: [], blocks: [] };
  let section: FormSection | null = null;
  let block: FormBlock | null = null;
  let freeSpans: Span[] | null = null;
  let pending: { label: string; field: FormField | null; unknown: boolean; spans: Span[]; doc?: true; listed?: true } | null = null;
  /** In a free section, a label was just read: the next line starts an item. */
  let afterLabel = false;
  const counts = new Map<string, number>();

  const closeValue = () => {
    if (!pending) return;
    const value = pending;
    pending = null;
    const text = value.spans.map((s) => s.line.raw.slice(s.from, s.to).trim()).join(' ').replace(/\s+/g, ' ').trim();
    if (isEmpty(text)) return;
    const at = anchorOf(value.spans, data);
    if (!at) return;
    const out: FormValue = { label: value.label, field: value.field, unknown: value.unknown, text, anchor: at.anchor, whole: at.whole };
    if (block) block.values.push(out);
    else if (value.doc && value.field) reading.document.push(out);
  };
  const docValue = (hit: LabelHit, line: Line) => ({
    label: hit.label,
    field: hit.field,
    unknown: false,
    spans: hit.inline ? [hit.inline] : [],
    doc: true as const,
    ...(BULLET_LINE.test(line.text) ? { listed: true as const } : {}),
  });
  const closeBlock = () => {
    closeValue();
    if (block && freeSpans) {
      const text = freeSpans.map((s) => s.line.raw.slice(s.from, s.to).trim()).join(' ').replace(/\s+/g, ' ').trim();
      const at = anchorOf(freeSpans, data);
      if (at && !isEmpty(text)) block.free = { text, anchor: at.anchor, whole: at.whole, pairs: anchoredPairs(keyValuePairs(text), freeSpans, data) };
    }
    if (block && (block.values.length || block.free)) reading.blocks.push(block);
    block = null;
    freeSpans = null;
  };
  const openBlock = (line: Line) => {
    closeBlock();
    const id = section!.id;
    const index = counts.get(id) ?? 0;
    counts.set(id, index + 1);
    const at = anchorOf([whole(line)], data);
    block = { sectionId: id, index, anchor: at?.anchor ?? { page: line.page, start: 0, end: 0 }, values: [] };
  };

  for (const line of lines) {
    const known = sectionOf(line);
    if (known) {
      closeBlock();
      section = known;
      afterLabel = false;
      // A text section kept whole: its text is a value of the document.
      if (known.textField) pending = { label: known.titles[0], field: known.textField, unknown: false, spans: [], doc: true };
      continue;
    }
    if (onlyIn(line, titleFonts)) {
      closeBlock();
      section = null;
      afterLabel = false;
      continue;
    }
    const def = section?.block;
    if (!def) {
      // Outside blocks: only the document's fields are read.
      const hit = matchLabel(line, docIndex);
      if (hit) {
        closeValue();
        pending = docValue(hit, line);
      } else if (pending && !pending.spans.length) pending.spans.push(whole(line));
      else if (onlyIn(line, labelFonts) || (pending?.listed && BULLET_LINE.test(line.text))) closeValue();
      else if (pending) pending.spans.push(whole(line));
      continue;
    }
    if (def.free || def.startsWith.includes(BULLET)) {
      // A field of the document may sit among the items.
      const hit = matchLabel(line, docIndex);
      if (hit) {
        closeBlock();
        afterLabel = false;
        pending = docValue(hit, line);
        continue;
      }
      if (pending) {
        if (!pending.spans.length) {
          pending.spans.push(whole(line));
          continue;
        }
        if (!onlyIn(line, labelFonts) && !BULLET_LINE.test(line.text)) {
          pending.spans.push(whole(line));
          continue;
        }
        closeValue();
      }
      const bullet = BULLET_LINE.exec(line.text);
      if (bullet) {
        openBlock(line);
        freeSpans = [{ line, from: line.from + bullet[0].length, to: line.to }];
        afterLabel = false;
      } else if (onlyIn(line, labelFonts)) {
        // Items grouped under a label: the label ends the item before.
        closeBlock();
        afterLabel = true;
      } else if (afterLabel) {
        openBlock(line);
        freeSpans = [whole(line)];
        afterLabel = false;
      } else if (freeSpans) {
        // A blank space before the line, wider than a line break: a new item.
        const prev = freeSpans[freeSpans.length - 1].line;
        if (prev.page === line.page && prev.y - line.y > line.size * ITEM_GAP) {
          openBlock(line);
          freeSpans = [whole(line)];
        } else freeSpans.push(whole(line));
      }
      continue;
    }
    const hit = matchLabel(line, blockIndex.get(section!.id)!);
    if (hit) {
      if (hit.opensBlock || !block) openBlock(line);
      else closeValue();
      pending = { label: hit.label, field: hit.field, unknown: false, spans: hit.inline ? [hit.inline] : [] };
      continue;
    }
    // The line after a label is its value, whatever its font.
    if (pending && !pending.spans.length) {
      pending.spans.push(whole(line));
      continue;
    }
    if (onlyIn(line, labelFonts)) {
      closeValue();
      if (block) pending = { label: line.text, field: null, unknown: true, spans: [] };
      continue;
    }
    if (pending) pending.spans.push(whole(line));
  }
  closeBlock();
  return reading;
}

/** Value of a block for a label of the model (element name templates). */
export function blockValue(block: FormBlock, label: string): string | undefined {
  const key = foldLabel(label);
  return block.values.find((v) => foldLabel(v.label) === key || v.field?.labels.some((l) => foldLabel(l) === key))?.text;
}
