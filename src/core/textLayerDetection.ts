// Decides whether a PDF carries a usable text layer or needs OCR.
// Scanned reports often contain a few characters (a stamp, a page number
// added by the scanner) on otherwise image-only pages, hence the threshold.

/** Below this many non-blank characters, a page is treated as image-only. */
export const MIN_CHARS_PER_PAGE = 50;

export interface TextLayerReport {
  /** Pages (1-based) whose text layer is too thin to rely on. */
  imagePages: number[];
  /** true when no page has a usable text layer. */
  imageOnly: boolean;
}

export function analyseTextLayer(charsPerPage: number[]): TextLayerReport {
  const imagePages: number[] = [];
  charsPerPage.forEach((chars, i) => {
    if (chars < MIN_CHARS_PER_PAGE) imagePages.push(i + 1);
  });
  return { imagePages, imageOnly: charsPerPage.length > 0 && imagePages.length === charsPerPage.length };
}

/** Non-blank characters of a pdf.js text content, ignoring marked-content items. */
export function countTextChars(items: ReadonlyArray<{ str?: string }>): number {
  let n = 0;
  for (const item of items) {
    if (typeof item.str === 'string') n += item.str.replace(/\s/g, '').length;
  }
  return n;
}
