// ─── Window of the reader ────────────────────────────────────
//
// The reader can be moved to a window of its own (work on two screens).
// Code that reads the selection, listens to the keyboard, measures the
// viewport or injects styles goes through these helpers, so that it acts on
// the window the reader is shown in rather than on ZN's.

/** A window with its own constructors (a window opened by window.open has its own). */
export type ReaderWin = Window & typeof globalThis;

let current: ReaderWin = window;

/** Window showing the reader: ZN's, or the detached one. */
export function readerWindow(): ReaderWin {
  return current.closed ? window : current;
}

export function readerDocument(): Document {
  return readerWindow().document;
}

export function setReaderWindow(win: Window | null): void {
  current = (win as ReaderWin | null) ?? window;
}

/**
 * Whether a node or event target is an element, whatever window it belongs
 * to: `instanceof Element` is false for the nodes of the detached window,
 * which have that window's constructors.
 */
export function isElement(target: EventTarget | Node | null | undefined): target is Element {
  return !!target && (target as Node).nodeType === 1;
}

/** Whether the reader is in a window of its own. */
export function isReaderDetached(): boolean {
  return readerWindow() !== window;
}

// ─── View kept across a move ─────────────────────────────────
// Moving the reader to another window mounts it again: zoom and scroll
// position are handed over so that reading goes on where it was.

/**
 * Position in document units, not pixels: the new window may be wider or
 * narrower, and a zoom fitted to its width gives another scale.
 */
export interface ReaderView {
  assetId: string;
  zoom: unknown;
  /** Page at the top of the view (0-based) and how far into it, at scale 1. */
  page: number;
  offset: number;
  left: number;
}

let handedOver: ReaderView | null = null;
let moving = false;

/** Called just before the reader changes window. */
export function beginMove(): void {
  moving = true;
}

/**
 * Kept up to date by the reader (scroll, zoom): the new one is rendered
 * before the old one goes, so the view cannot wait for the old one's end.
 */
export function handOverView(view: ReaderView): void {
  handedOver = view;
}

/**
 * The view of the reader before its move; null when it is not moving. Read
 * from a state initializer, which StrictMode runs twice: the move ends after
 * the current render rather than at the first read.
 */
export function takeView(assetId: string): ReaderView | null {
  const view = moving && handedOver?.assetId === assetId ? handedOver : null;
  if (moving) setTimeout(() => { moving = false; });
  return view;
}
