// ─── OneNeurone extraction ───────────────────────────────────
//
// Service 'oneneurone:extraction' (ZN 2.64 and later): the reader hands a
// document, or the selected part of it, to OneNeurone, whose panel shows
// what it extracted. Nothing appears when OneNeurone is missing, disabled or
// without its extraction license.

import { getHostAPI } from '../hostAPI.ts';

export const EXTRACTION_SERVICE = 'oneneurone:extraction';

export interface ExtractionDocument {
  label: string;
  /** SHA-256 of the document. */
  documentHash: string;
  /** Elements that carry the document. */
  elementIds: string[];
  /** Text of each page, as MarkNeurone reads it (offsets of `range` refer to it). */
  pages: string[];
  /** Only this part of the document (a selection). */
  range?: { page: number; start: number; end: number };
}

interface OneExtractionV1 {
  version: number;
  isAvailable(): boolean;
  extract(req: { dossierId: string; documents: ExtractionDocument[] }): void;
}

/** React hook: the extraction service when it can be used now, else null. */
export function useExtraction(): OneExtractionV1 | null {
  const services = getHostAPI().pluginServices;
  // Same branch on every render: the host API does not change.
  const service = services ? services.use<OneExtractionV1>(EXTRACTION_SERVICE) : undefined;
  try {
    return service && service.version >= 1 && service.isAvailable() ? service : null;
  } catch (err) {
    console.warn('MarkNeurone: OneNeurone extraction unavailable', err);
    return null;
  }
}

/** Hands the documents over; false when OneNeurone could not take them. */
export function sendToExtraction(service: OneExtractionV1, dossierId: string, documents: ExtractionDocument[]): boolean {
  try {
    service.extract({ dossierId, documents });
    return true;
  } catch (err) {
    console.warn('MarkNeurone: OneNeurone extraction failed', err);
    return false;
  }
}
