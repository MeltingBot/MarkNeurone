// ─── Selection capture ───────────────────────────────────────
//
// Turns the browser selection over a page's text layer into a passage:
// page number, one rectangle per line in PDF space, text offsets in the
// page text and the sentence around it.

import type { AnnotationOrigin, Quad } from '../core/model.ts';
import type { SuggestionKind } from '../core/suggestions.ts';
import type { PreviewLines } from '../core/ocrLayout.ts';
import {
  applyTransform,
  invertTransform,
  mergeLineRects,
  quadArea,
  quadContains,
  viewportRectToPdf,
  type Rect,
  type Transform,
} from '../core/geometry.ts';
import { cleanSelection, sentenceAt } from '../core/sentences.ts';
import { findDates } from '../core/dates.ts';

export interface PageInfo {
  width: number;
  height: number;
  /** pdf.js viewport transform at scale 1. */
  transform: Transform;
}

export interface Passage {
  page: number;
  quads: Quad[];
  text: string;
  /** Offsets in the page text; absent for an OCR zone outside the recognized text. */
  textRange?: [number, number];
  context?: string;
  sentenceRange?: [number, number];
  /** Year of the first complete date of the page, for dates written without year. */
  referenceYear?: number;
  /** Set on scanned pages: what the OCR read, and how sure it was. */
  ocr?: { rawText: string; confidence: number };
  /** Scanned page: image of the passage and words as read, to check and correct the reading. */
  preview?: { image: string; lines: PreviewLines; framed?: boolean };
  /** Set when the passage comes from a pre-highlighting suggestion. */
  origin?: AnnotationOrigin;
  suggestion?: { kind: SuggestionKind; checksumOk?: boolean; suspect?: boolean; elementIds?: string[] };
  /** Bounding box of the selection in client coordinates, to place the form. */
  clientBox: { left: number; top: number; right: number; bottom: number };
}

export type CaptureResult = { passage: Passage } | { error: 'multipage' } | null;

/**
 * Length of the text before (node, offset) inside root. <br> counts as one
 * character ("\n"), as in pageText, so offsets and page text agree.
 */
function textLength(root: Node): number {
  let n = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) n += (node.nodeValue ?? '').length;
    else if ((node as Element).tagName === 'BR') n += 1;
  }
  return n;
}

function offsetIn(textLayer: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(textLayer, 0);
  range.setEnd(node, offset);
  return textLength(range.cloneContents());
}

/** Full text of a rendered page, lines separated by "\n". */
export function pageText(textLayer: HTMLElement): string {
  let text = '';
  const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue ?? '';
    else if ((node as Element).tagName === 'BR') text += '\n';
  }
  return text;
}

function pageOf(node: Node | null): HTMLElement | null {
  const el = node instanceof Element ? node : node?.parentElement;
  return (el?.closest('.mn-page') as HTMLElement | null) ?? null;
}

/** Passage for a DOM range already known to lie in one rendered page. */
function buildPassage(pageEl: HTMLElement, textLayer: HTMLElement, range: Range, start: number, end: number, info: PageInfo, scale: number): Passage | null {
  const fullText = pageText(textLayer);
  const text = cleanSelection(fullText.slice(start, end));
  if (!text) return null;

  // Client rectangles, relative to the text layer (inside the page border)
  // and brought back to scale 1.
  const origin = textLayer.getBoundingClientRect();
  const lines = mergeLineRects(
    [...range.getClientRects()].map((r) => ({
      left: (r.left - origin.left) / scale,
      top: (r.top - origin.top) / scale,
      right: (r.right - origin.left) / scale,
      bottom: (r.bottom - origin.top) / scale,
    })),
  );
  const quads = lines.map((line: Rect) => viewportRectToPdf(line, info.transform) as Quad);
  const box = range.getBoundingClientRect();
  const sentence = sentenceAt(fullText, start, end);
  const referenceYear = findDates(fullText).find((d) => d.hasYear)?.date.getFullYear();

  return {
    page: Number(pageEl.dataset.pageNumber),
    quads,
    text,
    textRange: [start, end],
    ...(sentence ? { context: sentence.text, sentenceRange: [sentence.start, sentence.end] as [number, number] } : {}),
    ...(referenceYear ? { referenceYear } : {}),
    clientBox: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
  };
}

export function capturePassage(selection: Selection | null, pages: PageInfo[], scale: number): CaptureResult {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const startPage = pageOf(range.startContainer);
  const endPage = pageOf(range.endContainer);
  if (!startPage || !endPage) return null;
  if (startPage !== endPage) return { error: 'multipage' };

  const info = pages[Number(startPage.dataset.pageNumber) - 1];
  const textLayer = startPage.querySelector('.textLayer') as HTMLElement | null;
  if (!info || !textLayer) return null;

  const start = offsetIn(textLayer, range.startContainer, range.startOffset);
  const end = offsetIn(textLayer, range.endContainer, range.endOffset);
  const passage = buildPassage(startPage, textLayer, range, start, end, info, scale);
  return passage ? { passage } : null;
}

/** DOM position of a character offset, counting <br> as one character like pageText. */
function positionAt(textLayer: HTMLElement, offset: number): [Node, number] {
  let n = 0;
  const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.nodeValue ?? '').length;
      if (offset <= n + len) return [node, offset - n];
      n += len;
    } else if ((node as Element).tagName === 'BR') {
      n += 1;
    }
  }
  return [textLayer, textLayer.childNodes.length];
}

/** Passage for character offsets of a rendered page (e.g. the words between two highlights). */
export function passageFromOffsets(root: HTMLElement, page: number, start: number, end: number, pages: PageInfo[], scale: number): Passage | null {
  const pageEl = root.querySelector(`.mn-page[data-page-number="${page}"]`) as HTMLElement | null;
  const textLayer = pageEl?.querySelector('.textLayer') as HTMLElement | null;
  const info = pages[page - 1];
  if (!pageEl || !textLayer || !info) return null;
  const range = document.createRange();
  range.setStart(...positionAt(textLayer, start));
  range.setEnd(...positionAt(textLayer, end));
  return buildPassage(pageEl, textLayer, range, start, end, info, scale);
}

/** Annotation under a click, smallest first when highlights overlap. */
export function annotationAt<A extends { id: string; page: number; quads: Quad[] }>(
  target: EventTarget | null,
  clientX: number,
  clientY: number,
  pages: PageInfo[],
  scale: number,
  annotations: A[],
): A | null {
  const pageEl = target instanceof Element ? (target.closest('.mn-page') as HTMLElement | null) : null;
  const textLayer = pageEl?.querySelector('.textLayer') as HTMLElement | null;
  if (!pageEl || !textLayer) return null;
  const page = Number(pageEl.dataset.pageNumber);
  const info = pages[page - 1];
  if (!info) return null;
  const origin = textLayer.getBoundingClientRect();
  const [x, y] = applyTransform(invertTransform(info.transform), (clientX - origin.left) / scale, (clientY - origin.top) / scale);
  let best: A | null = null;
  let bestArea = Infinity;
  for (const a of annotations) {
    if (a.page !== page) continue;
    for (const q of a.quads) {
      if (quadContains(q, x, y) && quadArea(q) < bestArea) {
        best = a;
        bestArea = quadArea(q);
      }
    }
  }
  return best;
}

/**
 * Line boxes of [start, end) in a rendered text layer, in CSS pixels relative
 * to the layer (current zoom). Used to frame search results.
 */
export function rangeBoxes(textLayer: HTMLElement, start: number, end: number): Rect[] {
  const range = document.createRange();
  range.setStart(...positionAt(textLayer, start));
  range.setEnd(...positionAt(textLayer, end));
  const origin = textLayer.getBoundingClientRect();
  return mergeLineRects(
    [...range.getClientRects()].map((r) => ({
      left: r.left - origin.left,
      top: r.top - origin.top,
      right: r.right - origin.left,
      bottom: r.bottom - origin.top,
    })),
  );
}
