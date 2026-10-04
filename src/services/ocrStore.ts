// ─── OCR cache ───────────────────────────────────────────────
//
// Recognized pages stored with the dossier (pluginData `ocr:<sha256>`), page
// by page as the background OCR progresses, so that a document is never
// recognized twice.

import { getHostAPI } from '../hostAPI.ts';
import type { OcrDocument, OcrPage } from '../core/ocrLayout.ts';
import { OCR_MODEL_ID } from './ocrModel.ts';

const key = (hash: string) => `ocr:${hash}`;
const INDEX_KEY = 'ocr-index';

/** Hashes of the dossier's documents that have OCR results. */
export async function ocrDocuments(dossierId: string): Promise<string[]> {
  const index = await getHostAPI().pluginData.get(dossierId, INDEX_KEY);
  return Array.isArray(index) ? index : [];
}

async function addToIndex(dossierId: string, hash: string): Promise<void> {
  const index = await ocrDocuments(dossierId);
  if (!index.includes(hash)) await getHostAPI().pluginData.set(dossierId, INDEX_KEY, [...index, hash]);
}

export function emptyOcr(): OcrDocument {
  return { version: 1, model: OCR_MODEL_ID, pages: {} };
}

export async function loadOcr(dossierId: string, hash: string): Promise<OcrDocument> {
  const stored = await getHostAPI().pluginData.get(dossierId, key(hash));
  return stored && typeof stored === 'object' && stored.pages ? (stored as OcrDocument) : emptyOcr();
}

export async function saveOcrPage(dossierId: string, hash: string, page: number, result: OcrPage): Promise<void> {
  const current = await loadOcr(dossierId, hash);
  await getHostAPI().pluginData.set(dossierId, key(hash), { ...current, pages: { ...current.pages, [String(page)]: result } });
  await addToIndex(dossierId, hash);
}

export async function saveOcr(dossierId: string, hash: string, doc: OcrDocument): Promise<void> {
  await getHostAPI().pluginData.set(dossierId, key(hash), doc);
  await addToIndex(dossierId, hash);
}

/** Removes a document's OCR results from the dossier. */
export async function deleteOcr(dossierId: string, hash: string): Promise<void> {
  const api = getHostAPI();
  await api.pluginData.remove(dossierId, key(hash));
  const index = await ocrDocuments(dossierId);
  if (index.includes(hash)) await api.pluginData.set(dossierId, INDEX_KEY, index.filter((h) => h !== hash));
}
