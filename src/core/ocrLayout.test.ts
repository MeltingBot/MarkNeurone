import { describe, expect, it } from 'vitest';
import { buildOcrPage, ocrPageText, rangeConfidence, unrotateBox, unrotatePoint, type RawLine } from './ocrLayout.ts';
import { rotate, type GrayImage } from './image/preprocess.ts';

describe('unrotatePoint', () => {
  it('is the identity without skew', () => {
    expect(unrotatePoint(10, 20, 100, 100, 0)).toEqual([10, 20]);
  });

  it('finds where a dark pixel of the deskewed image came from', () => {
    // A single ink pixel, rotated with the same function the OCR pipeline uses.
    const w = 200;
    const h = 120;
    const data = new Uint8ClampedArray(w * h).fill(255);
    data[30 * w + 150] = 0;
    const src: GrayImage = { data, width: w, height: h };
    const rotated = rotate(src, 3);
    let best = [0, 0];
    let darkest = 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rotated.data[y * w + x] < darkest) { darkest = rotated.data[y * w + x]; best = [x, y]; }
    const [ox, oy] = unrotatePoint(best[0], best[1], w, h, 3);
    expect(Math.abs(ox - 150)).toBeLessThan(1.5);
    expect(Math.abs(oy - 30)).toBeLessThan(1.5);
  });
});

describe('unrotateBox', () => {
  it('grows to contain the rotated corners', () => {
    const b = unrotateBox([40, 40, 60, 50], 100, 100, 5);
    expect((b[2] - b[0]) * (b[3] - b[1])).toBeGreaterThan(20 * 10);
  });
});

const lines: RawLine[] = [
  { words: [
    { text: 'Se', confidence: 95, bbox: { x0: 100, y0: 200, x1: 140, y1: 240 } },
    { text: 'présente', confidence: 91, bbox: { x0: 160, y0: 200, x1: 340, y1: 240 }, symbols: [{ confidence: 90 }, { confidence: 40 }] },
  ] },
  { words: [{ text: '  ', confidence: 10, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }] },
  { words: [{ text: 'DELARZE,', confidence: 62, bbox: { x0: 100, y0: 260, x1: 300, y1: 300 } }] },
];

describe('buildOcrPage', () => {
  const page = buildOcrPage(lines, { width: 2480, height: 3508, scale: 4, skew: 0 }, 'T');

  it('scales boxes to page units and drops empty words and lines', () => {
    expect(page.lines).toHaveLength(2);
    expect(page.lines[0].w[0].b).toEqual([25, 50, 35, 60]);
  });

  it('keeps word and character confidences', () => {
    expect(page.lines[0].w[1].s).toEqual([90, 40]);
    expect(page.confidence).toBe(Math.round((95 + 91 + 62) / 3));
  });
});

describe('ocrPageText', () => {
  const page = buildOcrPage(lines, { width: 2480, height: 3508, scale: 4, skew: 0 });

  it('joins words with spaces and ends each line with a line break', () => {
    const { text, starts } = ocrPageText(page);
    expect(text).toBe('Se présente\nDELARZE,\n');
    expect(starts).toEqual([0, 3, 12]);
  });

  it('gives the confidence of a passage', () => {
    expect(rangeConfidence(page, 12, 19)).toBe(62);
    expect(rangeConfidence(page, 0, 11)).toBe(93);
  });
});
