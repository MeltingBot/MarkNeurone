// OCR results as stored with the dossier, and the page text they produce.
//
// Boxes are kept in page units at scale 1 (pdf.js viewport, top-left
// origin), so that they follow any zoom like the PDF itself.

export type Box = [number, number, number, number];

export interface OcrWord {
  /** Recognized text. */
  t: string;
  /** Word confidence, 0 to 100. */
  c: number;
  b: Box;
  /** Confidence of each character, when available. */
  s?: number[];
}

export interface OcrLine {
  w: OcrWord[];
}

export interface OcrPage {
  lines: OcrLine[];
  /** Mean word confidence of the page. */
  confidence: number;
  /** Skew corrected before recognition, in degrees. */
  skew: number;
  /** ISO date of the recognition. */
  at: string;
}

export interface OcrDocument {
  version: 1;
  model: string;
  pages: Record<string, OcrPage>;
}

/** Raw shapes from Tesseract (blocks > paragraphs > lines > words). */
export interface RawWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  symbols?: { confidence: number }[];
}
export interface RawLine {
  words: RawWord[];
}

/**
 * Point of the rotated (deskewed) image back to the original image. Mirrors
 * `rotate` in core/image/preprocess.ts, which samples the source at
 * (dx·cos − dy·sin + cx, dx·sin + dy·cos + cy).
 */
export function unrotatePoint(x: number, y: number, width: number, height: number, deg: number): [number, number] {
  if (!deg) return [x, y];
  const t = (deg * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const dx = x - cx;
  const dy = y - cy;
  return [dx * Math.cos(t) - dy * Math.sin(t) + cx, dx * Math.sin(t) + dy * Math.cos(t) + cy];
}

export function unrotateBox(box: Box, width: number, height: number, deg: number): Box {
  if (!deg) return box;
  const corners = [
    unrotatePoint(box[0], box[1], width, height, deg),
    unrotatePoint(box[2], box[1], width, height, deg),
    unrotatePoint(box[0], box[3], width, height, deg),
    unrotatePoint(box[2], box[3], width, height, deg),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Tesseract lines to a stored page: boxes back from the deskewed image to
 * the page at scale 1, empty words and lines dropped.
 */
export function buildOcrPage(
  lines: RawLine[],
  image: { width: number; height: number; scale: number; skew: number },
  at = new Date().toISOString(),
): OcrPage {
  const out: OcrLine[] = [];
  let sum = 0;
  let count = 0;
  for (const line of lines) {
    const words: OcrWord[] = [];
    for (const w of line.words) {
      const text = w.text.trim();
      if (!text) continue;
      const b = unrotateBox([w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1], image.width, image.height, image.skew);
      words.push({
        t: text,
        c: Math.round(w.confidence),
        b: [round(b[0] / image.scale), round(b[1] / image.scale), round(b[2] / image.scale), round(b[3] / image.scale)],
        ...(w.symbols?.length ? { s: w.symbols.map((s) => Math.round(s.confidence)) } : {}),
      });
      sum += w.confidence;
      count++;
    }
    if (words.length) out.push({ w: words });
  }
  return { lines: out, confidence: count ? Math.round(sum / count) : 0, skew: image.skew, at };
}

export interface OcrPageText {
  /** Words joined by spaces, each line ended by "\n": the text of the OCR layer. */
  text: string;
  /** Offset of each word in `text`, in reading order. */
  starts: number[];
  /** Top of each word, page units at scale 1. */
  ys: number[];
}

export function ocrPageText(page: OcrPage): OcrPageText {
  let text = '';
  const starts: number[] = [];
  const ys: number[] = [];
  for (const line of page.lines) {
    line.w.forEach((word, i) => {
      starts.push(text.length);
      ys.push(word.b[1]);
      text += word.t + (i < line.w.length - 1 ? ' ' : '');
    });
    text += '\n';
  }
  return { text, starts, ys };
}

/** Mean confidence of the words overlapping [start, end) of the page text. */
export function rangeConfidence(page: OcrPage, start: number, end: number): number | null {
  const { starts } = ocrPageText(page);
  const words = page.lines.flatMap((l) => l.w);
  let sum = 0;
  let count = 0;
  words.forEach((w, i) => {
    const from = starts[i];
    const to = from + w.t.length;
    if (from < end && to > start) {
      sum += w.c;
      count++;
    }
  });
  return count ? Math.round(sum / count) : null;
}
