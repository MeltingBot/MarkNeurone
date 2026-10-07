// Reference of a document, as the analyst cites it (e.g. "PV n° 00347/2026,
// pièce n° 2"), written instead of the file name in the source of the
// objects created from it.

/** Longest reference kept. */
export const MAX_REFERENCE = 120;

/**
 * The reference is the label of the anchor links in `source` fields, which
 * the plugin reads back: line breaks and " ; " separate sources and brackets
 * delimit the link, so none may appear.
 */
export function cleanReference(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\s+/g, ' ')
    .replace(/;/g, ',')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .trim()
    .slice(0, MAX_REFERENCE)
    .trim();
}

const PV_TITLE = /PROC[ÈE]S[\s-]*VERBAL/i;
// Digits first (00347/2026), or the Belgian form with its arrondissement code (BR.12.L1.012345/2024).
const NUMBER = /N\s*[°º]\s*:?\s*(\d[\dA-Za-z/.-]*\d|\d|[A-Z]{2}\.[\dA-Za-z/.-]*\d)/;
const ITEM = /Pi[èe]ce\s*n\s*[°º]\s*:?\s*(\d+)/i;

/**
 * Reference read in the header of a report's first page, as a proposal only:
 * "PV n° <number>", followed by ", pièce n° <n>" when given. Null when the
 * page is not a report or gives no number.
 */
export function detectReference(firstPageText: string): string | null {
  const text = firstPageText.replace(/\s+/g, ' ');
  const title = text.search(PV_TITLE);
  if (title < 0) return null;
  // The number follows the title in the header box, not further down the page.
  const header = text.slice(title, title + 200);
  const number = header.match(NUMBER)?.[1];
  if (!number) return null;
  const item = header.match(ITEM)?.[1];
  return cleanReference(item ? `PV n° ${number}, pièce n° ${item}` : `PV n° ${number}`);
}
