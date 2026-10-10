// ─── Text of a PDF page ──────────────────────────────────────
//
// Built like pdf.js' text layer: each item's string, a line break after the
// items that end a line. Offsets into this text (textRange) are shared by the
// reader, the search and passages found without the reader open, so every one
// of them builds it here.

export interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
}

/** Page text, start offset of each kept item, and the kept items. */
export function pdfPageText(items: PdfTextItem[]): { text: string; starts: number[]; kept: PdfTextItem[] } {
  let text = '';
  const starts: number[] = [];
  const kept: PdfTextItem[] = [];
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    starts.push(text.length);
    kept.push(it);
    text += it.str + (it.hasEOL ? '\n' : '');
  }
  return { text, starts, kept };
}
