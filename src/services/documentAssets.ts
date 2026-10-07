// ─── Readable documents of the current dossier ───────────────
//
// PDF, and text documents (DOCX, ODT, TXT, Markdown).

import { getHostAPI } from '../hostAPI.ts';
import { textFormatOf } from '../core/textDocument.ts';

export interface DocumentAsset {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** SHA-256 of the file content, computed by ZN when the asset is added. */
  hash: string;
}

export function isPdf(asset: { mimeType: string; filename: string }): boolean {
  return asset.mimeType === 'application/pdf' || asset.filename.toLowerCase().endsWith('.pdf');
}

export function isReadable(asset: { mimeType: string; filename: string }): boolean {
  return isPdf(asset) || textFormatOf(asset) !== null;
}

/** Readable assets attached to the given elements, without duplicates, in element order. */
export function readableAssetsOfElements(elementIds: string[]): DocumentAsset[] {
  const state = getHostAPI().stores.useDossierStore.getState();
  const byId = new Map<string, DocumentAsset>(state.assets.map((a: DocumentAsset) => [a.id, a]));
  const seen = new Set<string>();
  const out: DocumentAsset[] = [];
  for (const id of elementIds) {
    const element = state.elements.find((e: { id: string }) => e.id === id);
    for (const assetId of element?.assetIds ?? []) {
      const asset = byId.get(assetId);
      if (asset && isReadable(asset) && !seen.has(asset.id)) {
        seen.add(asset.id);
        out.push(asset);
      }
    }
  }
  return out;
}

export function findAsset(assetId: string): DocumentAsset | undefined {
  return getHostAPI().stores.useDossierStore.getState().assets.find((a: DocumentAsset) => a.id === assetId);
}

/** Asset of the current dossier with this SHA-256. */
export function findAssetByHash(hash: string): DocumentAsset | undefined {
  return getHostAPI().stores.useDossierStore.getState().assets.find((a: DocumentAsset) => a.hash === hash);
}
