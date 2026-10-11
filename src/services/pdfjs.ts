// ─── pdf.js loader ───────────────────────────────────────────
//
// pdf.js is bundled with the plugin (ZN does not expose its copy). The
// worker is inlined and started from a Blob URL, so nothing is fetched.
//
// GlobalWorkerOptions is NOT touched: in workspace mode this module is the
// same instance as ZN's pdf.js, and ZN configures its own worker there.
// Each document gets a dedicated PDFWorker instead.
//
// Legacy build: the modern one calls recent built-ins
// (Map.prototype.getOrInsertComputed...) without polyfilling them and throws
// in browsers that lack them.

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import PdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline';

export { pdfjs };
export type { PDFDocumentProxy };

export interface OpenedPdf {
  doc: PDFDocumentProxy;
  close: () => Promise<void>;
}

/**
 * `ownerDocument`: document of the window the pages are drawn in. pdf.js
 * registers the PDF's embedded fonts there; drawn in another window (reader
 * moved to a window of its own), glyphs would show as boxes.
 */
export async function openPdf(data: Uint8Array, ownerDocument: Document = document): Promise<OpenedPdf> {
  // pdf.js 6 types the constructor's `port` as `null` although the runtime and
  // PDFWorkerParameters accept a Worker; hence the cast.
  const params = { port: new PdfjsWorker() } as unknown as ConstructorParameters<typeof pdfjs.PDFWorker>[0];
  const worker = new pdfjs.PDFWorker(params);
  const task = pdfjs.getDocument({
    data,
    worker,
    // No font or CMap URL is given, so nothing is downloaded; non-embedded
    // standard fonts fall back to system fonts.
    useSystemFonts: true,
    ownerDocument,
  });
  try {
    const doc = await task.promise;
    return {
      doc,
      close: async () => {
        await task.destroy();
        worker.destroy();
      },
    };
  } catch (err) {
    await task.destroy();
    worker.destroy();
    throw err;
  }
}
