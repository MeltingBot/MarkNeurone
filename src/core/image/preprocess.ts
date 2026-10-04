// Image preprocessing for OCR on scanned or photocopied pages.
// Pure functions on 8-bit grayscale buffers, usable in Node (bench) and in a Web Worker.

export interface GrayImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface PreprocessOptions {
  deskew: boolean;
  denoise: boolean;
  binarize: boolean;
  /** Sauvola window size in pixels (odd). About 1/100 of the page width at 300 dpi works well. */
  sauvolaWindow: number;
  sauvolaK: number;
  /** Maximum skew searched, in degrees, on each side. */
  maxSkewDeg: number;
  /** Drop coloured ink (stamps) by keeping the lightest channel, see rgbaToGray. */
  dropColor?: boolean;
}

export const DEFAULT_PREPROCESS: PreprocessOptions = {
  deskew: true,
  denoise: true,
  binarize: true,
  sauvolaWindow: 31,
  sauvolaK: 0.2,
  maxSkewDeg: 5,
};

export interface PreprocessResult {
  image: GrayImage;
  skewDeg: number;
}

/**
 * Grey levels of an RGBA image. 'luma' is the usual brightness; 'max' keeps
 * the lightest channel, so that coloured ink (a red or blue stamp) turns
 * almost white while black text stays black.
 */
export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number, mode: 'luma' | 'max' = 'luma'): GrayImage {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; j < data.length; i += 4, j++) {
    // ITU-R BT.601 luma; transparent pixels are treated as white paper.
    const a = rgba[i + 3] / 255;
    const y = mode === 'max'
      ? Math.max(rgba[i], rgba[i + 1], rgba[i + 2])
      : 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    data[j] = y * a + 255 * (1 - a);
  }
  return { data, width, height };
}

export function grayToRgba(img: GrayImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.width * img.height * 4);
  for (let j = 0, i = 0; j < img.data.length; j++, i += 4) {
    const v = img.data[j];
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

/** 3x3 median filter, removes salt-and-pepper noise from photocopies. Borders are copied. */
export function median3(img: GrayImage): GrayImage {
  const { data, width: w, height: h } = img;
  const out = new Uint8ClampedArray(data);
  const v = new Uint8Array(9);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const row = (y + dy) * w + x;
        v[k++] = data[row - 1];
        v[k++] = data[row];
        v[k++] = data[row + 1];
      }
      v.sort();
      out[y * w + x] = v[4];
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Sauvola adaptive thresholding using integral images, O(1) per pixel.
 * Output is 0 (ink) or 255 (paper).
 */
export function sauvola(img: GrayImage, window: number, k: number, r = 128): GrayImage {
  const { data, width: w, height: h } = img;
  const stride = w + 1;
  const sum = new Float64Array(stride * (h + 1));
  const sq = new Float64Array(stride * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    let rowSq = 0;
    for (let x = 1; x <= w; x++) {
      const p = data[(y - 1) * w + (x - 1)];
      rowSum += p;
      rowSq += p * p;
      sum[y * stride + x] = sum[(y - 1) * stride + x] + rowSum;
      sq[y * stride + x] = sq[(y - 1) * stride + x] + rowSq;
    }
  }
  const half = window >> 1;
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w, x + half + 1);
      const n = (y1 - y0) * (x1 - x0);
      const s = sum[y1 * stride + x1] - sum[y0 * stride + x1] - sum[y1 * stride + x0] + sum[y0 * stride + x0];
      const s2 = sq[y1 * stride + x1] - sq[y0 * stride + x1] - sq[y1 * stride + x0] + sq[y0 * stride + x0];
      const mean = s / n;
      const std = Math.sqrt(Math.max(0, s2 / n - mean * mean));
      const threshold = mean * (1 + k * (std / r - 1));
      out[y * w + x] = data[y * w + x] > threshold ? 255 : 0;
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Estimates page skew with a projection profile: text lines produce the sharpest
 * row histogram when the page is level. Works on a downsampled copy for speed.
 * Returns the angle in degrees to rotate the image by to level it.
 */
export function estimateSkew(img: GrayImage, maxDeg: number, stepDeg = 0.2): number {
  const factor = Math.max(1, Math.floor(img.width / 800));
  const w = Math.floor(img.width / factor);
  const h = Math.floor(img.height / factor);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (img.data[y * factor * img.width + x * factor] < 128) {
        xs.push(x - w / 2);
        ys.push(y - h / 2);
      }
    }
  }
  if (xs.length < 50) return 0;
  const bins = h * 2;
  const hist = new Float64Array(bins);
  let best = 0;
  let bestScore = -1;
  for (let deg = -maxDeg; deg <= maxDeg + 1e-9; deg += stepDeg) {
    const t = (deg * Math.PI) / 180;
    const sin = Math.sin(t);
    const cos = Math.cos(t);
    hist.fill(0);
    for (let i = 0; i < xs.length; i++) {
      const yr = Math.round(xs[i] * sin + ys[i] * cos + h);
      if (yr >= 0 && yr < bins) hist[yr]++;
    }
    let score = 0;
    for (let i = 1; i < bins; i++) {
      const d = hist[i] - hist[i - 1];
      score += d * d;
    }
    if (score > bestScore) {
      bestScore = score;
      best = deg;
    }
  }
  // The profile is sharpest after rotating the points by `best` in the y-down frame,
  // which is what `rotate` does with the opposite angle.
  return Math.round(-best * 100) / 100 || 0;
}

/** Rotates around the centre with bilinear sampling; uncovered areas become white. */
export function rotate(img: GrayImage, deg: number): GrayImage {
  if (deg === 0) return img;
  const { data, width: w, height: h } = img;
  const t = (deg * Math.PI) / 180;
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  const cx = w / 2;
  const cy = h / 2;
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Inverse mapping: for each destination pixel, find its source.
      const dx = x - cx;
      const dy = y - cy;
      const sx = dx * cos - dy * sin + cx;
      const sy = dx * sin + dy * cos + cy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) {
        out[y * w + x] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const i = y0 * w + x0;
      const top = data[i] * (1 - fx) + data[i + 1] * fx;
      const bottom = data[i + w] * (1 - fx) + data[i + w + 1] * fx;
      out[y * w + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return { data: out, width: w, height: h };
}

export function preprocess(img: GrayImage, options: PreprocessOptions = DEFAULT_PREPROCESS): PreprocessResult {
  let current = img;
  let skewDeg = 0;
  if (options.denoise) current = median3(current);
  if (options.deskew) {
    // Skew is estimated on a binarized copy so that grey backgrounds do not dominate.
    const probe = sauvola(current, options.sauvolaWindow, options.sauvolaK);
    skewDeg = estimateSkew(probe, options.maxSkewDeg);
    if (skewDeg !== 0) current = rotate(current, skewDeg);
  }
  if (options.binarize) current = sauvola(current, options.sauvolaWindow, options.sauvolaK);
  return { image: current, skewDeg };
}
