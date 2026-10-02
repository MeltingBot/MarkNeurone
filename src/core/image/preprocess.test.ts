import { describe, expect, it } from 'vitest';
import { estimateSkew, median3, rotate, sauvola, type GrayImage } from './preprocess.ts';

/** White page with dark horizontal "text lines". */
function linedPage(w = 800, h = 600): GrayImage {
  const data = new Uint8ClampedArray(w * h).fill(240);
  for (let y = 40; y < h - 40; y += 24) {
    for (let t = 0; t < 6; t++) {
      for (let x = 60; x < w - 60; x++) {
        // Dashed strokes, closer to words than to solid rules.
        if ((x >> 4) % 3 !== 0) data[(y + t) * w + x] = 20;
      }
    }
  }
  return { data, width: w, height: h };
}

describe('estimateSkew', () => {
  it('returns about zero for a level page', () => {
    expect(Math.abs(estimateSkew(linedPage(), 5))).toBeLessThanOrEqual(0.2);
  });

  it('finds the angle that levels a rotated page', () => {
    for (const angle of [3, -2]) {
      const tilted = rotate(linedPage(), angle);
      const correction = estimateSkew(tilted, 5);
      expect(correction).toBeCloseTo(-angle, 0);
    }
  });
});

describe('sauvola', () => {
  it('separates ink from a grey background', () => {
    const page = linedPage();
    // Darken the right half of the paper, as a photocopy shadow would.
    for (let y = 0; y < page.height; y++) {
      for (let x = page.width / 2; x < page.width; x++) {
        const i = y * page.width + x;
        page.data[i] = Math.max(0, page.data[i] - 90);
      }
    }
    const bin = sauvola(page, 31, 0.2);
    expect(bin.data[10 * page.width + 700]).toBe(255); // shaded paper stays white
    expect(bin.data[41 * page.width + 700]).toBe(0); // ink stays black
  });
});

describe('median3', () => {
  it('removes isolated noise pixels', () => {
    const page = linedPage();
    const i = 300 * page.width + 30;
    page.data[i] = 0;
    expect(median3(page).data[i]).toBe(240);
  });
});
