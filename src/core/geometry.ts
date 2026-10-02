// Selection rectangles to highlight boxes.
//
// Range.getClientRects() returns one rectangle per text node, often
// overlapping (pdf.js spans) or split around spaces. A highlight is easier
// to read and lighter to store as one box per line.

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Merges rectangles that share a line (vertical overlap above `ratio` of the smaller height). */
export function mergeLineRects(rects: Rect[], ratio = 0.5): Rect[] {
  const valid = rects.filter((r) => r.right - r.left > 0.5 && r.bottom - r.top > 0.5);
  const sorted = [...valid].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: Rect[] = [];
  for (const r of sorted) {
    const line = lines.find((l) => {
      const overlap = Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top);
      const smaller = Math.min(l.bottom - l.top, r.bottom - r.top);
      return overlap > smaller * ratio;
    });
    if (line) {
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
    } else {
      lines.push({ ...r });
    }
  }
  return lines.sort((a, b) => a.top - b.top || a.left - b.left);
}

/** Normalizes two corner points into a rectangle. */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
}

/** Affine transform [a, b, c, d, e, f], as in pdf.js viewports and the canvas API. */
export type Transform = [number, number, number, number, number, number];

export function applyTransform(t: Transform, x: number, y: number): [number, number] {
  return [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]];
}

export function invertTransform(t: Transform): Transform {
  const det = t[0] * t[3] - t[1] * t[2];
  return [
    t[3] / det,
    -t[1] / det,
    -t[2] / det,
    t[0] / det,
    (t[2] * t[5] - t[3] * t[4]) / det,
    (t[1] * t[4] - t[0] * t[5]) / det,
  ];
}

/** Same transform at another zoom: pdf.js viewports scale linearly. */
export function scaleTransform(t: Transform, scale: number): Transform {
  return t.map((v) => v * scale) as Transform;
}

/**
 * Viewport rectangle (CSS pixels at scale 1, top-left origin) to PDF user
 * space [x1, y1, x2, y2] with x1 <= x2 and y1 <= y2.
 */
export function viewportRectToPdf(rect: Rect, viewportTransform: Transform): [number, number, number, number] {
  const inv = invertTransform(viewportTransform);
  const [x1, y1] = applyTransform(inv, rect.left, rect.top);
  const [x2, y2] = applyTransform(inv, rect.right, rect.bottom);
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}

/** PDF user space quad to a viewport rectangle, for a transform at the wanted scale. */
export function pdfQuadToViewport(quad: [number, number, number, number], viewportTransform: Transform): Rect {
  const [x1, y1] = applyTransform(viewportTransform, quad[0], quad[1]);
  const [x2, y2] = applyTransform(viewportTransform, quad[2], quad[3]);
  return rectFromPoints(x1, y1, x2, y2);
}

/** Whether a PDF-space point falls inside a quad, with a tolerance in PDF units. */
export function quadContains(quad: [number, number, number, number], x: number, y: number, tolerance = 1): boolean {
  return x >= quad[0] - tolerance && x <= quad[2] + tolerance && y >= quad[1] - tolerance && y <= quad[3] + tolerance;
}

export function quadArea(quad: [number, number, number, number]): number {
  return (quad[2] - quad[0]) * (quad[3] - quad[1]);
}

export interface Arc {
  /** SVG path of the curve. */
  d: string;
  /** SVG path of the arrow head at the end. */
  head: string;
}

/**
 * Dotted-link curve drawn above the text, from the top of one highlight to
 * the top of another, higher when the ends are far apart. Viewport units.
 */
export function linkArc(from: Rect, to: Rect): Arc {
  const x1 = (from.left + from.right) / 2;
  const y1 = from.top;
  const x2 = (to.left + to.right) / 2;
  const y2 = to.top;
  const rise = Math.min(48, Math.max(10, 10 + Math.abs(x2 - x1) * 0.12 + Math.abs(y2 - y1) * 0.3));
  const top = Math.min(y1, y2) - rise;
  const r = (n: number) => Math.round(n * 10) / 10;
  // The curve ends going straight down into the target: the head points down.
  const size = 4;
  return {
    d: `M ${r(x1)} ${r(y1)} C ${r(x1)} ${r(top)}, ${r(x2)} ${r(top)}, ${r(x2)} ${r(y2)}`,
    head: `M ${r(x2 - size)} ${r(y2 - size * 1.4)} L ${r(x2)} ${r(y2)} L ${r(x2 + size)} ${r(y2 - size * 1.4)}`,
  };
}
