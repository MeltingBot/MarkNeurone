// ─── Data of documents no longer in the dossier ──────────────
//
// Deleting a document in ZN removes it from its element, not from the
// asset table: a document is present while an element refers to it.
// Recognized text of an absent document is deleted (it can be recognized
// again); its annotations are kept, so that the same file added again
// finds its reading work, but neither travels in the export.

import { getHostAPI } from '../hostAPI.ts';
import { deleteOcr, ocrDocuments } from './ocrStore.ts';
import { readDocument } from './annotationStore.ts';

/** Hashes of the documents an element of the dossier refers to. */
export async function presentDocumentHashes(dossierId: string): Promise<Set<string>> {
  const api = getHostAPI();
  const [elements, assets] = await Promise.all([
    api.repositories.elementRepository.getByDossier(dossierId) as Promise<{ assetIds?: string[] }[]>,
    api.fileService.getAssetsByDossier(dossierId),
  ]);
  const referenced = new Set(elements.flatMap((el) => el.assetIds ?? []));
  return new Set(assets.filter((a) => referenced.has(a.id)).map((a) => a.hash));
}

/** Deletes the recognized text of documents no longer in the dossier. */
export async function deleteOcrOfAbsentDocuments(dossierId: string): Promise<void> {
  const present = await presentDocumentHashes(dossierId);
  for (const hash of await ocrDocuments(dossierId)) {
    if (!present.has(hash)) await deleteOcr(dossierId, hash);
  }
}

/**
 * After ZN deleted an asset (ZN gives no notice before): deletes the OCR of
 * absent documents, and returns the deleted document's kept annotations,
 * so that the user can be told. Null when another copy is still present.
 */
export async function onDocumentDeleted(dossierId: string, assetId: string): Promise<{ filename: string; annotations: number } | null> {
  await deleteOcrOfAbsentDocuments(dossierId);
  // ZN keeps the asset row after removing it from its element.
  const asset = (await getHostAPI().fileService.getAssetsByDossier(dossierId)).find((a) => a.id === assetId);
  if (!asset || (await presentDocumentHashes(dossierId)).has(asset.hash)) return null;
  return { filename: asset.filename, annotations: (await readDocument(dossierId, asset.hash)).length };
}
