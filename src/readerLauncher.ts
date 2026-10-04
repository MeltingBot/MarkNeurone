// ─── Reader launcher ─────────────────────────────────────────
//
// Module-level opener set by the app:global overlay, so that context
// menus and shortcuts can open the reader without sharing React state.

export interface ReaderTarget {
  dossierId: string;
  assetId: string;
  /** Passage to show once the document is open. */
  annotationId?: string;
}

type Opener = (target: ReaderTarget) => void;

let opener: Opener | null = null;

export function setReaderOpener(fn: Opener | null): void {
  opener = fn;
}

export function openReader(target: ReaderTarget): void {
  opener?.(target);
}
