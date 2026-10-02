// ─── OCR text layer ──────────────────────────────────────────
//
// Invisible, selectable text built from the word boxes of a scanned page,
// with the same structure as pdf.js' text layer (spans, <br> at line ends).
// Its text is exactly ocrPageText(page).text, so that selection offsets,
// search and anchors work as on a text PDF.

import type { OcrPage } from '../core/ocrLayout.ts';

let measure: CanvasRenderingContext2D | null = null;

function textWidth(text: string, fontSize: number): number {
  if (!measure) measure = document.createElement('canvas').getContext('2d');
  if (!measure) return text.length * fontSize * 0.5;
  measure.font = `${fontSize}px sans-serif`;
  return measure.measureText(text).width || 1;
}

export function renderOcrLayer(container: HTMLElement, page: OcrPage, scale: number): void {
  const fragment = document.createDocumentFragment();
  for (const line of page.lines) {
    line.w.forEach((word, i) => {
      const [x0, y0, x1, y1] = word.b;
      const width = (x1 - x0) * scale;
      const height = (y1 - y0) * scale;
      const fontSize = Math.max(1, height * 0.9);
      const span = document.createElement('span');
      span.textContent = word.t + (i < line.w.length - 1 ? ' ' : '');
      span.dataset.c = String(word.c);
      span.style.left = `${x0 * scale}px`;
      span.style.top = `${y0 * scale}px`;
      span.style.fontSize = `${fontSize}px`;
      span.style.fontFamily = 'sans-serif';
      span.style.lineHeight = '1';
      span.style.transform = `scaleX(${width / textWidth(word.t, fontSize)})`;
      fragment.appendChild(span);
    });
    fragment.appendChild(document.createElement('br'));
  }
  container.replaceChildren(fragment);
  container.dataset.ocr = '1';
}
