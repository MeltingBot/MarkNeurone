// OCR bench: runs Tesseract (French model) on every PDF of a folder, with and
// without preprocessing, and reports time per page, mean confidence, and how
// well the plugin's suggestions (every pattern kind and the dossier's names)
// survive OCR, against an optional JSON ground truth.
//
// Usage:
//   tsx run.ts --input out/corpus [--truth out/corpus/truth.json]
//              [--models fast,best] [--modes brut,pretraite] [--pages 2]
//              [--filter cumul] [--out out/report] [--dump] [--drop-color]
//
// --dump writes the text of every page (text layer or OCR) to <out>/text/,
// to see what the OCR actually read where a suggestion is missed.
//
// Everything runs locally: models are read from ./models, nothing is downloaded.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { cpus } from 'node:os';
import { parseArgs } from 'node:util';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { DEFAULT_PREPROCESS, grayToRgba, preprocess, rgbaToGray } from '../../src/core/image/preprocess.ts';
import type { NamedElement } from '../../src/core/dictionary.ts';
import { dictionaryOf, emptyScore, pageCer, scoreSuggestions, type KindScore } from './metrics.ts';
import { TRUTH_KINDS, type PageTruth as GeneratedTruth, type TruthKind } from './gen/fiction.ts';

const DPI = 300;
const KIND_LABEL: Record<TruthKind, string> = {
  name: 'Noms connus', phone: 'Téléphones', plate: 'Plaques', iban: 'IBAN', siret: 'SIRET', nir: 'NIR', email: 'E-mails',
  url: 'URL', ipv4: 'IPv4', ipv6: 'IPv6', btc: 'Bitcoin', eth: 'Ethereum', amount: 'Montants', date: 'Dates',
};

type Mode = 'brut' | 'pretraite';
type PageTruth = GeneratedTruth & { skewDeg?: number };
type Truth = Record<string, Record<string, PageTruth>>;

interface PageResult {
  file: string;
  page: number;
  model: string;
  mode: Mode | 'couche-texte';
  renderMs: number;
  preprocessMs: number;
  ocrMs: number;
  confidence: number | null;
  skewDetected?: number;
  skewTruth?: number;
  cer?: number;
  suggestions?: Record<TruthKind, KindScore>;
}

const { values } = parseArgs({
  options: {
    input: { type: 'string', default: 'out/corpus' },
    truth: { type: 'string' },
    models: { type: 'string', default: 'fast' },
    modes: { type: 'string', default: 'brut,pretraite' },
    pages: { type: 'string' },
    filter: { type: 'string' },
    out: { type: 'string', default: 'out/report' },
    dump: { type: 'boolean', default: false },
    'drop-color': { type: 'boolean', default: false },
  },
});

const inputDir = resolve(values.input!);
const truthPath = values.truth ?? join(inputDir, 'truth.json');
const truth: Truth = existsSync(truthPath) ? JSON.parse(readFileSync(truthPath, 'utf8')) : {};
const models = values.models!.split(',');
const modes = values.modes!.split(',') as Mode[];
const maxPages = values.pages ? Number(values.pages) : Infinity;

async function renderPage(data: Uint8Array, pageNumber: number) {
  const task = getDocument({ data, verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: DPI / 72 });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const t0 = performance.now();
  // pdf.js expects a DOM canvas; @napi-rs/canvas implements the subset it uses in Node.
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
  const renderMs = performance.now() - t0;
  await task.destroy();
  return { canvas, renderMs };
}

async function textLayer(data: Uint8Array): Promise<{ pages: number; text: string[]; chars: number }> {
  const task = getDocument({ data, verbosity: 0 });
  const doc = await task.promise;
  const text: string[] = [];
  let chars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    // pdf.js emits its own space items between words; only line ends need adding.
    const pageText = content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join('');
    chars += pageText.replace(/\s/g, '').length;
    text.push(pageText);
  }
  const pages = doc.numPages;
  await task.destroy();
  return { pages, text, chars };
}

async function makeWorker(model: string): Promise<Worker> {
  const langPath = resolve('models', model);
  if (!existsSync(join(langPath, 'fra.traineddata'))) throw new Error(`Modèle absent : ${langPath}/fra.traineddata`);
  // langPath MUST be set: tesseract.js falls back to a CDN otherwise.
  return createWorker('fra', OEM.LSTM_ONLY, { langPath, gzip: false, cacheMethod: 'none' });
}

function dump(result: PageResult, text: string): void {
  if (!values.dump) return;
  const dir = join(values.out!, 'text');
  mkdirSync(dir, { recursive: true });
  const tag = result.mode === 'couche-texte' ? 'texte' : `${result.model}-${result.mode}`;
  writeFileSync(join(dir, `${basename(result.file, '.pdf')}-p${result.page}-${tag}.txt`), text);
}

function score(result: PageResult, text: string, pageTruth: PageTruth | undefined, dictionary: NamedElement[]): void {
  dump(result, text);
  if (!pageTruth?.items) return;
  result.cer = pageCer(pageTruth.text, text);
  result.suggestions = scoreSuggestions(pageTruth.items, text, dictionary);
  if (pageTruth.skewDeg !== undefined) result.skewTruth = pageTruth.skewDeg;
}

async function main(): Promise<void> {
  const files = readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .filter((f) => !values.filter || f.includes(values.filter))
    .sort();
  if (!files.length) throw new Error(`Aucun PDF dans ${inputDir}`);

  const results: PageResult[] = [];
  const workers = new Map<string, Worker>();
  for (const m of models) workers.set(m, await makeWorker(m));

  for (const file of files) {
    const data = new Uint8Array(readFileSync(join(inputDir, file)));
    const layer = await textLayer(data.slice());
    const pageCount = Math.min(layer.pages, maxPages);
    const fileTruth = truth[file];
    // The dossier knows every name of the report, as if each had been qualified once.
    const dictionary = dictionaryOf(Object.values(fileTruth ?? {}).flatMap((t) => t.items ?? []));

    // A PDF with a usable text layer needs no OCR; the plugin applies the same rule.
    if (layer.chars / layer.pages > 50) {
      for (let p = 1; p <= pageCount; p++) {
        const r: PageResult = { file, page: p, model: '-', mode: 'couche-texte', renderMs: 0, preprocessMs: 0, ocrMs: 0, confidence: null };
        score(r, layer.text[p - 1], fileTruth?.[String(p)], dictionary);
        results.push(r);
      }
      console.log(`${file}: couche texte présente, OCR inutile`);
      continue;
    }

    for (let p = 1; p <= pageCount; p++) {
      const { canvas, renderMs } = await renderPage(data.slice(), p);
      const pageTruth = fileTruth?.[String(p)];
      for (const mode of modes) {
        let input = canvas;
        let preprocessMs = 0;
        let skewDetected: number | undefined;
        if (mode === 'pretraite') {
          const t0 = performance.now();
          const ctx = canvas.getContext('2d');
          const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          // --drop-color: coloured ink (stamps) removed, as the plugin does when re-reading a passage.
          const res = preprocess(rgbaToGray(rgba, canvas.width, canvas.height, values['drop-color'] ? 'max' : 'luma'), DEFAULT_PREPROCESS);
          const out = createCanvas(res.image.width, res.image.height);
          const octx = out.getContext('2d');
          const imageData = octx.createImageData(res.image.width, res.image.height);
          imageData.data.set(grayToRgba(res.image));
          octx.putImageData(imageData, 0, 0);
          preprocessMs = performance.now() - t0;
          skewDetected = res.skewDeg;
          input = out;
        }
        const png = input.toBuffer('image/png');
        for (const [model, worker] of workers) {
          const t0 = performance.now();
          const { data: ocr } = await worker.recognize(png);
          const ocrMs = performance.now() - t0;
          const r: PageResult = {
            file, page: p, model, mode, renderMs, preprocessMs, ocrMs,
            confidence: ocr.confidence,
            ...(skewDetected !== undefined ? { skewDetected } : {}),
          };
          score(r, ocr.text, pageTruth, dictionary);
          results.push(r);
          const cer = r.cer !== undefined ? ` CER ${(r.cer * 100).toFixed(1)} %` : '';
          console.log(`${file} p${p} ${model}/${mode}: ${Math.round(ocrMs)} ms, confiance ${ocr.confidence.toFixed(0)}${cer}`);
        }
      }
    }
  }
  for (const w of workers.values()) await w.terminate();

  mkdirSync(values.out!, { recursive: true });
  writeFileSync(join(values.out!, 'report.json'), JSON.stringify({ date: new Date().toISOString(), env: envInfo(), results }, null, 2));
  writeFileSync(join(values.out!, 'report.md'), markdown(results));
  console.log(`Rapport écrit dans ${values.out}/report.md`);
}

function envInfo() {
  return { node: process.version, cpu: cpus()[0]?.model, cores: cpus().length, dpi: DPI, preprocess: DEFAULT_PREPROCESS };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)} %` : '-');
const ms = (x: number) => (Number.isFinite(x) ? `${Math.round(x)}` : '-');

/** Groups by variant (file name without the document prefix), model and mode. */
function variantOf(file: string): string {
  return basename(file, '.pdf').replace(/^pv\d+-/, '');
}

function markdown(results: PageResult[]): string {
  const lines: string[] = [];
  const env = envInfo();
  lines.push('# Banc d\'essai OCR MarkNeurone', '');
  lines.push(`Date : ${new Date().toISOString()}. Machine : ${env.cpu} (${env.cores} cœurs), Node ${env.node}. Rendu ${DPI} dpi.`, '');

  const groups = new Map<string, PageResult[]>();
  for (const r of results) {
    const key = `${variantOf(r.file)}|${r.model}|${r.mode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const total = (rs: PageResult[], kind: TruthKind) => {
    const t = emptyScore();
    for (const r of rs) if (r.suggestions) for (const f of Object.keys(t) as (keyof KindScore)[]) t[f] += r.suggestions[kind][f];
    return t;
  };
  const sorted = [...groups].sort();
  const column = (key: string) => {
    const [variant, model, mode] = key.split('|');
    return `${variant}${mode === 'couche-texte' ? '' : ` ${mode}`}${models.length > 1 && model !== '-' ? ` ${model}` : ''}`;
  };

  lines.push('## Synthèse par variante', '');
  lines.push('| Variante | Modèle | Mode | Pages | OCR ms/page | Prétrait. ms/page | Confiance | CER page | Suggestions trouvées | Fausses suggestions | Signalées comme mal lues | Erreurs non signalées |');
  lines.push('|' + ' --- |'.repeat(12));
  for (const [key, rs] of sorted) {
    const [variant, model, mode] = key.split('|');
    const all = TRUTH_KINDS.map((k) => total(rs, k));
    const sum = (f: keyof KindScore) => all.reduce((a, t) => a + t[f], 0);
    const conf = rs.map((r) => r.confidence).filter((c): c is number => c !== null);
    const cers = rs.map((r) => r.cer).filter((c): c is number => c !== undefined);
    lines.push(`| ${variant} | ${model} | ${mode} | ${rs.length} | ${ms(mean(rs.map((r) => r.ocrMs)))} | ` +
      `${ms(mean(rs.map((r) => r.preprocessMs)))} | ${conf.length ? mean(conf).toFixed(0) : '-'} | ${pct(mean(cers))} | ` +
      `${sum('expected') ? `${sum('found')}/${sum('expected')}` : '-'} | ${sum('falsePositives')} | ${sum('checksumFlagged')} | ${sum('checksumMissed')} |`);
  }

  lines.push('', '## Suggestions par type', '');
  lines.push('Suggestions trouvées sur attendues, et entre parenthèses les suggestions fausses (valeur mal lue ou motif reconnu à tort).', '');
  lines.push('| Type | ' + sorted.map(([key]) => column(key)).join(' | ') + ' |');
  lines.push('|' + ' --- |'.repeat(1 + sorted.length));
  for (const kind of TRUTH_KINDS) {
    const cells = sorted.map(([, rs]) => {
      const t = total(rs, kind);
      return t.expected || t.falsePositives ? `${t.found}/${t.expected}${t.falsePositives ? ` (+${t.falsePositives})` : ''}` : '-';
    });
    lines.push(`| ${KIND_LABEL[kind]} | ${cells.join(' | ')} |`);
  }

  lines.push('', '## Erreur moyenne par caractère, par type', '');
  lines.push('Distance d\'édition entre la valeur attendue et le meilleur passage du texte reconnu, rapportée à sa longueur. Mesure la gravité des erreurs, y compris quand la valeur n\'est plus reconnue.', '');
  lines.push('| Type | ' + sorted.map(([key]) => column(key)).join(' | ') + ' |');
  lines.push('|' + ' --- |'.repeat(1 + sorted.length));
  for (const kind of TRUTH_KINDS) {
    const cells = sorted.map(([, rs]) => {
      const t = total(rs, kind);
      return t.expected ? pct(t.cerSum / t.expected) : '-';
    });
    lines.push(`| ${KIND_LABEL[kind]} | ${cells.join(' | ')} |`);
  }

  const skews = results.filter((r) => r.skewTruth !== undefined && r.skewDetected !== undefined);
  if (skews.length) {
    lines.push('', '## Redressement', '');
    lines.push('| Fichier | Page | Biais simulé | Correction appliquée |', '| --- | --- | --- | --- |');
    const seen = new Set<string>();
    for (const r of skews) {
      const k = `${r.file}|${r.page}`;
      if (seen.has(k)) continue;
      seen.add(k);
      lines.push(`| ${r.file} | ${r.page} | ${r.skewTruth}° | ${r.skewDetected}° |`);
    }
  }

  lines.push('', '## Détail par page', '');
  lines.push('| Fichier | Page | Modèle | Mode | Rendu ms | Prétrait. ms | OCR ms | Confiance | CER |', '|' + ' --- |'.repeat(9));
  for (const r of results) {
    lines.push(`| ${r.file} | ${r.page} | ${r.model} | ${r.mode} | ${ms(r.renderMs)} | ${ms(r.preprocessMs)} | ${ms(r.ocrMs)} | ` +
      `${r.confidence?.toFixed(0) ?? '-'} | ${r.cer !== undefined ? pct(r.cer) : '-'} |`);
  }
  lines.push('');
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
