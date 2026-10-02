// Simulated scan degradations applied to a rendered page.

import { createCanvas, type Canvas } from '@napi-rs/canvas';
import type { Rng } from './fiction.ts';

export type Degradation = 'skew' | 'noise' | 'photocopy' | 'stamp';

function rotateCanvas(src: Canvas, deg: number): Canvas {
  const out = createCanvas(src.width, src.height);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

function stamp(canvas: Canvas, rng: Rng): void {
  const ctx = canvas.getContext('2d');
  const r = canvas.width * 0.09;
  const cx = canvas.width * (0.55 + rng() * 0.25);
  const cy = canvas.height * (0.15 + rng() * 0.3);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = rng() < 0.5 ? '#2a3fb0' : '#b02a2a';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.translate(cx, cy);
  ctx.rotate(-0.3 + rng() * 0.6);
  ctx.font = `bold ${Math.round(r * 0.22)}px "DejaVu Sans"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BRIGADE FICTIVE', 0, 0);
  ctx.restore();
}

/** Contrast loss, grey uneven background, toner speckles and a light blur. */
function photocopy(canvas: Canvas, rng: Rng): void {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width: w, height: h } = img;
  const gx = rng() < 0.5 ? 1 : -1;
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Ink fades a little, paper turns grey with a lateral gradient (lid shadow).
      v = 55 + v * 0.7;
      v -= 45 * ((gx > 0 ? x : w - x) / w) ** 3;
      gray[y * w + x] = v;
    }
  }
  // 3x3 box blur.
  const blurred = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += gray[(y + dy) * w + x + dx];
      blurred[y * w + x] = s / 9;
    }
  }
  for (let j = 0; j < w * h; j++) {
    let v = blurred[j] || gray[j];
    if (rng() < 0.0015) v = 30; // toner speckle
    const i = j * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, v));
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Gaussian-like noise plus salt and pepper. */
function noise(canvas: Canvas, rng: Rng): void {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() + rng() + rng() - 1.5) * 40;
    let v = data[i] + n;
    const sp = rng();
    if (sp < 0.002) v = 0;
    else if (sp > 0.998) v = 255;
    v = Math.max(0, Math.min(255, v));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

export function degrade(canvas: Canvas, kinds: Degradation[], rng: Rng): { canvas: Canvas; skewDeg: number } {
  let current = canvas;
  let skewDeg = 0;
  if (kinds.includes('stamp')) stamp(current, rng);
  if (kinds.includes('photocopy')) photocopy(current, rng);
  if (kinds.includes('skew')) {
    skewDeg = Math.round((1 + rng() * 3) * (rng() < 0.5 ? -1 : 1) * 10) / 10;
    current = rotateCanvas(current, skewDeg);
  }
  if (kinds.includes('noise')) noise(current, rng);
  return { canvas: current, skewDeg };
}
