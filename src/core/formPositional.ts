// ─── Positional forms ────────────────────────────────────────
//
// Forms printed with boxes, the value written in the box and its label
// printed under it (administrative forms filled by software): reading
// order says nothing, positions say everything. Words are grouped into
// phrases; a value is the filled text just above a label, or right of a
// label on its line; a cross in a box checks the option next to it.
// Section bands (large capitals) bound where a label is looked for: the
// same labels repeat from one band to the next.
//
// The reading has the same shape as the line reader's, so the panel,
// validation and anchors work unchanged.

import { foldLabel, type FormField, type FormModel } from './formModel.ts';
import type { FormBlock, FormPageInput, FormReading, FormTextItem, FormValue, ValueAnchor } from './formReader.ts';
import { pdfPageText } from './pageText.ts';

interface Word {
  page: number;
  /** Index among the kept items of the page (offsets in its text). */
  item: number;
  str: string;
  x0: number;
  x1: number;
  y: number;
  size: number;
  font: string;
}

export interface Phrase {
  page: number;
  text: string;
  words: Word[];
  x0: number;
  x1: number;
  y: number;
  size: number;
}

interface PageData {
  text: string;
  starts: number[];
  kept: FormTextItem[];
}

const sizeOf = (t: number[]) => Math.hypot(t[2] ?? 0, t[3] ?? 0) || Math.abs(t[3] ?? 0) || 10;

function pageWords(page: FormPageInput, pageNumber: number): { data: PageData; words: Word[] } {
  const data = pdfPageText(page.items) as PageData;
  const words: Word[] = [];
  data.kept.forEach((it, item) => {
    const str = it.str ?? '';
    if (!str.trim()) return;
    const t = it.transform ?? [1, 0, 0, 1, 0, 0];
    const size = sizeOf(t);
    const x0 = t[4];
    words.push({ page: pageNumber, item, str, x0, x1: x0 + (typeof it.width === 'number' && it.width > 0 ? it.width : str.length * size * 0.5), y: t[5], size, font: it.fontName ?? '' });
  });
  return { data, words };
}

/**
 * Filled text added after the printed form, in fonts the form does not use:
 * the fonts after the first point of the file where no font is shared
 * between what comes before and what comes after.
 */
export function filledFonts(words: Word[]): Set<string> {
  if (words.some((w) => !w.font)) return new Set();
  const ordered = [...words].sort((a, b) => a.page - b.page || a.item - b.item);
  const after = new Map<string, number>();
  for (const w of ordered) after.set(w.font, (after.get(w.font) ?? 0) + 1);
  const before = new Set<string>();
  for (let i = 0; i < ordered.length - 1; i++) {
    const f = ordered[i].font;
    before.add(f);
    after.set(f, after.get(f)! - 1);
    if (after.get(f) === 0) after.delete(f);
    if (i > 0 && [...after.keys()].every((k) => !before.has(k))) return new Set(after.keys());
  }
  return new Set();
}

/** Printed words joined into phrases: same baseline, close together, same size (superscripts kept). */
export function phrasesOf(words: Word[]): Phrase[] {
  const sorted = [...words].sort((a, b) => a.page - b.page || b.y - a.y || a.x0 - b.x0);
  const rows: Word[][] = [];
  for (const w of sorted) {
    const row = rows.find((r) => r[0].page === w.page && Math.abs(r[0].y - w.y) <= Math.max(r[0].size, w.size) * 0.35);
    if (row) row.push(w);
    else rows.push([w]);
  }
  const phrases: Phrase[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x0 - b.x0);
    let cur: Phrase | null = null;
    for (const w of row) {
      const superscript = cur && w.size < cur.size * 0.75 && w.y > cur.y;
      const sameSize = cur && Math.abs(w.size - cur.size) <= cur.size * 0.15;
      const gap = cur ? w.x0 - cur.x1 : Infinity;
      if (cur && (sameSize || superscript) && gap < cur.size * 0.55) {
        cur.text += gap > cur.size * 0.15 && !superscript ? ` ${w.str.trim()}` : w.str.trim();
        cur.words.push(w);
        cur.x1 = Math.max(cur.x1, w.x1);
      } else {
        cur = { page: w.page, text: w.str.trim(), words: [w], x0: w.x0, x1: w.x1, y: w.y, size: w.size };
        phrases.push(cur);
      }
    }
  }
  return phrases;
}

/** Bands opening sections: capitals, clearly larger than the printed text. */
export function bandsOf(phrases: Phrase[]): Phrase[] {
  const sizes = phrases.map((p) => p.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] ?? 0;
  const large = phrases.filter((p) => p.size >= median * 1.25 && /^\p{Lu}[\p{Lu}\s'’\-]{2,}$/u.test(p.text.split(/\s+\(/)[0].trim()) && /\p{L}{3}/u.test(p.text));
  // Bands share one size: the most frequent among large capitals; a larger one is the form's title.
  const count = new Map<number, number>();
  for (const p of large) count.set(Math.round(p.size), (count.get(Math.round(p.size)) ?? 0) + 1);
  const bandSize = [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  return bandSize === undefined ? [] : large.filter((p) => Math.round(p.size) >= bandSize);
}

/** An empty box printed with a symbol font (private use characters) or a box character. */
export const isBox = (w: { str: string }) => /^[\uE000-\uF8FF☐□▢■❑❏]+$/u.test(w.str.trim());

const isCross = (w: Word) => /^[xX✗✘×]$/.test(w.str.trim());
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** Horizontal distance from a span to a phrase (0 when they overlap). */
const dxTo = (x0: number, x1: number, l: Phrase) => Math.max(0, l.x0 - x1, x0 - l.x1);

/**
 * Filled words of one box: words of a line close together; single digits
 * written box by box stay together over the small gaps between boxes.
 */
function unitsOf(words: Word[]): Word[][] {
  const sorted = [...words].sort((a, b) => a.page - b.page || b.y - a.y || a.x0 - b.x0);
  const units: Word[][] = [];
  for (const w of sorted) {
    const u = units[units.length - 1];
    const last = u?.[u.length - 1];
    const sameLine = last && last.page === w.page && Math.abs(last.y - w.y) <= Math.max(last.size, w.size) * 0.35;
    const digits = last && /^\d$/.test(last.str.trim()) && /^\d$/.test(w.str.trim());
    if (sameLine && w.x0 - last.x1 < w.size * (digits ? 2.2 : 0.6)) u.push(w);
    else units.push([w]);
  }
  return units;
}

/** Labels of a unit: the nearest row of phrases under it; split between them for boxed digits. */
function labelUnit(unit: Word[], labels: Phrase[]): { label: Phrase; words: Word[] }[] {
  const x0 = Math.min(...unit.map((w) => w.x0));
  const x1 = Math.max(...unit.map((w) => w.x1));
  const y = unit[0].y;
  const size = Math.max(...unit.map((w) => w.size));
  const below = labels.filter((l) => l.page === unit[0].page && y - l.y >= Math.max(size, l.size) * 0.6 && y - l.y <= Math.max(size, l.size) * 2.6 && dxTo(x0, x1, l) < 40);
  if (below.length) {
    const top = Math.max(...below.map((l) => l.y));
    const row = below.filter((l) => top - l.y <= 2);
    const under = row.filter((l) => dxTo(x0, x1, l) === 0);
    if (under.length > 1 && unit.length > 1) {
      // Day, month and year in a row of boxes: each digit to the label nearest under it.
      const parts = new Map<Phrase, Word[]>();
      for (const w of unit) {
        const c = (w.x0 + w.x1) / 2;
        const l = under.reduce((a, b) => (dxTo(c, c, b) < dxTo(c, c, a) ? b : a));
        parts.set(l, [...(parts.get(l) ?? []), w]);
      }
      return [...parts].map(([label, words]) => ({ label, words }));
    }
    const label = (under.length ? under : row).reduce((a, b) => (dxTo(x0, x1, b) < dxTo(x0, x1, a) ? b : a));
    return [{ label, words: unit }];
  }
  // Left of the value, on its line.
  let best: Phrase | null = null;
  let bestGap = Infinity;
  for (const l of labels) {
    if (l.page !== unit[0].page || Math.abs(l.y - y) > Math.max(size, l.size) * 0.6) continue;
    const gap = x0 - l.x1;
    if (gap >= -1 && gap < 60 && gap < bestGap) [best, bestGap] = [l, gap];
  }
  return best ? [{ label: best, words: unit }] : [];
}

/** The option a cross checks: the printed phrase nearest to the box under it (or to the cross), on its line. */
function optionOf(w: Word, phrases: Phrase[], boxes: Word[]): Phrase | null {
  const box = boxes.find((b) => b.page === w.page && overlap(b.x0, b.x1, w.x0, w.x1) > 0 && Math.abs(b.y - w.y) <= Math.max(b.size, w.size) * 0.8);
  const x0 = box?.x0 ?? w.x0;
  const x1 = box?.x1 ?? w.x1;
  let best: Phrase | null = null;
  let dist = Infinity;
  for (const p of phrases) {
    if (p.page !== w.page || Math.abs(p.y - w.y) > Math.max(w.size, p.size) * 0.6 || /:\s*$/.test(p.text)) continue;
    const d = dxTo(x0, x1, p);
    if (d < dist && d < 40) [best, dist] = [p, d];
  }
  return best;
}

/** Filled words of one value, in reading order: boxes of single characters joined without spaces. */
function valueText(words: Word[]): string {
  const sorted = [...words].sort((a, b) => b.y - a.y || a.x0 - b.x0);
  let text = '';
  let prev: Word | null = null;
  for (const w of sorted) {
    const glued = prev && prev.str.trim().length === 1 && w.str.trim().length === 1 && /\d/.test(prev.str + w.str);
    text += prev && !glued ? ` ${w.str.trim()}` : w.str.trim();
    prev = w;
  }
  return text;
}

/** Eight digits of a date written box by box: dd/mm/yyyy. */
function boxedDate(text: string): string {
  return /^\d{8}$/.test(text) ? `${text.slice(0, 2)}/${text.slice(2, 4)}/${text.slice(4)}` : text;
}

/** Offsets of words in the page text: the run holding the first, joined across blanks. */
function wordsAnchor(words: Word[], data: PageData[]): { anchor: ValueAnchor; whole: boolean } | null {
  if (!words.length) return null;
  const page = words[0].page;
  const d = data[page - 1];
  const ranges = words.filter((w) => w.page === page).map((w) => [d.starts[w.item], d.starts[w.item] + (d.kept[w.item].str ?? '').length] as [number, number]).sort((a, b) => a[0] - b[0]);
  const runs: [number, number][] = [];
  for (const r of ranges) {
    const last = runs[runs.length - 1];
    if (last && r[0] >= last[1] && d.text.slice(last[1], r[0]).trim() === '') last[1] = Math.max(last[1], r[1]);
    else if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1]);
    else runs.push([...r]);
  }
  const first = words[0];
  const at = d.starts[first.item];
  const run = runs.find((r) => r[0] <= at && at < r[1]) ?? runs[0];
  return { anchor: { page, start: run[0], end: run[1] }, whole: runs.length === 1 && words.every((w) => w.page === page) };
}

export interface PositionalPage {
  data: PageData[];
  printed: Phrase[];
  filled: Word[];
  boxes: Word[];
}

/** Printed phrases and filled words of the pages. */
export function positionalLayout(pages: FormPageInput[]): PositionalPage {
  const parts = pages.map((p, i) => pageWords(p, i + 1));
  const words = parts.flatMap((p) => p.words);
  const fonts = filledFonts(words);
  const printedWords = words.filter((w) => !fonts.has(w.font));
  return {
    data: parts.map((p) => p.data),
    printed: phrasesOf(printedWords.filter((w) => !isBox(w))),
    filled: words.filter((w) => fonts.has(w.font)),
    boxes: printedWords.filter(isBox),
  };
}

/** Section of a position: the last band above it. */
function sectionAt(page: number, y: number, bands: { page: number; y: number; id: string }[]): string | null {
  let id: string | null = null;
  for (const b of bands) if (b.page < page || (b.page === page && b.y > y)) id = b.id;
  return id;
}

export interface PositionalValue {
  label: Phrase;
  section: string | null;
  words: Word[];
  /** The label as the model names it: "#2" for a label printed twice in the section. */
  name: string;
}

/** Every filled value with its label (or checked option), by section. */
export function positionalValues(layout: PositionalPage, bands: { page: number; y: number; id: string }[]): { values: PositionalValue[]; checked: PositionalValue[] } {
  const bandYs = new Set(bands.map((b) => `${b.page}:${b.y}`));
  const labels = layout.printed.filter((p) => !bandYs.has(`${p.page}:${p.y}`));
  const byLabel = new Map<Phrase, Word[]>();
  const checked: PositionalValue[] = [];
  for (const w of layout.filled) {
    if (!isCross(w)) continue;
    const option = optionOf(w, labels, layout.boxes);
    if (option) checked.push({ label: option, section: sectionAt(w.page, w.y, bands), words: [w], name: option.text });
  }
  for (const unit of unitsOf(layout.filled.filter((w) => !isCross(w)))) {
    for (const { label, words } of labelUnit(unit, labels)) byLabel.set(label, [...(byLabel.get(label) ?? []), ...words]);
  }
  const values = [...byLabel].map(([label, words]) => ({ label, section: sectionAt(label.page, label.y, bands), words, name: label.text }));
  // A label printed twice in a section: the second is "Commune #2".
  const seen = new Map<string, Phrase[]>();
  for (const l of [...labels].sort((a, b) => a.page - b.page || b.y - a.y || a.x0 - b.x0)) {
    const key = `${sectionAt(l.page, l.y, bands)}|${foldLabel(l.text)}`;
    seen.set(key, [...(seen.get(key) ?? []), l]);
  }
  for (const v of values) {
    const same = seen.get(`${v.section}|${foldLabel(v.label.text)}`) ?? [];
    const n = same.indexOf(v.label);
    if (n > 0) v.name = `${v.label.text} #${n + 1}`;
  }
  return { values, checked };
}

/** Reads a positional form with its model: one block per section band. */
export function readPositional(pages: FormPageInput[], model: FormModel): FormReading {
  const layout = positionalLayout(pages);
  // A title is looked for among the bands (large capitals): the same word in the
  // text ("Véhicule" next to a box) is not a band. Else anywhere.
  const large = bandsOf(layout.printed);
  const titled = (p: Phrase) => model.sections.find((s) => s.titles.some((t) => foldLabel(t) === foldLabel(p.text)));
  const found = new Set(large.map(titled).filter(Boolean));
  const bands = layout.printed
    .filter((p) => large.includes(p) || (titled(p) && !found.has(titled(p))))
    .map((p) => ({ p, s: titled(p) }))
    .filter((x): x is { p: Phrase; s: NonNullable<typeof x.s> } => !!x.s)
    .map(({ p, s }) => ({ page: p.page, y: p.y, id: s.id }));
  const { values, checked } = positionalValues(layout, bands);
  const empty = new Set(model.empty.map(foldLabel));
  const reading: FormReading = { document: [], blocks: [] };
  const blocks = new Map<string, FormBlock>();

  const fieldsOf = (sectionId: string | null): FormField[] => {
    const s = sectionId ? model.sections.find((x) => x.id === sectionId) : undefined;
    return s?.block && !s.block.free ? s.block.fields : model.documentFields;
  };
  const push = (sectionId: string | null, v: FormValue) => {
    const s = sectionId ? model.sections.find((x) => x.id === sectionId) : undefined;
    if (!s?.block) {
      if (v.field) reading.document.push(v);
      return;
    }
    let b = blocks.get(s.id);
    if (!b) {
      b = { sectionId: s.id, index: 0, anchor: v.anchor, values: [] };
      blocks.set(s.id, b);
    }
    b.values.push(v);
  };

  const matching = (fields: FormField[], label: string) => fields.find((f) => f.labels.some((l) => foldLabel(l) === foldLabel(label)));
  for (const v of values) {
    const field = matching(fieldsOf(v.section), v.name);
    if (!field) continue;
    let text = valueText(v.words);
    if (!text || empty.has(foldLabel(text)) || /^[xX\s.]+$/.test(text)) continue;
    if (field.type === 'date') text = boxedDate(text);
    const at = wordsAnchor(v.words, layout.data);
    if (at) push(v.section, { label: v.name, field, unknown: false, text, anchor: at.anchor, whole: at.whole });
  }
  // Checked options: one value per field marked "checks" in the section.
  const bySection = new Map<string | null, PositionalValue[]>();
  for (const c of checked) bySection.set(c.section, [...(bySection.get(c.section) ?? []), c]);
  for (const [sectionId, list] of bySection) {
    const field = fieldsOf(sectionId).find((f) => f.checks);
    if (!field) continue;
    const sorted = list.sort((a, b) => b.label.y - a.label.y || a.label.x0 - b.label.x0);
    const at = wordsAnchor(sorted.flatMap((c) => c.words), layout.data);
    if (at) push(sectionId, { label: field.labels[0], field, unknown: false, text: sorted.map((c) => c.label.text).join(', '), anchor: at.anchor, whole: false });
  }
  // Printed boxes as yes or no: the option next to each box, crossed or not.
  const bandYs = new Set(bands.map((b) => `${b.page}:${b.y}`));
  const options = new Map<Phrase, string | null>();
  for (const box of layout.boxes) {
    const option = optionOf(box, layout.printed.filter((p) => !bandYs.has(`${p.page}:${p.y}`)), []);
    if (option && !options.has(option)) options.set(option, sectionAt(box.page, box.y, bands));
  }
  const crossed = new Set(checked.map((c) => c.label));
  for (const [option, sectionId] of options) {
    const field = fieldsOf(sectionId).find((f) => f.type === 'boolean' && f.labels.some((l) => foldLabel(l) === foldLabel(option.text)));
    const at = field ? wordsAnchor(option.words, layout.data) : null;
    if (field && at) push(sectionId, { label: option.text, field, unknown: false, text: crossed.has(option) ? 'Oui' : 'Non', anchor: at.anchor, whole: at.whole });
  }
  // Blocks in the order of the model.
  for (const s of model.sections) {
    const b = blocks.get(s.id);
    if (b) reading.blocks.push(b);
  }
  return reading;
}

// ─── Fields of a PDF form ────────────────────────────────────
//
// A form with fields keeps its values outside the page text. Each field
// has a name, stable from one copy to the next: the model names fields,
// the printed label next to a field (left on its line, else above) gives
// the property its name and the passage its anchor. Sections are the
// numbered headings ("1.2. Coordonnées du demandeur").

/** "Case #C3#A0 cocher" > "Case à cocher": names keep the PDF escapes of their bytes. */
export function fieldName(name: string): string {
  if (!/#[0-9A-Fa-f]{2}/.test(name)) return name;
  const bytes: number[] = [];
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '#' && /^[0-9A-Fa-f]{2}$/.test(name.slice(i + 1, i + 3))) {
      bytes.push(parseInt(name.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...new TextEncoder().encode(name[i]));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export interface PlacedWidget extends Omit<import('./formReader.ts').FormWidget, 'rect'> {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FieldsLayout {
  data: PageData[];
  phrases: Phrase[];
  widgets: PlacedWidget[];
  headings: { page: number; y: number; title: string; number: string }[];
}

/**
 * Numbered headings of the first level: "1." then its title on the same
 * line ("1.1." and "1.2." stay inside; footnotes and list items have no dot).
 */
function headingsOf(phrases: Phrase[]): FieldsLayout['headings'] {
  const out: FieldsLayout['headings'] = [];
  for (const p of phrases) {
    // Number and title in one phrase: "1. Demandeur".
    const joined = /^(\d+\.)\s+(\p{L}.*)$/u.exec(p.text);
    if (joined) {
      out.push({ page: p.page, y: p.y, title: joined[2].replace(/\s*:\s*$/, ''), number: joined[1] });
      continue;
    }
    if (!/^\d+\.$/.test(p.text)) continue;
    const title = phrases.find((o) => o.page === p.page && o !== p && Math.abs(o.y - p.y) <= Math.max(o.size, p.size) * 0.4 && o.x0 >= p.x1 - 1 && o.x0 - p.x1 < 20);
    if (title && /\p{L}{3}/u.test(title.text)) out.push({ page: p.page, y: p.y, title: title.text.replace(/\s*:\s*$/, ''), number: p.text });
  }
  return out;
}

export function fieldsLayout(pages: FormPageInput[]): FieldsLayout {
  const parts = pages.map((p, i) => pageWords(p, i + 1));
  const phrases = phrasesOf(parts.flatMap((p) => p.words).filter((w) => !isBox(w)));
  const widgets = pages.flatMap((p, i) =>
    (p.widgets ?? []).map((w) => ({ ...w, page: i + 1, x0: Math.min(w.rect[0], w.rect[2]), y0: Math.min(w.rect[1], w.rect[3]), x1: Math.max(w.rect[0], w.rect[2]), y1: Math.max(w.rect[1], w.rect[3]) })),
  );
  return { data: parts.map((p) => p.data), phrases, widgets, headings: headingsOf(phrases) };
}

/** Whether a widget holds something: text typed, or its box checked. */
export const isFilled = (w: PlacedWidget) => (w.kind === 'text' ? !!w.value.trim() : !!w.on);

/** Names given to more than one box with different values: a choice between options. */
export function choiceGroups(widgets: PlacedWidget[]): Set<string> {
  const values = new Map<string, Set<string>>();
  for (const w of widgets) if (w.kind === 'check') values.set(w.name, (values.get(w.name) ?? new Set()).add(w.value));
  return new Set([...values].filter(([, v]) => v.size > 1).map(([k]) => k));
}

const onRow = (w: PlacedWidget, p: Phrase) => p.page === w.page && p.y >= w.y0 - 3 && p.y <= w.y1 + 1;

/**
 * Printed label of a field: left of it on its line, else above it. In a
 * table (several text fields side by side), the row's heading with the
 * column's heading: "Surfaces totales · Existantes".
 */
export function widgetLabel(w: PlacedWidget, phrases: Phrase[], widgets: PlacedWidget[] = []): { phrase: Phrase; text: string } | null {
  const clean = (s: string) => s.replace(/\s*:\s*$/, '').trim();
  const lettered = phrases.filter((p) => /\p{L}/u.test(p.text));
  let left: Phrase | null = null;
  for (const p of lettered) if (onRow(w, p) && p.x1 <= w.x0 + 2 && (!left || p.x1 > left.x1)) left = p;
  // A table cell: a field next to it on its row with no printed label in between.
  const between = (a: PlacedWidget, b: PlacedWidget) => {
    const [l, r] = a.x0 < b.x0 ? [a, b] : [b, a];
    return phrases.some((p) => onRow(w, p) && p.x0 >= l.x1 - 2 && p.x1 <= r.x0 + 2);
  };
  const inTable = widgets.some((o) => o !== w && o.kind === 'text' && o.page === w.page && Math.abs(o.y0 - w.y0) < 2 && Math.abs(o.x0 - w.x0) < 150 && !between(o, w));
  const column = lettered
    .filter((p) => p.page === w.page && p.y > w.y1 && p.y - w.y1 < (inTable ? 200 : 22) && overlap(p.x0, p.x1, w.x0, w.x1) > 0)
    .sort((a, b) => a.y - b.y)[0];
  if (inTable && left && column) return { phrase: left, text: `${clean(left.text)} · ${clean(column.text)}` };
  if (left && w.x0 - left.x1 < 80) return { phrase: left, text: clean(left.text) };
  if (column) return { phrase: column, text: clean(column.text) };
  return left ? { phrase: left, text: clean(left.text) } : null;
}

/** A phrase ending with a colon asks a question: it is never an option. */
const asks = (p: Phrase) => /:\s*$/.test(p.text);

/** The option a box stands for: the printed phrase nearest to it on its line. */
export function widgetOption(w: PlacedWidget, phrases: Phrase[]): Phrase | null {
  let best: Phrase | null = null;
  let dist = Infinity;
  for (const p of phrases) {
    if (!onRow(w, p) || asks(p)) continue;
    const d = dxTo(w.x0, w.x1, p);
    if (d < dist && d < 60) [best, dist] = [p, d];
  }
  return best;
}

/** Section of a widget: the numbered heading above it. */
export function widgetSection(w: PlacedWidget, headings: { page: number; y: number }[]): number {
  let at = -1;
  headings.forEach((h, i) => {
    if (h.page < w.page || (h.page === w.page && h.y > w.y1)) at = i;
  });
  return at;
}

/** Reads the fields of a PDF form with its model: one block per section. */
export function readFields(pages: FormPageInput[], model: FormModel): FormReading {
  const layout = fieldsLayout(pages);
  const groups = choiceGroups(layout.widgets);
  const empty = new Set(model.empty.map(foldLabel));
  const reading: FormReading = { document: [], blocks: [] };
  const blocks = new Map<string, FormBlock>();
  // Every field naming the widget: a box may be both a yes or no and one of the checked options.
  const owners = (name: string): { field: FormField; sectionId: string | null }[] => [
    ...model.sections.flatMap((s) => (s.block?.fields ?? []).filter((x) => x.labels.includes(name)).map((field) => ({ field, sectionId: s.id }))),
    ...model.documentFields.filter((x) => x.labels.includes(name)).map((field) => ({ field, sectionId: null })),
  ];
  const push = (sectionId: string | null, v: FormValue) => {
    if (!sectionId) {
      reading.document.push(v);
      return;
    }
    let b = blocks.get(sectionId);
    if (!b) blocks.set(sectionId, (b = { sectionId, index: 0, anchor: v.anchor, values: [] }));
    b.values.push(v);
  };
  const anchorOn = (p: Phrase | null) => (p ? wordsAnchor(p.words, layout.data) : null);

  const checked = new Map<FormField, { sectionId: string | null; options: Phrase[] }>();
  for (const w of layout.widgets) for (const { field, sectionId } of owners(w.name)) {
    // A box as a yes or no: checked or not, both are answers.
    if (w.kind === 'check' && field.type === 'boolean' && !groups.has(w.name)) {
      const at = anchorOn(widgetOption(w, layout.phrases));
      if (at) push(sectionId, { label: w.name, field, unknown: false, text: isFilled(w) ? 'Oui' : 'Non', anchor: at.anchor, whole: at.whole });
      continue;
    }
    if (!isFilled(w)) continue;
    if (w.kind === 'check') {
      const option = widgetOption(w, layout.phrases);
      if (!option) continue;
      if (field.checks) {
        const c = checked.get(field) ?? { sectionId, options: [] };
        c.options.push(option);
        checked.set(field, c);
        continue;
      }
      if (!groups.has(w.name)) continue;
      const at = anchorOn(option);
      if (at) push(sectionId, { label: w.name, field, unknown: false, text: option.text.replace(/\s*:\s*$/, ''), anchor: at.anchor, whole: at.whole });
      continue;
    }
    const text = w.value.replace(/\s+/g, ' ').trim();
    if (empty.has(foldLabel(text))) continue;
    const at = anchorOn(widgetLabel(w, layout.phrases, layout.widgets)?.phrase ?? null);
    if (at) push(sectionId, { label: w.name, field, unknown: false, text, anchor: at.anchor, whole: false });
  }
  for (const [field, { sectionId, options }] of checked) {
    const at = anchorOn(options[0]);
    if (at) push(sectionId, { label: field.labels[0], field, unknown: false, text: options.map((o) => o.text.replace(/\s*:\s*$/, '')).join(', '), anchor: at.anchor, whole: false });
  }
  for (const s of model.sections) {
    const b = blocks.get(s.id);
    if (b) reading.blocks.push(b);
  }
  return reading;
}

/** Fields of a PDF form from pdf.js annotations of a page (widgets only). */
export function widgetsOf(annotations: unknown[]): import('./formReader.ts').FormWidget[] {
  const out: import('./formReader.ts').FormWidget[] = [];
  for (const raw of annotations) {
    const a = raw as Record<string, unknown>;
    if (a.subtype !== 'Widget' || typeof a.fieldName !== 'string' || !Array.isArray(a.rect)) continue;
    const rect = (a.rect as number[]).slice(0, 4) as [number, number, number, number];
    const value = a.fieldValue;
    if (a.checkBox || a.radioButton) {
      const own = String((a.checkBox ? a.exportValue : a.buttonValue) ?? '');
      const on = typeof value === 'string' && value !== 'Off' && value !== '' && (!own || value === own);
      out.push({ name: a.fieldName, kind: 'check', value: own, on, rect });
    } else if (a.fieldType === 'Tx' || a.fieldType === 'Ch') {
      out.push({ name: a.fieldName, kind: 'text', value: Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '', rect });
    }
  }
  return out;
}
