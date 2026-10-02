// ─── OCR engine ──────────────────────────────────────────────
//
// Tesseract (French "fast" model) in a Web Worker. Worker script, WASM core
// and model are bundled with the plugin and served from Blob URLs: nothing
// is downloaded, and no network call is made.

import { createWorker, OEM, type Worker as TesseractWorker } from 'tesseract.js';
import workerSource from 'tesseract.js/dist/worker.min.js?raw';
import coreSource from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?raw';
import modelDataUrl from '../../assets/models/fra_fast.traineddata?inline';
import PrepWorker from './ocrPrep.worker.ts?worker&inline';
import type { RawLine } from '../core/ocrLayout.ts';

export { OCR_MODEL_ID } from './ocrModel.ts';
/** A page that takes longer is abandoned, so that it cannot block the queue. */
export const PAGE_TIMEOUT_MS = 90_000;

let tesseract: Promise<TesseractWorker> | null = null;
let urls: string[] = [];

function blobUrl(source: string, type: string): string {
  const url = URL.createObjectURL(new Blob([source], { type }));
  urls.push(url);
  return url;
}

/** The model is inlined as a data URL; decoded here, not fetched (CSP forbids data: in connect-src). */
function decodeModel(): Uint8Array {
  const base64 = modelDataUrl.slice(modelDataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * tesseract.js 7.0.0 loads a language given as { code, data } correctly, then
 * initializes the API with `data` instead of `code` as the language name
 * (worker-script/index.js, initialize). Fixed here in the bundled worker.
 */
const LANG_NAME_BUG = 'return"string"==typeof t?t:t.data}';

function patchedWorkerSource(): string {
  if (!workerSource.includes(LANG_NAME_BUG)) throw new Error('tesseract-worker-unexpected');
  return workerSource.replace(LANG_NAME_BUG, 'return"string"==typeof t?t:t.code}');
}

function getTesseract(): Promise<TesseractWorker> {
  if (!tesseract) {
    const workerPath = blobUrl(patchedWorkerSource(), 'text/javascript');
    // tesseract.js takes corePath as a file only when it ends with "js".
    const corePath = `${blobUrl(coreSource, 'text/javascript')}#core.js`;
    const started = createWorker([{ code: 'fra', data: decodeModel() }] as unknown as string[], OEM.LSTM_ONLY, {
      workerPath,
      corePath,
      workerBlobURL: false,
      cacheMethod: 'none',
      gzip: false,
    });
    tesseract = started;
    started.catch(() => {
      if (tesseract === started) void stopOcr();
    });
  }
  return tesseract;
}

/** Stops the engine (reader closed, or a page timed out). */
export async function stopOcr(): Promise<void> {
  const current = tesseract;
  tesseract = null;
  if (current) await current.then((w) => w.terminate()).catch(() => undefined);
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
}

export interface PreparedImage {
  canvas: HTMLCanvasElement;
  skew: number;
}

/** Denoise, deskew and binarize in a dedicated worker. */
export function preprocessImage(source: HTMLCanvasElement): Promise<PreparedImage> {
  const ctx = source.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
  return new Promise((resolve, reject) => {
    const worker = new PrepWorker();
    worker.onmessage = (e: MessageEvent<{ rgba: Uint8ClampedArray; width: number; height: number; skewDeg: number }>) => {
      worker.terminate();
      const canvas = document.createElement('canvas');
      canvas.width = e.data.width;
      canvas.height = e.data.height;
      canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(e.data.rgba), e.data.width, e.data.height), 0, 0);
      resolve({ canvas, skew: e.data.skewDeg });
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ rgba: data, width, height }, [data.buffer]);
  });
}

interface TesseractBlock {
  paragraphs: { lines: RawLine[] }[];
}

/** Lines of words with boxes (image pixels) and confidences. */
export async function recognize(canvas: HTMLCanvasElement): Promise<RawLine[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('ocr-timeout')), PAGE_TIMEOUT_MS);
  });
  try {
    // Engine start is covered by the timeout too: a failed initialization
    // leaves the tesseract.js promise pending.
    const worker = await Promise.race([getTesseract(), timeout]);
    const result = await Promise.race([worker.recognize(canvas, {}, { blocks: true, text: false }), timeout]);
    const blocks = (result.data.blocks ?? []) as unknown as TesseractBlock[];
    return blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  } catch (err) {
    // A stuck recognition cannot be cancelled: restart the engine.
    if ((err as Error).message === 'ocr-timeout') await stopOcr();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
