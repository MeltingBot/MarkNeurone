// Full-document search, insensitive to case, accents and line breaks.

export interface SearchHit {
  /** 1-based page number. */
  page: number;
  /** Offsets in the page text (same text as the rendered text layer). */
  start: number;
  end: number;
}

interface Normalized {
  text: string;
  /** Original offset of each normalized character. */
  map: number[];
}

/**
 * Lower case, accents removed, any run of whitespace as one space. Keeps a
 * map back to the original offsets so that hits point into the page text.
 */
export function normalizeForSearch(text: string): Normalized {
  let out = '';
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!lastWasSpace && out.length) {
        out += ' ';
        map.push(i);
      }
      lastWasSpace = true;
      continue;
    }
    lastWasSpace = false;
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    for (const b of base) {
      out += b;
      map.push(i);
    }
  }
  return { text: out, map };
}

/** Every occurrence of the query, page by page, in reading order. */
export function findInPages(pages: string[], query: string): SearchHit[] {
  const needle = normalizeForSearch(query).text.trim();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  pages.forEach((pageText, i) => {
    const { text, map } = normalizeForSearch(pageText);
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
      const last = at + needle.length - 1;
      hits.push({ page: i + 1, start: map[at], end: map[last] + 1 });
    }
  });
  return hits;
}
