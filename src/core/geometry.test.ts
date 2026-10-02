import { describe, expect, it } from 'vitest';
import {
  applyTransform,
  invertTransform,
  linkArc,
  mergeLineRects,
  pdfQuadToViewport,
  quadArea,
  quadContains,
  rectFromPoints,
  scaleTransform,
  viewportRectToPdf,
  type Transform,
} from './geometry.ts';

describe('mergeLineRects', () => {
  it('merges the word boxes of one line', () => {
    const merged = mergeLineRects([
      { left: 10, top: 100, right: 40, bottom: 112 },
      { left: 44, top: 101, right: 80, bottom: 112 },
      { left: 30, top: 100, right: 50, bottom: 111 },
    ]);
    expect(merged).toEqual([{ left: 10, top: 100, right: 80, bottom: 112 }]);
  });

  it('keeps separate lines apart', () => {
    const merged = mergeLineRects([
      { left: 300, top: 100, right: 500, bottom: 112 },
      { left: 60, top: 118, right: 200, bottom: 130 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].top).toBe(100);
  });

  it('drops empty rectangles', () => {
    expect(mergeLineRects([{ left: 5, top: 5, right: 5, bottom: 20 }])).toEqual([]);
  });
});

describe('rectFromPoints', () => {
  it('orders corners', () => {
    expect(rectFromPoints(10, 50, 2, 20)).toEqual({ left: 2, top: 20, right: 10, bottom: 50 });
  });
});

describe('PDF / viewport conversion', () => {
  // pdf.js transform of an A4 page at scale 1, no rotation: y axis flipped.
  const A4: Transform = [1, 0, 0, -1, 0, 842];

  it('converts a viewport rectangle to PDF space and back', () => {
    const rect = { left: 70, top: 100, right: 300, bottom: 112 };
    const quad = viewportRectToPdf(rect, A4);
    expect(quad).toEqual([70, 730, 300, 742]);
    expect(pdfQuadToViewport(quad, A4)).toEqual(rect);
  });

  it('follows the zoom', () => {
    const quad = viewportRectToPdf({ left: 70, top: 100, right: 300, bottom: 112 }, A4);
    expect(pdfQuadToViewport(quad, scaleTransform(A4, 2))).toEqual({ left: 140, top: 200, right: 600, bottom: 224 });
  });

  it('handles a rotated page', () => {
    // 90° rotation as produced by pdf.js for a portrait page.
    const rotated: Transform = [0, 1, 1, 0, 0, 0];
    const rect = { left: 10, top: 20, right: 30, bottom: 60 };
    expect(pdfQuadToViewport(viewportRectToPdf(rect, rotated), rotated)).toEqual(rect);
  });

  it('inverts a transform', () => {
    const t: Transform = [2, 0, 0, -2, 5, 900];
    const [x, y] = applyTransform(t, 12, 34);
    expect(applyTransform(invertTransform(t), x, y)).toEqual([12, 34]);
  });
});

describe('quadContains', () => {
  it('accepts points inside or within tolerance', () => {
    const quad: [number, number, number, number] = [70, 730, 300, 742];
    expect(quadContains(quad, 100, 735)).toBe(true);
    expect(quadContains(quad, 69.5, 735)).toBe(true);
    expect(quadContains(quad, 60, 735)).toBe(false);
    expect(quadArea(quad)).toBe(230 * 12);
  });
});

describe('linkArc', () => {
  it('rises above both highlights and ends on the target', () => {
    const arc = linkArc({ left: 10, top: 100, right: 50, bottom: 112 }, { left: 210, top: 100, right: 250, bottom: 112 });
    // Start at the top centre of the source, end at the top centre of the target.
    expect(arc.d.startsWith('M 30 100 C 30 66')).toBe(true);
    expect(arc.d.endsWith('230 100')).toBe(true);
    expect(arc.head).toContain('L 230 100');
  });

  it('caps the height for far-apart ends', () => {
    const arc = linkArc({ left: 0, top: 500, right: 20, bottom: 510 }, { left: 800, top: 100, right: 820, bottom: 110 });
    const top = parseFloat(arc.d.split(' ')[5]);
    expect(top).toBe(100 - 48);
  });
});
