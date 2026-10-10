// ─── Locating a passage in page texts ────────────────────────
//
// Another plugin (OneNeurone) names what it extracted; the passage is found
// here, without AI and without the reader: a quotation when one is given,
// otherwise the name for an element, the sentence holding both names for a
// link, the sentence holding the name and the date for an event. Nothing
// found: null, and the source stays at document level.

import { findInPages, type SearchHit } from './search.ts';
import { sentenceRanges } from './sentences.ts';
import { findDates } from './dates.ts';

export interface LocateRequest {
  kind: 'element' | 'event' | 'link';
  /** Name of the element, of the event's element, or of the link's first end. */
  text: string;
  /** Link: name of the other end. */
  otherName?: string;
  /** Event: date as extracted (ISO, time optional). */
  date?: string;
  /** Exact quotation from the document, when the extractor gives one. */
  context?: string;
  /** Extraction started from the reader: only this part of the document. */
  hint?: { page: number; start: number; end: number };
}

export interface Located {
  /** 1-based. */
  page: number;
  start: number;
  end: number;
}

const LETTER = /[\p{L}\p{N}]/u;

/** A hit that is a whole word: "Paul" is not found in "Paulette". */
function wholeWord(pages: string[], h: SearchHit): boolean {
  const text = pages[h.page - 1];
  return !LETTER.test(text[h.start - 1] ?? '') && !LETTER.test(text[h.end] ?? '');
}

function inside(hint: LocateRequest['hint'], page: number, start: number, end: number): boolean {
  return !hint || (page === hint.page && start >= hint.start && end <= hint.end);
}

function words(pages: string[], query: string, hint: LocateRequest['hint']): SearchHit[] {
  return findInPages(pages, query).filter((h) => wholeWord(pages, h) && inside(hint, h.page, h.start, h.end));
}

/** Sentences of the document, in reading order, within the hint. */
function sentencesOf(pages: string[], hint: LocateRequest['hint']): Located[] {
  const out: Located[] = [];
  pages.forEach((text, i) => {
    for (const [start, end] of sentenceRanges(text)) {
      // A sentence that overlaps the hint counts, cut to it.
      if (hint && (i + 1 !== hint.page || end <= hint.start || start >= hint.end)) continue;
      let from = hint ? Math.max(start, hint.start) : start;
      let to = hint ? Math.min(end, hint.end) : end;
      // Without the blanks around it: the passage is the sentence itself.
      while (from < to && /\s/.test(text[from])) from++;
      while (to > from && /\s/.test(text[to - 1])) to--;
      if (to > from) out.push({ page: i + 1, start: from, end: to });
    }
  });
  return out;
}

function sentenceHas(pages: string[], s: Located, name: string): boolean {
  return words([pages[s.page - 1].slice(s.start, s.end)], name, undefined).length > 0;
}

/** Calendar day of a date match, as YYYY-MM-DD. */
function day(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sentenceHasDate(pages: string[], s: Located, iso: string): boolean {
  const wanted = iso.slice(0, 10);
  const year = Number(wanted.slice(0, 4)) || undefined;
  return findDates(pages[s.page - 1].slice(s.start, s.end), year).some((m) => day(m.date) === wanted);
}

export function locatePassage(pages: string[], req: LocateRequest): Located | null {
  const name = req.text.trim();
  if (!name || !pages.length) return null;

  // A quotation: the name inside it, or the quotation itself.
  if (req.context?.trim()) {
    for (const q of findInPages(pages, req.context).filter((h) => inside(req.hint, h.page, h.start, h.end))) {
      const inQuote = words([pages[q.page - 1].slice(q.start, q.end)], name, undefined)[0];
      if (req.kind === 'element' && inQuote) return { page: q.page, start: q.start + inQuote.start, end: q.start + inQuote.end };
      return { page: q.page, start: q.start, end: q.end };
    }
  }

  if (req.kind === 'element') {
    const hit = words(pages, name, req.hint)[0];
    return hit ? { page: hit.page, start: hit.start, end: hit.end } : null;
  }

  const sentences = sentencesOf(pages, req.hint);
  if (req.kind === 'link') {
    const other = req.otherName?.trim();
    if (!other) return null;
    return sentences.find((s) => sentenceHas(pages, s, name) && sentenceHas(pages, s, other)) ?? null;
  }

  // Event: the name and the date in one sentence; else the date alone, only
  // when a single sentence bears it (a wrong passage would mislead).
  if (!req.date) return null;
  const dated = sentences.filter((s) => sentenceHasDate(pages, s, req.date!));
  return dated.find((s) => sentenceHas(pages, s, name)) ?? (dated.length === 1 ? dated[0] : null);
}
