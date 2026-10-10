// ─── Page texts without the reader ───────────────────────────
//
// The text of each page as the reader builds it (offsets match), for passages
// found while the document is not open: the PDF's text layer, replaced by the
// recognized text on scanned pages; a text document is one page. A scanned
// page never recognized has an empty text.

import { getHostAPI } from '../hostAPI.ts';
import { pdfPageText, type PdfTextItem } from '../core/pageText.ts';
import { blocksText, textFormatOf } from '../core/textDocument.ts';
import { ocrPageText } from '../core/ocrLayout.ts';
import { findAssetByHash } from './documentAssets.ts';
import { loadOcr } from './ocrStore.ts';

// Text read from the file, by document hash: opening a PDF is the slow part.
// The recognized text is applied on each call, so new OCR pages count.
const MAX_CACHED = 4;
const fileTexts = new Map<string, Promise<string[]>>();

async function readFileTexts(asset: { id: string; hash: string; filename: string; mimeType: string }): Promise<string[]> {
  const file = await getHostAPI().fileService.getAssetFile(asset);
  const data = new Uint8Array(await file.arrayBuffer());
  const format = textFormatOf(asset);
  if (format) {
    const { readTextDocument } = await import('./textDocuments.ts');
    return [blocksText(await readTextDocument(data, format))];
  }
  const { openPdf } = await import('./pdfjs.ts');
  const opened = await openPdf(data);
  try {
    const pages: string[] = [];
    for (let n = 1; n <= opened.doc.numPages; n++) {
      const content = await (await opened.doc.getPage(n)).getTextContent();
      pages.push(pdfPageText(content.items as PdfTextItem[]).text);
    }
    return pages;
  } finally {
    await opened.close();
  }
}

function fileTextsOf(asset: { id: string; hash: string; filename: string; mimeType: string }): Promise<string[]> {
  let pending = fileTexts.get(asset.hash);
  if (!pending) {
    pending = readFileTexts(asset).catch((err: unknown) => {
      fileTexts.delete(asset.hash);
      throw err;
    });
    fileTexts.set(asset.hash, pending);
    while (fileTexts.size > MAX_CACHED) fileTexts.delete(fileTexts.keys().next().value!);
  }
  return pending;
}

/** Page texts of a document of the open dossier, or null when it is not there. */
export async function documentPageTexts(dossierId: string, hash: string): Promise<string[] | null> {
  const asset = findAssetByHash(hash);
  if (!asset) return null;
  const pages = await fileTextsOf(asset);
  if (textFormatOf(asset)) return pages;
  const ocr = (await loadOcr(dossierId, hash)).pages;
  return pages.map((text, i) => {
    const page = ocr[String(i + 1)];
    return page ? ocrPageText(page).text : text;
  });
}
