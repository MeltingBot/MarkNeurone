// ─── Text layer fonts ────────────────────────────────────────
//
// pdf.js lays its invisible text over the page with a generic family
// ("serif", "sans-serif", "monospace") and stretches each line to its width.
// When the generic family is far from the PDF font (Firefox on Linux maps
// "serif" to Noto Serif, much wider than Times), letters drift inside the
// line: the selection takes characters that are not under the pointer.
// A family with the same metrics as the PDF font keeps them in place.

const TIMES = '"Times New Roman", Tinos, "Liberation Serif", "Nimbus Roman", Times, serif';
const ARIAL = 'Arial, Helvetica, Arimo, "Liberation Sans", "Nimbus Sans", sans-serif';
const COURIER = '"Courier New", Cousine, "Liberation Mono", "Nimbus Mono PS", Courier, monospace';

/** PDF font names (subset prefix removed, lower case, no spaces) and the matching family. */
const BY_NAME: [RegExp, string][] = [
  [/calibri|carlito/, 'Calibri, Carlito, ' + ARIAL],
  [/cambria|caladea/, 'Cambria, Caladea, ' + TIMES],
  [/couriernew|courier|cousine|liberationmono|nimbusmono/, COURIER],
  [/times|tinos|liberationserif|nimbusrom/, TIMES],
  [/arial|helvetica|arimo|liberationsans|nimbussans/, ARIAL],
];

const BY_GENERIC: Record<string, string> = { serif: TIMES, 'sans-serif': ARIAL, monospace: COURIER };

/**
 * CSS family for the text layer of a PDF font: from its name when known,
 * otherwise from pdf.js' generic family. Unknown generic families are kept.
 */
export function textLayerFamily(pdfFontName: string | undefined, generic: string): string {
  const name = (pdfFontName ?? '').replace(/^[A-Z]{6}\+/, '').toLowerCase().replace(/[\s_-]/g, '');
  for (const [pattern, family] of BY_NAME) if (pattern.test(name)) return family;
  return BY_GENERIC[generic] ?? generic;
}

/**
 * Replaces the generic family of each text style. `fontName` gives the PDF
 * font name of a style key, when pdf.js has loaded it.
 */
export function fitTextStyles(styles: Record<string, { fontFamily: string }>, fontName: (key: string) => string | undefined): void {
  for (const [key, style] of Object.entries(styles)) style.fontFamily = textLayerFamily(fontName(key), style.fontFamily);
}
