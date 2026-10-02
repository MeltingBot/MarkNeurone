// ─── Export and import of annotations ────────────────────────
//
// ZN's export:hooks and import:hooks give the dossier ZIP (JSZip). The
// annotations travel in annotations.json, at the root next to dossier.json;
// a ZN without the plugin ignores the file.

import { getHostAPI } from '../hostAPI.ts';
import {
  buildExport,
  EXPORT_FILE,
  mergeAnnotations,
  parseExport,
  rewire,
  type ImportedGraph,
} from '../core/annotationTransfer.ts';
import { annotatedDocuments, readDocument, writeDocument } from './annotationStore.ts';
import { loadOcr, ocrDocuments, saveOcr } from './ocrStore.ts';
import type { OcrDocument } from '../core/ocrLayout.ts';

/** OCR results travel too, so that an imported dossier is not recognized again. */
const OCR_DIR = 'markneurone/ocr/';

/** Subset of JSZip used by the hooks. */
export interface ZipLike {
  file(name: string, data: string): unknown;
  file(name: string): { async(type: 'string'): Promise<string> } | null;
  file(pattern: RegExp): { name: string; async(type: 'string'): Promise<string> }[];
}

export async function exportAnnotations(zip: ZipLike, dossierId: string): Promise<void> {
  const hashes = await annotatedDocuments(dossierId);
  const documents = await Promise.all(hashes.map(async (hash) => ({ hash, annotations: await readDocument(dossierId, hash) })));
  const file = buildExport(documents);
  if (file) zip.file(EXPORT_FILE, JSON.stringify(file, null, 2));
  for (const hash of await ocrDocuments(dossierId)) {
    const ocr = await loadOcr(dossierId, hash);
    if (Object.keys(ocr.pages).length) zip.file(`${OCR_DIR}${hash}.json`, JSON.stringify(ocr));
  }
}

/** Restores OCR results, without overwriting pages already recognized in the dossier. */
async function importOcr(zip: ZipLike, dossierId: string): Promise<void> {
  for (const entry of zip.file(new RegExp(`^${OCR_DIR}[0-9a-f]{64}\\.json$`))) {
    const hash = entry.name.slice(OCR_DIR.length, -'.json'.length);
    const imported = JSON.parse(await entry.async('string')) as OcrDocument;
    if (!imported || typeof imported.pages !== 'object') continue;
    const current = await loadOcr(dossierId, hash);
    await saveOcr(dossierId, hash, { ...imported, pages: { ...imported.pages, ...current.pages } });
  }
}

/** Returns the number of annotations added, and how many lost their object. */
export async function importAnnotations(zip: ZipLike, dossierId: string): Promise<{ added: number; orphans: number }> {
  await importOcr(zip, dossierId);
  const entry = zip.file(EXPORT_FILE);
  if (!entry) return { added: 0, orphans: 0 };
  const parsed = parseExport(JSON.parse(await entry.async('string')));
  if (!parsed) throw new Error('annotations.json: unknown format');

  // The dossier is not necessarily open: read what the import just wrote.
  const api = getHostAPI();
  const [elements, links, assets] = await Promise.all([
    api.repositories.elementRepository.getByDossier(dossierId),
    api.repositories.linkRepository.getByDossier(dossierId),
    api.fileService.getAssetsByDossier(dossierId),
  ]);
  const graph: ImportedGraph = { elements, links, assets };

  let added = 0;
  let orphans = 0;
  for (const doc of parsed.documents) {
    const imported = rewire(doc.annotations, graph);
    const existing = await readDocument(dossierId, doc.hash);
    const merged = mergeAnnotations(existing, imported);
    added += merged.length - existing.length;
    orphans += imported.filter((a) => a.orphan && !existing.some((e) => e.id === a.id)).length;
    await writeDocument(dossierId, doc.hash, merged);
  }
  return { added, orphans };
}
