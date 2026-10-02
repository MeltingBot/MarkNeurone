// Generates a corpus of fictional reports: one PDF with a text layer and image-only
// PDFs with simulated scan degradations, plus the ground truth used by run.ts.
//
// Usage: tsx gen/generate.ts [--out out/corpus] [--seed 42] [--docs 2] [--pages 2] [--stress]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createCanvas, PDFDocument, type SKRSContext2D } from '@napi-rs/canvas';
import { buildReport, mulberry32, type PageTruth } from './fiction.ts';
import { degrade, type Degradation } from './degrade.ts';

const A4_PT = { w: 595.28, h: 841.89 };
const DPI = 300;
const SCALE = DPI / 72;

// PDFDocument.beginPage is typed with the DOM context but returns a Skia context.
const pdfPage = (doc: PDFDocument) => doc.beginPage(A4_PT.w, A4_PT.h) as unknown as SKRSContext2D;

const VARIANTS: Record<string, Degradation[]> = {
  propre: [],
  biais: ['skew'],
  bruit: ['noise'],
  photocopie: ['photocopy'],
  tampon: ['stamp'],
};

// All degradations at once, close to fax quality: outside the target, kept as a stress test.
const STRESS_VARIANTS: Record<string, Degradation[]> = {
  cumul: ['stamp', 'photocopy', 'skew', 'noise'],
};

const FONTS = ['"Courier New"', '"Liberation Serif"', '"DejaVu Sans Mono"'];

/** Lays out paragraphs in points; returns the lines actually drawn, in reading order. */
function layout(ctx: SKRSContext2D, paras: string[], font: string, scale: number): string[] {
  const margin = 70 * scale;
  const maxWidth = (A4_PT.w - 140) * scale;
  const size = 11 * scale;
  const lineHeight = size * 1.45;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_PT.w * scale, A4_PT.h * scale);
  ctx.fillStyle = '#111111';
  ctx.textBaseline = 'alphabetic';
  let y = margin + size;
  const drawn: string[] = [];
  paras.forEach((para, index) => {
    const isTitle = index === 0 && para === para.toUpperCase();
    ctx.font = `${isTitle ? 'bold ' : ''}${size}px ${font}`;
    let line = '';
    for (const word of para.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        ctx.fillText(line, margin, y);
        drawn.push(line);
        y += lineHeight;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      ctx.fillText(line, margin, y);
      drawn.push(line);
    }
    y += lineHeight * 1.6;
  });
  // The renderer does not break pages: text below the margin would be lost and the truth wrong.
  if (y - lineHeight * 1.6 > (A4_PT.h - 50) * scale) throw new Error('Page trop longue pour le format A4');
  return drawn;
}

function main(): void {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: 'out/corpus' },
      seed: { type: 'string', default: '42' },
      docs: { type: 'string', default: '2' },
      pages: { type: 'string', default: '2' },
      stress: { type: 'boolean', default: false },
    },
  });
  const outDir = values.out!;
  mkdirSync(outDir, { recursive: true });
  const truth: Record<string, Record<string, PageTruth & { skewDeg?: number }>> = {};

  for (let d = 0; d < Number(values.docs); d++) {
    const seed = Number(values.seed) + d * 1000;
    const { pages, truth: ids } = buildReport(mulberry32(seed), Number(values.pages));
    const font = FONTS[d % FONTS.length];

    // Reference PDF with a real text layer (vector text).
    const textDoc = new PDFDocument({ title: 'PV fictif (texte)', producer: 'markneurone-bench' });
    for (const paras of pages) {
      layout(pdfPage(textDoc), paras, font, 1);
      textDoc.endPage();
    }
    const textName = `pv${d + 1}-texte.pdf`;
    writeFileSync(join(outDir, textName), textDoc.close());

    // Rasterize once at 300 dpi; each variant degrades its own copy.
    const rasters = pages.map((paras) => {
      const canvas = createCanvas(Math.round(A4_PT.w * SCALE), Math.round(A4_PT.h * SCALE));
      const lines = layout(canvas.getContext('2d'), paras, font, SCALE);
      return { canvas, text: lines.join('\n') };
    });

    truth[textName] = Object.fromEntries(rasters.map((r, i) => [String(i + 1), { ...ids[i], text: r.text }]));

    const variants = values.stress ? { ...VARIANTS, ...STRESS_VARIANTS } : VARIANTS;
    for (const [variant, kinds] of Object.entries(variants)) {
      const rng = mulberry32(seed + variant.length * 7);
      const doc = new PDFDocument({ title: `PV fictif (${variant})`, producer: 'markneurone-bench', encodingQuality: 85 });
      const name = `pv${d + 1}-image-${variant}.pdf`;
      truth[name] = {};
      rasters.forEach((r, i) => {
        const copy = createCanvas(r.canvas.width, r.canvas.height);
        copy.getContext('2d').drawImage(r.canvas, 0, 0);
        const { canvas, skewDeg } = degrade(copy, kinds, rng);
        pdfPage(doc).drawImage(canvas, 0, 0, A4_PT.w, A4_PT.h);
        doc.endPage();
        truth[name][String(i + 1)] = { ...ids[i], text: r.text, ...(skewDeg ? { skewDeg } : {}) };
      });
      writeFileSync(join(outDir, name), doc.close());
    }
    console.log(`pv${d + 1}: ${pages.length} pages, police ${font}`);
  }

  writeFileSync(join(outDir, 'truth.json'), JSON.stringify(truth, null, 2));
  console.log(`Corpus écrit dans ${outDir}`);
}

main();
