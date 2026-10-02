// Sentence lookup with Intl.Segmenter (no dependency).

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

const segmenter = new Intl.Segmenter('fr', { granularity: 'sentence' });

/**
 * Text layers break lines with "\n"; a sentence must not stop there.
 * Same length as the input, so offsets stay valid.
 */
function flattenLines(text: string): string {
  return text.replace(/\n/g, ' ');
}

// Segments ending with a French abbreviation or an initial do not end a
// sentence: "M. Duval", "Me Lefort", "J. Martin", "art. 222-33".
const ABBREVIATION_END =
  /(?:^|[\s(])(?:M|MM|Mme|Mmes|Mlle|Mlles|Me|Mes|Dr|Pr|St|Ste|Cie|Cdt|Lt|Gal|art|cf|av|bd|n°|No|[A-ZÀ-Ý])\.\s*$/;

function sentences(flat: string): Sentence[] {
  const out: Sentence[] = [];
  let pending: Sentence | null = null;
  for (const seg of segmenter.segment(flat)) {
    const current: Sentence = pending
      ? { text: pending.text + seg.segment, start: pending.start, end: seg.index + seg.segment.length }
      : { text: seg.segment, start: seg.index, end: seg.index + seg.segment.length };
    if (ABBREVIATION_END.test(current.text)) {
      pending = current;
    } else {
      out.push(current);
      pending = null;
    }
  }
  if (pending) out.push(pending);
  return out;
}

/** Sentences overlapping [start, end), joined; whitespace normalized. */
export function sentenceAt(text: string, start: number, end: number): Sentence | null {
  const flat = flattenLines(text);
  let from = -1;
  let to = -1;
  for (const seg of sentences(flat)) {
    if (seg.end <= start || seg.start >= Math.max(end, start + 1)) continue;
    if (from < 0) from = seg.start;
    to = seg.end;
  }
  if (from < 0) return null;
  return { text: flat.slice(from, to).replace(/\s+/g, ' ').trim(), start: from, end: to };
}

/** Collapses whitespace and line breaks of a selection. */
export function cleanSelection(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Drops punctuation that a mouse selection tends to catch at word edges,
 * for pre-filled labels and values. The annotation keeps the exact text.
 */
export function trimPunctuation(text: string): string {
  return text.replace(/^[\s"'«»“”‘’(\[,;:.!?-]+/u, '').replace(/[\s"'«»“”‘’)\],;:.!?-]+$/u, '');
}

/**
 * Text between two passages of the same sentence, as offsets in the page
 * text, trimmed of spaces and edge punctuation. Null when the passages are
 * in different sentences or touch each other.
 */
export function betweenRange(text: string, a: [number, number], b: [number, number]): [number, number] | null {
  const [first, second] = a[0] <= b[0] ? [a, b] : [b, a];
  const sentence = sentenceAt(text, first[0], first[1]);
  if (!sentence || second[0] >= sentence.end || second[0] < first[1]) return null;
  let start = first[1];
  let end = second[0];
  const edge = /[\s"'«»“”‘’,;:.()]/u;
  while (start < end && edge.test(text[start])) start++;
  while (end > start && edge.test(text[end - 1])) end--;
  return end > start ? [start, end] : null;
}
