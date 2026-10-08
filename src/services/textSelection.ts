// ─── Text layer selection guard ──────────────────────────────
//
// Without it, dragging a selection over the gap between two lines selects
// the rest of the page: the browser extends the range to the end of the text
// layer. Port of the "endOfContent" handling of pdf.js' TextLayerBuilder
// (web/text_layer_builder.js, v6.2), which pdfjs-dist's bare TextLayer lacks:
// while selecting, an empty block covers the layer (CSS `.selecting`), and on
// browsers that still need it, the block is moved right after the selection
// focus so that gaps extend the selection to that point only.

const layers = new Map<HTMLElement, HTMLElement>();
/** One set of listeners per document: the reader may be in a window of its own. */
const listeners = new Map<Document, AbortController>();

function reset(end: HTMLElement, layer: HTMLElement): void {
  layer.append(end);
  end.style.width = '';
  end.style.height = '';
  end.style.userSelect = '';
  layer.classList.remove('selecting');
}

let handlesGapsNatively: boolean | undefined;

function nativeHandling(): boolean {
  if (handlesGapsNatively === undefined) {
    // pdf.js tells Firefox by a `-moz-user-select: none` rule of its full
    // stylesheet, which our subset does not carry: the user agent it is.
    // Moving the end block during a Firefox selection loses its start (a
    // double-clicked word without its first letter).
    const firefox = /\bFirefox\/\d+/.test(navigator.userAgent);
    const chromium = /\bChrome\/(\d+)\b/.exec(navigator.userAgent)?.[1];
    handlesGapsNatively = firefox || (!!chromium && parseInt(chromium, 10) >= 148);
  }
  return handlesGapsNatively;
}

function enableListeners(document: Document): void {
  if (listeners.has(document)) return;
  const controller = new AbortController();
  listeners.set(document, controller);
  const { signal } = controller;
  const window = document.defaultView!;
  let pointerDown = false;
  let prevRange: Range | null = null;
  const resetAll = () => layers.forEach(reset);

  document.addEventListener('pointerdown', () => { pointerDown = true; }, { signal });
  document.addEventListener('pointerup', () => { pointerDown = false; resetAll(); }, { signal });
  window.addEventListener('blur', () => { pointerDown = false; resetAll(); }, { signal });
  document.addEventListener('keyup', () => { if (!pointerDown) resetAll(); }, { signal });

  document.addEventListener('selectionchange', () => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
      resetAll();
      return;
    }
    const active = new Set<HTMLElement>();
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      for (const layer of layers.keys()) if (range.intersectsNode(layer)) active.add(layer);
    }
    for (const [layer, end] of layers) {
      if (active.has(layer)) layer.classList.add('selecting');
      else reset(end, layer);
    }
    if (nativeHandling()) return;

    const range = selection.getRangeAt(0);
    const modifyStart = !!prevRange && (
      range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
      range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0);
    let anchor: Node = modifyStart ? range.startContainer : range.endContainer;
    if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentNode!;
    if (!modifyStart && range.endOffset === 0) {
      do {
        while (!anchor.previousSibling) anchor = anchor.parentNode!;
        anchor = anchor.previousSibling;
      } while (!anchor.childNodes.length);
    }
    const layer = anchor.parentElement?.closest<HTMLElement>('.textLayer');
    const end = layer ? layers.get(layer) : undefined;
    if (layer && end) {
      end.style.width = layer.style.width;
      end.style.height = layer.style.height;
      end.style.userSelect = 'text';
      anchor.parentElement!.insertBefore(end, modifyStart ? anchor : anchor.nextSibling);
    }
    prevRange = range.cloneRange();
  }, { signal });
}

/** Call once the layer's text is rendered; returns the cleanup. */
export function guardTextSelection(layer: HTMLElement): () => void {
  const end = layer.ownerDocument.createElement('div');
  end.className = 'endOfContent';
  layer.append(end);
  const onMouseDown = () => layer.classList.add('selecting');
  layer.addEventListener('mousedown', onMouseDown);
  layers.set(layer, end);
  const doc = layer.ownerDocument;
  enableListeners(doc);
  return () => {
    layer.removeEventListener('mousedown', onMouseDown);
    layer.classList.remove('selecting');
    end.remove();
    layers.delete(layer);
    if (![...layers.keys()].some((l) => l.ownerDocument === doc)) {
      listeners.get(doc)?.abort();
      listeners.delete(doc);
    }
  };
}
