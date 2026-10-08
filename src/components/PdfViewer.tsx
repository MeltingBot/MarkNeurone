// ─── PDF viewer ──────────────────────────────────────────────
//
// Continuous vertical view. Pages are laid out from their sizes at once,
// and rendered (canvas + selectable text layer) only near the viewport.
//
// Layout values that ZN's Tailwind build may not contain are inline styles:
// plugin-only utility classes are not generated in ZN's compiled CSS.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import type { DocumentAsset } from '../services/documentAssets.ts';
import type { OpenedPdf, PDFDocumentProxy } from '../services/pdfjs.ts';
import { analyseTextLayer, countTextChars, type TextLayerReport } from '../core/textLayerDetection.ts';
import type { Annotation, Quad } from '../core/model.ts';
import { applyTransform, linkArc, pdfQuadToViewport, scaleTransform, viewportRectToPdf, type Rect, type Transform } from '../core/geometry.ts';
import {
  annotationAt,
  capturePassage,
  rangeBoxes,
  passageFromOffsets,
  type PageInfo,
  type Passage,
} from '../services/selectionCapture.ts';
import { trimPunctuation } from '../core/sentences.ts';
import { findInPages, type SearchHit } from '../core/search.ts';
import { buildOcrPage, ocrPageText, rangeConfidence, rangeInBox, wordsInRange, type OcrPage } from '../core/ocrLayout.ts';
import { deleteOcr, loadOcr, saveOcrPage } from '../services/ocrStore.ts';
import { guardTextSelection } from '../services/textSelection.ts';
import { renderOcrLayer } from '../services/ocrLayer.ts';
import { renderTextBlocks, TEXT_SHEET_CSS, TEXT_SHEET_WIDTH } from '../services/textSheet.ts';
import { blocksText, textFormatOf, type TextBlock } from '../core/textDocument.ts';
import { getAnnotations, getVersion, loadAnnotations, subscribe, writeDocument } from '../services/annotationStore.ts';
import { reconcile } from '../core/integrity.ts';
import { isGraphElement, type ZnElement, type ZnLink, type ZnTagSet } from '../services/znTypes.ts';
import { SelectionBar, type Gesture } from './SelectionBar.tsx';
import { ElementSheet, type Draft, type LinkDraft } from './ElementSheet.tsx';
import { revealOnCanvas } from '../services/graphWriter.ts';
import { applyRelabel, deleteAnnotation, planRelabel, reattachToElement, rejectSuggestion, relabelCount, type RelabelPlan } from '../services/qualify.ts';
import { loadReference, saveReference } from '../services/documentRef.ts';
import { cleanReference, detectReference } from '../core/reference.ts';
import { buildSuggestions, type Suggestion } from '../core/suggestions.ts';
import { cooccurrences, elementHighlights, pairKey, verbEnds } from '../core/linkAssist.ts';
import { loadDismissedPairs, saveDismissedPairs } from '../services/linkAssistStore.ts';
import type { NamedElement } from '../core/dictionary.ts';
import { loadViewPrefs, saveViewPrefs } from '../services/viewPrefs.ts';
import { getProfile, getSettings, getSettingsVersion, subscribeSettings } from '../services/settingsStore.ts';
import { isMapPickerOpen } from '../services/mapPicker.ts';
import { ReaderContextMenu, type MenuItem } from './ReaderContextMenu.tsx';

const PAGE_GAP = 12;
const PADDING = 16;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
/** Default zoom: fit to width, but no larger than this (pdf.js' "auto" does the same). */
const AUTO_MAX_ZOOM = 1.25;
/** pdf.js scale 1 is 72 dpi; 100 % zoom is real size at CSS 96 dpi. */
const PDF_TO_CSS = 96 / 72;

const TEXT_LAYER_STYLE_ID = 'mark-neurone-text-layer';
// Subset of pdf.js' pdf_viewer.css needed by TextLayer (v6), scoped to our pages.
const TEXT_LAYER_CSS = `
.mn-page { --user-unit: 1; --total-scale-factor: calc(var(--scale-factor) * var(--user-unit)); --scale-round-x: 1px; --scale-round-y: 1px; }
.mn-page .textLayer { position: absolute; text-align: initial; inset: 0; overflow: clip; opacity: 1; line-height: 1;
  letter-spacing: normal; word-spacing: normal; text-size-adjust: none; forced-color-adjust: none; transform-origin: 0 0; z-index: 0;
  --min-font-size: 1; --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv: calc(1 / var(--min-font-size)); }
.mn-page .textLayer :is(span, br) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; user-select: text; }
.mn-page .textLayer > :not(.markedContent), .mn-page .textLayer .markedContent span:not(.markedContent) { z-index: 1; --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height)); --scale-x: 1; --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
.mn-page .textLayer .markedContent { display: contents; }
.mn-page .textLayer ::selection { background: rgba(0 0 255 / 0.25); color: transparent; }
.mn-page .textLayer br::selection { background: transparent; }
.mn-page .textLayer .endOfContent { display: block; position: absolute; inset: 100% 0 0; z-index: 0; cursor: default; user-select: none; }
.mn-page .textLayer.selecting .endOfContent { top: 0; }
`;

function ensureTextLayerStyle(): void {
  let style = document.getElementById(TEXT_LAYER_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = TEXT_LAYER_STYLE_ID;
    document.head.appendChild(style);
  }
  // Rewritten each time, so that a plugin update applies without a reload.
  style.textContent = TEXT_LAYER_CSS + TEXT_SHEET_CSS;
}

/** A highlight to draw: PDF quads, a color and a style per annotation kind. */
interface Highlight {
  id: string;
  quads: Quad[];
  color: string;
  kind: Annotation['kind'];
  selected: boolean;
}

/** A link shown in the document: dotted arc between two highlights of one page. */
interface LinkArcInfo {
  id: string;
  from: Quad;
  to: Quad;
  color: string;
  /** The link, or one of its ends, is the current selection. */
  emphasis: boolean;
}

// Fallbacks when no tag color applies; events use ZN's "Événement" tag color if any.
const ORPHAN_COLOR = '#9ca3af';
const LINK_COLOR = 'var(--color-text-secondary)';
const EVENT_FALLBACK_COLOR = '#a855f7';

/**
 * A link whose passage was deduced, in earlier versions, from the text
 * between its two highlights: neither drawn nor clickable, the arc between
 * the highlights shows it. Only the verb mode gives a link its own passage.
 */
const isDeducedLinkPassage = (a: Annotation) => a.kind === 'link' && a.quads.length > 0 && !a.relationWords;

// ─── Single page ─────────────────────────────────────────────

interface PageProps {
  /** A PDF page, or the single sheet of a text document (`blocks`). */
  doc: PDFDocumentProxy | null;
  blocks: TextBlock[] | null;
  /** Text documents: called with the sheet height (page units) when it changes. */
  onHeight?: (height: number) => void;
  pageNumber: number;
  size: PageInfo;
  scale: number;
  root: HTMLElement;
  highlights: Highlight[];
  arcs: LinkArcInfo[];
  /** Search results on this page; `current` is the one selected in the bar. */
  searchHits: { start: number; end: number; current: boolean }[];
  /** Pre-highlighting suggestions on this page, drawn faintly under the text. */
  suggestions: PageSuggestion[];
  /** Zone reading: a rectangle drawn on the page is sent for OCR. */
  zoneMode: boolean;
  onZone: (page: number, rect: Rect, client: Rect) => void;
  /** OCR result of a scanned page: it replaces pdf.js' text layer. */
  ocr: OcrPage | null;
  /** Possible links (co-occurrence setting), marked in the left margin. */
  marks: PageMark[];
  onMark: (key: string) => void;
}

interface PageMark {
  key: string;
  quads: Quad[];
  title: string;
}

/** Text of a page as pdf.js lays it out, with where each text item starts. */
interface PageText {
  text: string;
  /** Offset of each item in `text`. */
  starts: number[];
  /** Top of each item, page units at scale 1. */
  ys: number[];
}

function highlightStyle(hl: Highlight): ReactTypes.CSSProperties {
  // Highlighter look: tinted background multiplied over the page.
  const tint = `color-mix(in srgb, ${hl.color} 38%, transparent)`;
  if (hl.kind === 'property') {
    return { background: `color-mix(in srgb, ${hl.color} 14%, transparent)`, borderBottom: `2px solid ${hl.color}` };
  }
  if (hl.kind === 'link') {
    return { borderBottom: `2px dotted ${hl.color}` };
  }
  if (hl.kind === 'location') {
    return { background: `color-mix(in srgb, ${hl.color} 14%, transparent)`, borderBottom: `3px double ${hl.color}` };
  }
  if (hl.kind === 'event') {
    return { background: `color-mix(in srgb, ${hl.color} 14%, transparent)`, borderBottom: `2px dashed ${hl.color}` };
  }
  return { background: tint, mixBlendMode: 'multiply' };
}

/** Outline of the highlight whose element is shown in the sheet. */
function selectedStyle(hl: Highlight): ReactTypes.CSSProperties {
  return hl.selected ? { outline: `2px solid ${hl.color}`, outlineOffset: 1, borderRadius: 2 } : {};
}

interface PageSuggestion {
  key: string;
  start: number;
  end: number;
  color: string;
}

function PdfPage({ doc, blocks, onHeight, pageNumber, size, scale, root, highlights, arcs, searchHits, suggestions, zoneMode, onZone, ocr, marks, onMark }: PageProps) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const pageRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [near, setNear] = React.useState(false);
  /** Bumped when the text layer has been (re)built, to place search boxes. */
  const [textVersion, setTextVersion] = React.useState(0);
  const [searchBoxes, setSearchBoxes] = React.useState<{ rect: Rect; current: boolean }[]>([]);
  const [suggestionBoxes, setSuggestionBoxes] = React.useState<{ key: string; rect: Rect; color: string }[]>([]);
  /** Rectangle being drawn in zone mode, in page CSS pixels. */
  const [drawing, setDrawing] = React.useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const scaleRef = React.useRef(scale);
  scaleRef.current = scale;

  React.useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    if (blocks) {
      // A text sheet is always rendered; its height follows its content and the zoom.
      setNear(true);
      const observer = new ResizeObserver(() => {
        onHeight?.(el.clientHeight / scaleRef.current);
        setTextVersion((v) => v + 1);
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
    // Pages within about one screen of the viewport stay rendered.
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: '100% 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root, blocks]);

  React.useEffect(() => {
    const textDiv = textRef.current;
    if (!blocks || !textDiv) return;
    renderTextBlocks(textDiv, blocks);
    const unguard = guardTextSelection(textDiv);
    setTextVersion((v) => v + 1);
    return () => {
      unguard();
      textDiv.replaceChildren();
    };
  }, [blocks]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const textDiv = textRef.current;
    if (!doc || !canvas || !textDiv) return;
    if (!near) {
      // Free the bitmap of pages far from the viewport.
      canvas.width = 0;
      canvas.height = 0;
      textDiv.replaceChildren();
      return;
    }
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let textLayer: { cancel: () => void; render: () => Promise<unknown> } | null = null;
    let unguard: (() => void) | null = null;
    (async () => {
      const { pdfjs } = await import('../services/pdfjs.ts');
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      renderTask = page.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      textDiv.replaceChildren();
      delete textDiv.dataset.ocr;
      if (ocr) {
        // Scanned page: selectable text from the OCR word boxes.
        renderOcrLayer(textDiv, ocr, scale);
        await renderTask.promise;
      } else {
        textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport });
        await Promise.all([renderTask.promise, textLayer.render()]);
      }
      if (cancelled) return;
      unguard = guardTextSelection(textDiv);
      setTextVersion((v) => v + 1);
    })().catch((err: unknown) => {
      if (!cancelled && (err as { name?: string })?.name !== 'RenderingCancelledException') {
        console.error('MarkNeurone: page rendering failed', pageNumber, err);
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
      unguard?.();
    };
  }, [near, scale, doc, pageNumber, ocr]);

  // Search results are framed from the rendered text layer, at the current zoom.
  React.useEffect(() => {
    const textDiv = textRef.current;
    if (!textDiv || !near || !searchHits.length || !textDiv.childNodes.length) {
      setSearchBoxes([]);
      return;
    }
    setSearchBoxes(searchHits.flatMap((hit) => rangeBoxes(textDiv, hit.start, hit.end).map((rect) => ({ rect, current: hit.current }))));
  }, [searchHits, textVersion, near, scale]);

  React.useEffect(() => {
    const textDiv = textRef.current;
    if (!textDiv || !near || !suggestions.length || !textDiv.childNodes.length) {
      setSuggestionBoxes([]);
      return;
    }
    setSuggestionBoxes(suggestions.flatMap((s) => rangeBoxes(textDiv, s.start, s.end).map((rect, i) => ({ key: `${s.key}-${i}`, rect, color: s.color }))));
  }, [suggestions, textVersion, near, scale]);

  const width = Math.floor(size.width * scale);
  const height = Math.floor(size.height * scale);
  return h(
    'div',
    {
      ref: pageRef,
      'data-page-number': pageNumber,
      className: 'mn-page relative bg-white border border-border-default',
      style: {
        width,
        // A text sheet grows with its content.
        height: blocks ? undefined : height,
        margin: `0 auto ${PAGE_GAP}px`,
        '--scale-factor': scale,
      } as ReactTypes.CSSProperties,
    },
    blocks ? null : h('canvas', { ref: canvasRef, style: { width, height, display: 'block' } }),
    // Below the (transparent) text layer, so that text stays selectable.
    h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } },
      highlights.flatMap((hl) => {
        const transform = scaleTransform(size.transform, scale);
        return hl.quads.map((quad, i) => {
          const r = pdfQuadToViewport(quad, transform);
          return h('div', {
            key: `${hl.id}-${i}`,
            'data-annotation-id': hl.id,
            style: { position: 'absolute', left: r.left, top: r.top, width: r.right - r.left, height: r.bottom - r.top, ...highlightStyle(hl), ...selectedStyle(hl) },
          });
        });
      })),
    suggestionBoxes.length
      ? h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } },
          suggestionBoxes.map((box) =>
            h('div', {
              key: box.key,
              'data-suggestion': '',
              style: {
                position: 'absolute',
                left: box.rect.left - 1,
                top: box.rect.top - 1,
                width: box.rect.right - box.rect.left + 2,
                height: box.rect.bottom - box.rect.top + 2,
                background: `color-mix(in srgb, ${box.color} 12%, transparent)`,
                outline: `1px dashed color-mix(in srgb, ${box.color} 70%, transparent)`,
                borderRadius: 2,
              },
            })))
      : null,
    searchBoxes.length
      ? h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } },
          searchBoxes.map((box, i) =>
            h('div', {
              key: i,
              'data-search-current': box.current || undefined,
              style: {
                position: 'absolute',
                left: box.rect.left - 1,
                top: box.rect.top - 1,
                width: box.rect.right - box.rect.left + 2,
                height: box.rect.bottom - box.rect.top + 2,
                background: box.current ? 'rgba(249, 115, 22, 0.35)' : 'rgba(250, 204, 21, 0.35)',
                outline: box.current ? '2px solid rgb(249, 115, 22)' : undefined,
                borderRadius: 2,
              },
            })))
      : null,
    arcs.length
      ? h('svg', {
          width,
          height,
          style: { position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' },
          'aria-hidden': true,
        },
        arcs.map((arc) => {
          const transform = scaleTransform(size.transform, scale);
          const { d, head } = linkArc(pdfQuadToViewport(arc.from, transform), pdfQuadToViewport(arc.to, transform));
          // CSS variables only resolve in style, not in SVG presentation attributes.
          const stroke = { stroke: arc.color, fill: 'none', strokeWidth: arc.emphasis ? 1.6 : 1.2, opacity: arc.emphasis ? 0.95 : 0.55, strokeLinecap: 'round' as const };
          return h('g', { key: arc.id, 'data-link-annotation-id': arc.id },
            h('path', { d, style: { ...stroke, strokeDasharray: '2 3' } }),
            h('path', { d: head, style: { ...stroke, strokeLinejoin: 'round' as const } }));
        }))
      : null,
    h('div', { ref: textRef, className: blocks ? 'textLayer mn-flow' : 'textLayer' }),
    // Possible links: a thin bar in the left margin over the lines of both passages.
    marks.length
      ? h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 } },
          marks.map((mark, i) => {
            const transform = scaleTransform(size.transform, scale);
            const rects = mark.quads.map((q) => pdfQuadToViewport(q, transform));
            if (!rects.length) return null;
            const top = Math.min(...rects.map((r) => r.top));
            const bottom = Math.max(...rects.map((r) => r.bottom));
            return h('button', {
              key: mark.key,
              type: 'button',
              'data-cooccurrence': '',
              title: mark.title,
              'aria-label': mark.title,
              onClick: () => onMark(mark.key),
              className: 'absolute rounded-sm bg-accent/40 hover:bg-accent',
              style: { left: 3 + i * 6, top, width: 3, height: Math.max(bottom - top, 8), pointerEvents: 'auto', cursor: 'pointer' },
            });
          }))
      : null,
    zoneMode ? zoneLayer() : null,
  );

  // Above the text layer while the zone tool is on: drag draws the rectangle.
  function zoneLayer() {
    const at = (e: ReactTypes.PointerEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const rect = drawing
      ? { left: Math.min(drawing.x0, drawing.x1), top: Math.min(drawing.y0, drawing.y1), right: Math.max(drawing.x0, drawing.x1), bottom: Math.max(drawing.y0, drawing.y1) }
      : null;
    return h('div', {
      'data-zone-layer': '',
      style: { position: 'absolute', inset: 0, zIndex: 3, cursor: 'crosshair' },
      onPointerDown: (e: ReactTypes.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const p = at(e);
        setDrawing({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      },
      onPointerMove: (e: ReactTypes.PointerEvent) => {
        if (!drawing) return;
        const p = at(e);
        setDrawing({ ...drawing, x1: p.x, y1: p.y });
      },
      onPointerUp: (e: ReactTypes.PointerEvent) => {
        if (!drawing || !rect) return;
        setDrawing(null);
        // A click without drag is not a zone.
        if (rect.right - rect.left < 6 || rect.bottom - rect.top < 6) return;
        const origin = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onZone(pageNumber, rect, { left: origin.left + rect.left, top: origin.top + rect.top, right: origin.left + rect.right, bottom: origin.top + rect.bottom });
      },
    },
    rect
      ? h('div', {
          style: {
            position: 'absolute',
            left: rect.left,
            top: rect.top,
            width: rect.right - rect.left,
            height: rect.bottom - rect.top,
            outline: '1px dashed var(--color-accent)',
            background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
          },
        })
      : null);
  }
}

// ─── Viewer ──────────────────────────────────────────────────

interface ViewerProps {
  dossierId: string;
  asset: DocumentAsset;
  /** Passage to scroll to and select, e.g. clicked in ZN's side panel. */
  focus?: { annotationId: string; target: object } | null;
  /** Hides the reader, to look at the canvas. */
  onMinimize: () => void;
}

type Zoom = number | 'auto' | 'fit';

const NO_HIGHLIGHTS: Highlight[] = [];
const NO_ARCS: LinkArcInfo[] = [];
const NO_SEARCH_HITS: { start: number; end: number; current: boolean }[] = [];
const NO_SUGGESTIONS: PageSuggestion[] = [];
const NO_MARKS: PageMark[] = [];
const SUGGESTION_COLOR = 'var(--color-text-tertiary)';

/**
 * Image of quads (page units) from the page as rendered on screen, with a
 * small margin, as a PNG data URL. Null when the page has no canvas.
 */
function cropPage(root: HTMLElement, page: number, quads: Quad[], size: PageInfo | undefined, scale: number): string | null {
  const canvas = root.querySelector(`.mn-page[data-page-number="${page}"] canvas`) as HTMLCanvasElement | null;
  if (!canvas || !size || !quads.length || !canvas.width) return null;
  const ratio = canvas.width / (size.width * scale);
  const rects = quads.map((q) => pdfQuadToViewport(q, size.transform));
  const margin = 4;
  const left = Math.max(0, (Math.min(...rects.map((r) => r.left)) * scale - margin) * ratio);
  const top = Math.max(0, (Math.min(...rects.map((r) => r.top)) * scale - margin) * ratio);
  const right = Math.min(canvas.width, (Math.max(...rects.map((r) => r.right)) * scale + margin) * ratio);
  const bottom = Math.min(canvas.height, (Math.max(...rects.map((r) => r.bottom)) * scale + margin) * ratio);
  if (right <= left || bottom <= top) return null;
  const out = document.createElement('canvas');
  out.width = Math.round(right - left);
  out.height = Math.round(bottom - top);
  out.getContext('2d')!.drawImage(canvas, left, top, right - left, bottom - top, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/** An element that holds a document and is named after its file: not a name to look for in texts. */
function isDocumentCarrier(el: ZnElement, assets: { id: string; filename: string }[]): boolean {
  const label = el.label.trim().toLowerCase();
  return (el.assetIds ?? []).some((id) => {
    const name = assets.find((a) => a.id === id)?.filename.toLowerCase();
    return !!name && (label === name || label === name.replace(/\.[^.]+$/, ''));
  });
}
/** Pages are recognized at 300 dpi, the resolution the bench was run at. */
const OCR_SCALE = 300 / 72;

export function PdfViewer({ dossierId, asset, focus, onMinimize }: ViewerProps) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const { ZoomIn, ZoomOut, MoveHorizontal, TriangleAlert } = api.icons;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });

  const [opened, setOpened] = React.useState<OpenedPdf | null>(null);
  /** Text document (DOCX, ODT, TXT, Markdown), shown as one continuous sheet. */
  const [textDoc, setTextDoc] = React.useState<{ blocks: TextBlock[]; text: string } | null>(null);
  /** Bumped when the sheet of a text document is laid out again. */
  const [layoutVersion, setLayoutVersion] = React.useState(0);
  const textFormat = textFormatOf(asset);
  const ready = !!opened || !!textDoc;
  const [sizes, setSizes] = React.useState<PageInfo[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<TextLayerReport | null>(null);
  const [zoom, setZoom] = React.useState<Zoom>('auto');
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null);
  const [rootWidth, setRootWidth] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageTexts, setPageTexts] = React.useState<PageText[]>([]);
  // ─── OCR ──
  const [ocrPages, setOcrPages] = React.useState<Record<string, OcrPage>>({});
  const [ocrLoaded, setOcrLoaded] = React.useState(false);
  const [ocrPaused, setOcrPaused] = React.useState(false);
  /** Asking to confirm the deletion of the recognized text. */
  const [ocrClearing, setOcrClearing] = React.useState(false);
  const [ocrCurrent, setOcrCurrent] = React.useState<number | null>(null);
  /** Progress of the page being recognized, in percent. */
  const [ocrPercent, setOcrPercent] = React.useState(0);
  const [ocrFailed, setOcrFailed] = React.useState<number[]>([]);
  // ─── Search ──
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [hitIndex, setHitIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  /** Selection waiting for a gesture (E, P, V). */
  const [pending, setPending] = React.useState<Passage | null>(null);
  /** Zone reading tool: the next rectangle drawn on a page is read by OCR. */
  const [zoneMode, setZoneMode] = React.useState(false);
  /** Zone being read, shown on its page until the reading is done. */
  const [zoneBusy, setZoneBusy] = React.useState<{ page: number; quad: Quad } | null>(null);
  /** Gesture being filled in the sheet. */
  const [draft, setDraft] = React.useState<Draft | null>(null);
  /** Element shown in the sheet; with none, the sheet lists the document's elements. */
  const [activeElementId, setActiveElementId] = React.useState<string | null>(null);
  /** Selected highlights, in click order; Ctrl+click adds one (to link two elements). */
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const selectedAnnotationId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;
  const setSelectedAnnotationId = React.useCallback((id: string | null) => setSelectedIds(id ? [id] : []), []);
  const [menu, setMenu] = React.useState<{ x: number; y: number; header?: string; sections: MenuItem[][] } | null>(null);
  /** Link shown in the sheet instead of an element. */
  const [activeLinkId, setActiveLinkId] = React.useState<string | null>(null);
  /** Orphan highlight whose reattachment card is shown in the sheet. */
  const [activeOrphanId, setActiveOrphanId] = React.useState<string | null>(null);
  const showElement = React.useCallback((id: string | null) => {
    setActiveLinkId(null);
    setActiveOrphanId(null);
    setActiveElementId(id);
  }, []);
  const showLink = React.useCallback((id: string) => {
    setActiveOrphanId(null);
    setActiveLinkId(id);
  }, []);
  const [linkDraft, setLinkDraft] = React.useState<LinkDraft | null>(null);

  const onSheetHeight = React.useCallback((height: number) => {
    setSizes((s) => (s.length === 1 && Math.abs(s[0].height - height) > 0.5 ? [{ ...s[0], height }] : s));
    setLayoutVersion((v) => v + 1);
  }, []);

  React.useSyncExternalStore(subscribe, getVersion);
  // Settings changed in the settings window: profile and OCR option follow.
  const settingsVersion = React.useSyncExternalStore(subscribeSettings, getSettingsVersion);
  const annotations = getAnnotations(dossierId, asset.hash);

  // Reference of the document, written in sources instead of the file name.
  const [reference, setReference] = React.useState('');
  const [referenceDraft, setReferenceDraft] = React.useState<string | null>(null);
  const referenceCancelled = React.useRef(false);
  /** Sources to rewrite after the reference changed, until the user answers. */
  const [relabel, setRelabel] = React.useState<RelabelPlan | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setReference('');
    setReferenceDraft(null);
    setRelabel(null);
    loadReference(dossierId, asset.hash)
      .then((value) => {
        if (!cancelled) setReference(value);
      })
      .catch((err: unknown) => console.error('MarkNeurone: cannot load the document reference', err));
    return () => {
      cancelled = true;
    };
  }, [dossierId, asset.id, asset.hash]);
  const docCtx = React.useMemo(() => ({ dossierId, asset, reference }), [dossierId, asset, reference]);
  const elements: ZnElement[] = api.stores.useDossierStore((s: { elements: ZnElement[] }) => s.elements);
  const links: ZnLink[] = api.stores.useDossierStore((s: { links: ZnLink[] }) => s.links);

  React.useEffect(() => {
    loadAnnotations(dossierId, asset.hash).catch((err: unknown) => {
      console.error('MarkNeurone: cannot load annotations', err);
      api.toast.error(t('annotations_load_error'));
    });
  }, [dossierId, asset.hash]);

  React.useEffect(ensureTextLayerStyle, []);

  // Load the document, then its page sizes; text layer analysis follows in the background.
  React.useEffect(() => {
    let cancelled = false;
    let current: OpenedPdf | null = null;
    setOpened(null);
    setTextDoc(null);
    setSizes([]);
    setReport(null);
    setError(null);
    setPageTexts([]);
    (async () => {
      const file = await api.fileService.getAssetFile(asset);
      const data = new Uint8Array(await file.arrayBuffer());
      if (textFormat) {
        const { readTextDocument } = await import('../services/textDocuments.ts');
        const blocks = await readTextDocument(data, textFormat);
        if (cancelled) return;
        if (!blocks.length) {
          setError(t('viewer_text_empty'));
          return;
        }
        const text = blocksText(blocks);
        setSizes([{ width: TEXT_SHEET_WIDTH, height: 842, transform: [1, 0, 0, 1, 0, 0] }]);
        setTextDoc({ blocks, text });
        // Block positions are measured on the rendered sheet (see scrollToHit).
        setPageTexts([{ text, starts: [], ys: [] }]);
        return;
      }
      const { openPdf } = await import('../services/pdfjs.ts');
      current = await openPdf(data);
      if (cancelled) return;
      const pageSizes: PageInfo[] = [];
      for (let n = 1; n <= current.doc.numPages; n++) {
        const vp = (await current.doc.getPage(n)).getViewport({ scale: 1 });
        pageSizes.push({ width: vp.width, height: vp.height, transform: vp.transform as Transform });
      }
      if (cancelled) return;
      setSizes(pageSizes);
      setOpened(current);
      const chars: number[] = [];
      const texts: PageText[] = [];
      for (let n = 1; n <= current.doc.numPages; n++) {
        const content = await (await current.doc.getPage(n)).getTextContent();
        if (cancelled) return;
        const items = content.items as { str?: string; hasEOL?: boolean; transform?: number[] }[];
        chars.push(countTextChars(items));
        // Built like the text layer: each item's string, a line break after EOL items.
        let text = '';
        const starts: number[] = [];
        const ys: number[] = [];
        const transform = pageSizes[n - 1].transform;
        for (const it of items) {
          if (typeof it.str !== 'string') continue;
          starts.push(text.length);
          ys.push(applyTransform(transform, it.transform?.[4] ?? 0, it.transform?.[5] ?? 0)[1]);
          text += it.str + (it.hasEOL ? '\n' : '');
        }
        texts.push({ text, starts, ys });
      }
      setReport(analyseTextLayer(chars));
      setPageTexts(texts);
    })().catch((err: unknown) => {
      if (!cancelled) {
        console.error('MarkNeurone: cannot open document', err);
        setError(t('viewer_error'));
      }
    });
    return () => {
      cancelled = true;
      current?.close();
    };
  }, [asset.id]);

  React.useEffect(() => {
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setRootWidth(entry.contentRect.width);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [root]);

  const maxWidth = sizes.reduce((m, s) => Math.max(m, s.width), 0);
  const fitScale = maxWidth && rootWidth ? (rootWidth - 2 * PADDING) / maxWidth : 1;
  const scale =
    zoom === 'fit' ? fitScale : zoom === 'auto' ? Math.min(fitScale, AUTO_MAX_ZOOM * PDF_TO_CSS) : zoom * PDF_TO_CSS;
  const percent = Math.round((scale / PDF_TO_CSS) * 100);

  const onScroll = React.useCallback(() => {
    if (!root) return;
    const probe = root.scrollTop + root.clientHeight / 3;
    let top = PADDING;
    let page = 1;
    for (let i = 0; i < sizes.length; i++) {
      const bottom = top + Math.floor(sizes[i].height * scale) + PAGE_GAP;
      if (probe < bottom) {
        page = i + 1;
        break;
      }
      top = bottom;
      page = i + 1;
    }
    setCurrentPage(page);
  }, [root, sizes, scale]);

  const stepZoom = (direction: 1 | -1) => {
    const now = scale / PDF_TO_CSS;
    const next = direction > 0 ? ZOOM_STEPS.find(z => z > now + 0.01) : [...ZOOM_STEPS].reverse().find(z => z < now - 0.01);
    if (next !== undefined) setZoom(next);
  };

  // Ctrl+wheel (or a trackpad pinch) zooms the document, as in a browser,
  // keeping the point under the pointer in place. A native listener: React's
  // wheel events are passive and cannot stop the page zoom.
  const wheelZoom = React.useRef({ stepZoom, scale, delta: 0 });
  wheelZoom.current.stepZoom = stepZoom;
  wheelZoom.current.scale = scale;
  /** Point to keep under the pointer once the new zoom is laid out. */
  const zoomAnchor = React.useRef<{ x: number; y: number; contentX: number; contentY: number; from: number } | null>(null);
  React.useEffect(() => {
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const w = wheelZoom.current;
      // A pinch sends many small deltas: one step per notch of a mouse wheel.
      w.delta += e.deltaMode === 0 ? e.deltaY : e.deltaY * 40;
      if (Math.abs(w.delta) < 40) return;
      const box = root.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      zoomAnchor.current = { x, y, contentX: root.scrollLeft + x, contentY: root.scrollTop + y, from: w.scale };
      w.stepZoom(w.delta < 0 ? 1 : -1);
      w.delta = 0;
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [root]);
  React.useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    if (!root || !anchor || anchor.from === scale) return;
    zoomAnchor.current = null;
    const ratio = scale / anchor.from;
    root.scrollLeft = PADDING + (anchor.contentX - PADDING) * ratio - anchor.x;
    root.scrollTop = PADDING + (anchor.contentY - PADDING) * ratio - anchor.y;
  }, [root, scale]);

  // ─── Highlights ──────────────────────────────────────────

  /**
   * Annotations as drawn. On a text document the sheet reflows (zoom, fonts of
   * the machine), so highlight boxes come from the text offsets, measured on
   * the rendered sheet; stored quads are only used on a PDF.
   */
  const placed = React.useMemo<Annotation[]>(() => {
    if (!textDoc || !root) return annotations;
    const layer = root.querySelector('.mn-page[data-page-number="1"] .textLayer') as HTMLElement | null;
    if (!layer || !layer.childNodes.length) return annotations;
    return annotations.map((a) => {
      if (!a.textRange || a.textRange[1] > textDoc.text.length) return a;
      const quads = rangeBoxes(layer, a.textRange[0], a.textRange[1]).map(
        (r): Quad => [r.left / scale, r.top / scale, r.right / scale, r.bottom / scale],
      );
      return { ...a, quads };
    });
  }, [annotations, textDoc, root, layoutVersion, scale]);

  /** Highlights a click can hit: what is drawn. */
  const clickable = React.useMemo(() => placed.filter((a) => !isDeducedLinkPassage(a)), [placed]);

  // Tag colors can change from the sheet or from ZN: highlights follow.
  const tagSetMap = api.stores.useTagSetStore((s: { tagSets: Map<string, ZnTagSet> }) => s.tagSets);
  const highlightsByPage = React.useMemo(() => {
    const tagSets: ZnTagSet[] = api.stores.useTagSetStore.getState().getAll();
    const tagColor = (tag: string | undefined) =>
      tag ? tagSets.find((ts) => ts.name.toLowerCase() === tag.toLowerCase())?.defaultVisual.color ?? null : null;
    const byPage = new Map<number, Highlight[]>();
    for (const a of placed) {
      if (a.status === 'rejected') continue;
      if (isDeducedLinkPassage(a)) continue;
      const target = a.targetId ? elements.find((el) => el.id === a.targetId) : undefined;
      let color: string;
      if (a.kind === 'link') color = links.some((l) => l.id === a.targetId) ? LINK_COLOR : ORPHAN_COLOR;
      else if (!target) color = ORPHAN_COLOR;
      else if (a.kind === 'event') color = tagColor('Événement') ?? EVENT_FALLBACK_COLOR;
      else color = tagColor(target.tags[0]) ?? 'var(--color-accent)';
      const list = byPage.get(a.page) ?? [];
      list.push({ id: a.id, quads: a.quads, color, kind: a.kind, selected: selectedIds.includes(a.id) });
      byPage.set(a.page, list);
    }
    // The passage being qualified stays visible while the form has the focus
    // (the browser selection is gone by then).
    if (draft) {
      const { page, quads, textRange } = draft.passage;
      const layer = textDoc && root ? (root.querySelector(`.mn-page[data-page-number="${page}"] .textLayer`) as HTMLElement | null) : null;
      const shown = layer && textRange
        ? rangeBoxes(layer, textRange[0], textRange[1]).map((r): Quad => [r.left / scale, r.top / scale, r.right / scale, r.bottom / scale])
        : quads;
      const list = byPage.get(page) ?? [];
      list.push({ id: 'draft', quads: shown, color: 'var(--color-accent)', kind: draft.gesture, selected: true });
      byPage.set(page, list);
    }
    if (zoneBusy) {
      const list = byPage.get(zoneBusy.page) ?? [];
      list.push({ id: 'zone', quads: [zoneBusy.quad], color: 'var(--color-accent)', kind: 'event', selected: false });
      byPage.set(zoneBusy.page, list);
    }
    return byPage;
  }, [placed, elements, links, selectedIds, tagSetMap, draft, textDoc, root, layoutVersion, scale, zoneBusy]);

  // Keep annotations on the graph as it changes (merge, deletion, undo,
  // collaborators). Nothing is rewritten before the dossier is fully loaded.
  const dossierReady = api.stores.useDossierStore(
    (s: { currentDossier: { id: string } | null; isLoading: boolean }) => s.currentDossier?.id === dossierId && !s.isLoading,
  );
  React.useEffect(() => {
    if (!dossierReady || !annotations.length || (!elements.length && !links.length)) return;
    const { annotations: next, changed, moved } = reconcile(annotations, { elements, links });
    if (!changed) return;
    // The sheet follows a merged element to its target.
    setActiveElementId((id) => (id && moved[id] ? moved[id] : id));
    writeDocument(dossierId, asset.hash, next).catch((err: unknown) => {
      console.error('MarkNeurone: cannot update annotations after a graph change', err);
    });
  }, [dossierReady, annotations, elements, links]);

  const sheetElementId = activeElementId;

  // Links between two highlights of one page are drawn as arcs, for the current selection only.
  const arcsByPage = React.useMemo(() => {
    const byId = new Map(placed.map((a) => [a.id, a]));
    const selected = selectedAnnotationId ? byId.get(selectedAnnotationId) : undefined;
    /** Highlight of an element: the recorded one, else the nearest on the link's page. */
    const endOf = (link: Annotation, index: 0 | 1): Annotation | undefined => {
      const recorded = link.linkAnchors?.[index];
      if (recorded && byId.has(recorded)) return byId.get(recorded);
      const elementId = link.linkEnds?.[index];
      const at = link.textRange?.[0] ?? 0;
      return placed
        .filter((a) => a.kind === 'element' && a.targetId === elementId && a.page === link.page && a.quads.length)
        .sort((a, b) => Math.abs((a.textRange?.[0] ?? 0) - at) - Math.abs((b.textRange?.[0] ?? 0) - at))[0];
    };
    const byPage = new Map<number, LinkArcInfo[]>();
    for (const a of placed) {
      if (a.kind !== 'link' || !a.linkEnds || !links.some((l) => l.id === a.targetId)) continue;
      // The direction can be swapped in the sheet: follow the link as it is now.
      const reversed = links.find((l) => l.id === a.targetId)?.fromId === a.linkEnds[1];
      const from = endOf(a, reversed ? 1 : 0);
      const to = endOf(a, reversed ? 0 : 1);
      if (!from || !to || from.page !== to.page || !from.quads.length || !to.quads.length) continue;
      // Shown only for what the user is looking at: the link, or one of its ends.
      const visible =
        (!!selected && (selected.id === a.id || selected.id === from.id || selected.id === to.id)) ||
        activeLinkId === a.targetId ||
        (!activeLinkId && !!sheetElementId && a.linkEnds.includes(sheetElementId));
      if (!visible) continue;
      const list = byPage.get(from.page) ?? [];
      list.push({ id: a.id, from: from.quads[0], to: to.quads[0], color: 'var(--color-accent)', emphasis: activeLinkId === a.targetId || selected?.id === a.id });
      byPage.set(from.page, list);
    }
    return byPage;
  }, [placed, links, selectedAnnotationId, activeLinkId, sheetElementId]);


  // ─── Selection and clicks ────────────────────────────────

  const elementOf = (a: Annotation): string | null => (a.kind !== 'link' && a.targetId ? a.targetId : null);

  /**
   * Link draft between two elements. Nothing is deduced from the text between
   * their passages: the label is typed, and the link shows as the arc between
   * both highlights.
   */
  const buildLinkDraft = (fromId: string, from: Annotation | null, toId: string, to: Annotation): LinkDraft => {
    const name = (id: string) => elements.find((el) => el.id === id)?.label ?? '';
    return {
      fromId,
      toId,
      place: { page: from?.page ?? to.page, text: `${name(fromId)} → ${name(toId)}`, ...(to.context ? { context: to.context } : {}) },
      label: '',
      anchorsByElement: Object.fromEntries([...(from ? [from] : []), to].filter((a) => a.targetId).map((a) => [a.targetId!, a.id])),
    };
  };

  const nameOf = (id: string) => elements.find((el) => el.id === id)?.label ?? '';

  /** Two highlights of distinct elements selected with Ctrl+click, in click order. */
  const linkPair = React.useMemo(() => {
    const picked = selectedIds
      .map((id) => annotations.find((a) => a.id === id))
      .filter((a): a is Annotation => !!a && !!elementOf(a) && elements.some((el) => el.id === elementOf(a)));
    const first = picked[0];
    const last = [...picked].reverse().find((a) => elementOf(a) !== (first && elementOf(first)));
    return first && last ? { from: first, to: last } : null;
  }, [selectedIds, annotations, elements]);

  /**
   * Verb mode: the highlighted words of a relation, between the nearest
   * elements highlighted before and after them in the sentence. Either end
   * may be missing; the form lets the user set or correct both.
   */
  const linkFromWords = (passage: Passage) => {
    const ends = passage.textRange && passage.sentenceRange
      ? verbEnds(elementHighlights(placed, passage.page), passage.textRange, passage.sentenceRange)
      : { from: null, to: null };
    setPending(null);
    setDraft(null);
    setLinkDraft({
      fromId: ends.from?.elementId ?? '',
      toId: ends.to?.elementId ?? '',
      place: { passage },
      label: trimPunctuation(passage.text),
      anchorsByElement: Object.fromEntries([ends.from, ends.to].filter((x) => x !== null).map((x) => [x!.elementId, x!.annotation.id])),
    });
  };

  // ─── Possible links (co-occurrence, off by default) ───────
  const [dismissedPairs, setDismissedPairs] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    let cancelled = false;
    setDismissedPairs(new Set());
    loadDismissedPairs(dossierId, asset.hash)
      .then((pairs) => {
        if (!cancelled) setDismissedPairs(pairs);
      })
      .catch((err: unknown) => console.error('MarkNeurone: cannot load dismissed links', err));
    return () => {
      cancelled = true;
    };
  }, [dossierId, asset.hash]);
  const openPossibleLink = (key: string, page: number) => {
    const c = possibleLinks.find((x) => x.key === key && x.page === page);
    if (!c) return;
    setPending(null);
    setDraft(null);
    setLinkDraft({ ...buildLinkDraft(c.from.targetId!, c.from, c.to.targetId!, c.to), dismissKey: key });
  };
  const dismissPair = (key: string) => {
    const next = new Set(dismissedPairs).add(key);
    setDismissedPairs(next);
    setLinkDraft(null);
    saveDismissedPairs(dossierId, asset.hash, next).catch((err: unknown) => console.error('MarkNeurone: cannot save dismissed links', err));
  };

  const openLinkDraft = (from: Annotation, to: Annotation) => {
    setPending(null);
    setDraft(null);
    setLinkDraft(buildLinkDraft(elementOf(from)!, from, elementOf(to)!, to));
  };

  /** Click on a highlight: select it (Ctrl/Cmd adds to the selection) and show its sheet. */
  const selectHighlight = (hit: Annotation, additive: boolean) => {
    if (additive) {
      setSelectedIds((ids) => (ids.includes(hit.id) ? ids.filter((id) => id !== hit.id) : [...ids, hit.id]));
      return;
    }
    setSelectedAnnotationId(hit.id);
    if (hit.orphan) setActiveOrphanId(hit.id);
    else if (hit.kind === 'link' && hit.targetId) showLink(hit.targetId);
    else if (hit.targetId) showElement(hit.targetId);
  };

  /**
   * Reads a rectangle drawn on a page: rendered at 300 dpi, cleaned (without
   * deskew, unreliable on a few words), recognized. The passage keeps what
   * was read; the form shows the image so that the user corrects it, or
   * types a handwritten passage the OCR could not read.
   */
  const onZone = (pageNumber: number, rect: Rect, client: Rect) => {
    setZoneMode(false);
    void readArea(pageNumber, [{ left: rect.left / scale, top: rect.top / scale, right: rect.right / scale, bottom: rect.bottom / scale }], client);
  };

  /** Reads the rectangle of a selection again, at high resolution: same passage, better reading. */
  const rereadSelection = (passage: Passage) => {
    const size = sizes[passage.page - 1];
    if (!size || !passage.quads.length) return;
    // One rectangle per line of the selection, with a small margin.
    const margin = 2;
    const parts = passage.quads.map((q) => {
      const r = pdfQuadToViewport(q, size.transform);
      return { left: Math.max(0, r.left - margin), top: Math.max(0, r.top - margin), right: Math.min(size.width, r.right + margin), bottom: Math.min(size.height, r.bottom + margin) };
    });
    setPending(null);
    void readArea(passage.page, parts, passage.clientBox, {
      quads: passage.quads,
      ...(passage.textRange ? { textRange: passage.textRange } : {}),
      ...(passage.origin ? { origin: passage.origin } : {}),
      ...(passage.suggestion ? { suggestion: passage.suggestion } : {}),
    });
  };

  /**
   * OCR of rectangles of a page (page units at scale 1): a framed zone, or the
   * lines of a selection, each read on its own so that a selection over two
   * lines does not take in the rest of them.
   */
  const readArea = async (pageNumber: number, parts: Rect[], client: Rect, keep: Partial<Passage> = {}) => {
    const size = sizes[pageNumber - 1];
    if (!opened || !size || !parts.length) return;
    const unit = {
      left: Math.min(...parts.map((r) => r.left)),
      top: Math.min(...parts.map((r) => r.top)),
      right: Math.max(...parts.map((r) => r.right)),
      bottom: Math.max(...parts.map((r) => r.bottom)),
    };
    const quad = viewportRectToPdf(unit, size.transform) as Quad;
    setZoneBusy({ page: pageNumber, quad });
    try {
      const engine = await import('../services/ocrEngine.ts');
      const page = await opened.doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((unit.right - unit.left) * OCR_SCALE));
      canvas.height = Math.max(1, Math.round((unit.bottom - unit.top) * OCR_SCALE));
      await page.render({ canvas, viewport, transform: [1, 0, 0, 1, -unit.left * OCR_SCALE, -unit.top * OCR_SCALE] }).promise;
      const image = canvas.toDataURL('image/png');
      const texts: string[] = [];
      const lines: { t: string; c: number }[][] = [];
      let sum = 0;
      let count = 0;
      for (const part of parts) {
        const piece = document.createElement('canvas');
        const x = Math.round((part.left - unit.left) * OCR_SCALE);
        const y = Math.round((part.top - unit.top) * OCR_SCALE);
        piece.width = Math.max(1, Math.round((part.right - part.left) * OCR_SCALE));
        piece.height = Math.max(1, Math.round((part.bottom - part.top) * OCR_SCALE));
        piece.getContext('2d')!.drawImage(canvas, x, y, piece.width, piece.height, 0, 0, piece.width, piece.height);
        const prepared = await engine.preprocessImage(piece, { deskew: false, dropColor: getSettings().ocr.dropColor });
        const read = buildOcrPage(await engine.recognize(prepared.canvas), { width: prepared.canvas.width, height: prepared.canvas.height, scale: OCR_SCALE, skew: 0 });
        const text = ocrPageText(read).text.trim();
        if (text) texts.push(text);
        for (const l of read.lines) {
          lines.push(l.w.map((w) => ({ t: w.t, c: w.c })));
          for (const w of l.w) {
            sum += w.c;
            count++;
          }
        }
      }
      const text = texts.join(' ');
      const pageOcr = ocrPages[String(pageNumber)];
      const range = pageOcr ? rangeInBox(pageOcr, [unit.left, unit.top, unit.right, unit.bottom]) : null;
      setPending({
        page: pageNumber,
        quads: [quad],
        text,
        ...(range ? { textRange: range } : {}),
        ...(text ? { context: text } : {}),
        ocr: { rawText: text, confidence: count ? Math.round(sum / count) : 0 },
        preview: { image, lines, framed: true },
        clientBox: client,
        ...keep,
      });
    } catch (err) {
      console.error('MarkNeurone: zone reading failed', err);
      api.toast.error(t('zone_error'));
    } finally {
      setZoneBusy(null);
    }
  };

  /**
   * On a scanned page, the passage keeps what the machine read and how sure it
   * was, with the image of the passage to check the reading against.
   */
  const withOcrReading = (passage: Passage): Passage => {
    const ocr = ocrPages[String(passage.page)];
    if (!ocr || !passage.textRange) return passage;
    const [start, end] = passage.textRange;
    const image = root ? cropPage(root, passage.page, passage.quads, sizes[passage.page - 1], scale) : null;
    return {
      ...passage,
      ocr: { rawText: passage.text, confidence: rangeConfidence(ocr, start, end) ?? ocr.confidence },
      ...(image ? { preview: { image, lines: wordsInRange(ocr, start, end) } } : {}),
    };
  };

  /** The press began on the scrollbar: its release is no click on the document. */
  const pressOnScrollbar = React.useRef(false);
  const onMouseDown = (e: ReactTypes.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    pressOnScrollbar.current =
      e.clientX - box.left >= e.currentTarget.clientLeft + e.currentTarget.clientWidth ||
      e.clientY - box.top >= e.currentTarget.clientTop + e.currentTarget.clientHeight;
  };

  const onMouseUp = (e: ReactTypes.MouseEvent) => {
    if (e.button !== 0) return;
    // Dragging the scrollbar to a far page keeps the selection (a link across pages).
    if (pressOnScrollbar.current) {
      pressOnScrollbar.current = false;
      return;
    }
    // The end of a zone drag, handled by the zone layer.
    if (e.target instanceof Element && e.target.closest('[data-zone-layer], [data-cooccurrence]')) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      const hit = annotationAt(e.target, e.clientX, e.clientY, sizes, scale, clickable);
      if (hit) {
        selectHighlight(hit, e.ctrlKey || e.metaKey);
        return;
      }
      const suggestion = suggestionAt(e.target, e.clientX, e.clientY);
      const passage = suggestion ? suggestionPassage(suggestion) : null;
      if (passage) setPending(passage);
      // A click on nothing clears the selection and the sheet, unless a form is being filled.
      else if (!e.ctrlKey && !e.metaKey && !draft && !linkDraft) {
        setSelectedIds([]);
        showElement(null);
      }
      return;
    }
    const result = capturePassage(selection, sizes, scale);
    if (!result) return;
    if ('error' in result) {
      api.toast.warning(t('selection_multipage'));
      return;
    }
    setPending(withOcrReading(result.passage));
  };

  const cancelPending = React.useCallback(() => setPending(null), []);
  const applyGesture = (gesture: Gesture, passage: Passage) => {
    setLinkDraft(null);
    setDraft({ gesture, passage });
    setPending(null);
  };
  const chooseGesture = (gesture: Gesture) => {
    if (pending) applyGesture(gesture, pending);
  };
  const draftDone = React.useCallback(() => {
    setDraft(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  /** Shows every occurrence of a highlight's text in the document. */
  const selectSameText = (hit: Annotation) => {
    // Every occurrence, converted or not, through the search: framed, counted
    // and browsable, starting from the clicked one.
    const query = trimPunctuation(hit.text);
    const found = findInPages(effectiveTexts.map((p) => p.text), query);
    const here = found.findIndex((f) => f.page === hit.page && hit.textRange && f.start < hit.textRange[1] && f.end > hit.textRange[0]);
    setSearchOpen(true);
    setQuery(query);
    setHitIndex(Math.max(0, here));
  };

  /** Scrolls the document to a passage and marks it. */
  const gotoAnnotation = (annotation: Annotation) => {
    setSelectedAnnotationId(annotation.id);
    // A link drawn between two highlights has no passage of its own: go to the first of them.
    const own = placed.find((x) => x.id === annotation.id) ?? annotation;
    const a = own.quads.length && !isDeducedLinkPassage(own)
      ? own
      : (annotation.linkAnchors ?? []).map((id) => placed.find((x) => x.id === id)).find((x): x is Annotation => !!x) ?? annotation;
    if (!root || !sizes[a.page - 1]) return;
    // The highlight as drawn, when it is: what the user sees is where we go.
    const drawn = [...root.querySelectorAll<HTMLElement>(`[data-annotation-id="${CSS.escape(a.id)}"]`)];
    if (drawn.length) {
      const rootTop = root.getBoundingClientRect().top;
      const highest = Math.min(...drawn.map((el) => el.getBoundingClientRect().top));
      root.scrollTo({ top: Math.max(0, root.scrollTop + highest - rootTop - root.clientHeight / 3), behavior: 'smooth' });
      return;
    }
    let top = PADDING;
    for (let i = 0; i < a.page - 1; i++) top += Math.floor(sizes[i].height * scale) + PAGE_GAP;
    const first = (placed.find((p) => p.id === a.id) ?? a).quads[0];
    const offset = first ? pdfQuadToViewport(first, scaleTransform(sizes[a.page - 1].transform, scale)).top : 0;
    root.scrollTo({ top: Math.max(0, top + offset - root.clientHeight / 3), behavior: 'smooth' });
  };

  // A passage asked from outside (ZN's side panel): shown once the document,
  // its annotations and, for a text document, the laid out sheet are ready.
  const focusDone = React.useRef<object | null>(null);
  React.useEffect(() => {
    if (!focus || focusDone.current === focus.target || !root || !sizes.length) return;
    const a = placed.find((x) => x.id === focus.annotationId);
    if (!a || (textDoc && !a.quads.length)) return;
    focusDone.current = focus.target;
    selectHighlight(a, false);
    gotoAnnotation(a);
  });

  // L links the two selected elements; Escape clears a multiple selection.
  // Capture phase on document: runs before the reader's own Escape handling.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // An open context menu, or ZN's map picker, handles its own keys.
      if (menu || isMapPickerOpen()) return;
      // Ctrl+F searches the whole document (the browser's find only sees rendered pages).
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        openSearch();
        return;
      }
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === 'Escape' && zoneMode) {
        e.stopImmediatePropagation();
        setZoneMode(false);
        return;
      }
      if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey && !e.altKey && !pending && opened) {
        e.stopImmediatePropagation();
        e.preventDefault();
        setZoneMode((on) => !on);
        return;
      }
      if (e.key === 'Escape' && selectedIds.length > 1) {
        e.stopImmediatePropagation();
        setSelectedIds([]);
        return;
      }
      if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey && !e.altKey && !pending && linkPair) {
        e.stopImmediatePropagation();
        e.preventDefault();
        openLinkDraft(linkPair.from, linkPair.to);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  });

  const linkDone = React.useCallback(() => {
    setLinkDraft(null);
    setSelectedIds([]);
  }, []);

  // ─── Context menu ────────────────────────────────────────

  const { Highlighter, Tag, Calendar, Link2, Copy, PanelRightOpen, Trash2 } = api.icons;

  const onContextMenu = (e: ReactTypes.MouseEvent) => {
    e.preventDefault();
    setPending(null);
    // Right-click leaves the zone tool, as Escape does.
    if (zoneMode) {
      setZoneMode(false);
      return;
    }
    const at = { x: e.clientX, y: e.clientY };
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const result = capturePassage(selection, sizes, scale);
      if (result && 'passage' in result) {
        const passage = result.passage;
        setMenu({
          ...at,
          header: `« ${passage.text.length > 40 ? `${passage.text.slice(0, 40)}…` : passage.text} »`,
          sections: [
            [
              { id: 'element', label: t('gesture_element'), icon: Highlighter, shortcut: 'E', action: () => applyGesture('element', passage) },
              { id: 'property', label: t('gesture_property'), icon: Tag, shortcut: 'P', action: () => applyGesture('property', passage) },
              { id: 'event', label: t('gesture_event'), icon: Calendar, shortcut: 'V', action: () => applyGesture('event', passage) },
              { id: 'location', label: t('gesture_location'), icon: api.icons.MapPin, shortcut: 'G', action: () => applyGesture('location', passage) },
            ],
            [{ id: 'copy', label: t('menu_copy'), icon: Copy, shortcut: 'Ctrl+C', action: () => void navigator.clipboard.writeText(passage.text) }],
          ],
        });
        return;
      }
    }
    const hit = annotationAt(e.target, e.clientX, e.clientY, sizes, scale, clickable);
    if (hit) {
      if (hit.orphan) {
        // Quick reattachment onto the element shown in the sheet, when there is one.
        const shown = sheetElementId && elements.some((el) => el.id === sheetElementId) ? sheetElementId : null;
        const quick: MenuItem[] =
          shown && hit.kind !== 'link' && hit.kind !== 'event'
            ? [{
                id: 'reattach-shown',
                label: t('menu_reattach_to', { name: nameOf(shown) }),
                icon: Link2,
                action: () => {
                  reattachToElement(docCtx, hit, shown)
                    .then(() => showElement(shown))
                    .catch((err: unknown) => {
                      console.error('MarkNeurone: reattachment failed', err);
                      api.toast.error(t('write_error'));
                    });
                },
              }]
            : [];
        setMenu({
          ...at,
          header: t('orphan_title'),
          sections: [
            [{ id: 'reattach', label: t('menu_reattach'), icon: PanelRightOpen, action: () => selectHighlight(hit, false) }, ...quick],
            [{
              id: 'remove',
              label: t('menu_remove_highlight'),
              icon: Trash2,
              danger: true,
              action: () => {
                deleteAnnotation(docCtx, hit).catch((err: unknown) => {
                  console.error('MarkNeurone: cannot remove highlight', err);
                  api.toast.error(t('write_error'));
                });
              },
            }],
          ],
        });
        return;
      }
      const hitElement = elementOf(hit);
      const selected = selectedAnnotationId ? annotations.find((a) => a.id === selectedAnnotationId) : undefined;
      const selectedElement = selected ? elementOf(selected) : null;
      const linkItems: MenuItem[] = [];
      const pair = linkPair && (hit.id === linkPair.from.id || hit.id === linkPair.to.id) ? linkPair : null;
      if (pair) {
        // Right-click on one of two Ctrl+clicked highlights: offer that pair.
        linkItems.push({
          id: 'link-pair',
          label: t('menu_link_to', { from: nameOf(elementOf(pair.from)!), to: nameOf(elementOf(pair.to)!) }),
          icon: Link2,
          shortcut: 'L',
          action: () => openLinkDraft(pair.from, pair.to),
        });
      } else if (hitElement && selected && selectedElement && selectedElement !== hitElement && elements.some((el) => el.id === selectedElement)) {
        linkItems.push({
          id: 'link',
          label: t('menu_link_to', { from: nameOf(selectedElement), to: nameOf(hitElement) }),
          icon: Link2,
          action: () => openLinkDraft(selected, hit),
        });
      }
      const label = hit.kind === 'link' ? (links.find((l) => l.id === hit.targetId)?.label || t('link_unnamed')) : nameOf(hit.targetId ?? '');
      setMenu({
        ...at,
        header: label,
        sections: [
          [
            { id: 'open', label: t('menu_open_sheet'), icon: PanelRightOpen, action: () => selectHighlight(hit, false) },
            ...(hit.kind === 'link' ? [] : [{ id: 'same', label: t('menu_select_same'), icon: api.icons.ListChecks, action: () => selectSameText(hit) }]),
          ],
          linkItems,
          [{
            id: 'remove',
            label: t('menu_remove_highlight'),
            icon: Trash2,
            danger: true,
            title: t('delete_passage'),
            action: () => {
              deleteAnnotation(docCtx, hit).catch((err: unknown) => {
                console.error('MarkNeurone: cannot remove highlight', err);
                api.toast.error(t('write_error'));
              });
            },
          }],
        ],
      });
      return;
    }
    const suggestion = suggestionAt(e.target, e.clientX, e.clientY);
    const suggested = suggestion ? suggestionPassage(suggestion) : null;
    if (suggested) {
      setMenu({
        ...at,
        header: suggestionTitle(suggested),
        sections: [
          [
            { id: 'element', label: t('gesture_element'), icon: Highlighter, shortcut: 'E', action: () => applyGesture('element', suggested) },
            { id: 'property', label: t('gesture_property'), icon: Tag, shortcut: 'P', action: () => applyGesture('property', suggested) },
            { id: 'event', label: t('gesture_event'), icon: Calendar, shortcut: 'V', action: () => applyGesture('event', suggested) },
            { id: 'location', label: t('gesture_location'), icon: api.icons.MapPin, shortcut: 'G', action: () => applyGesture('location', suggested) },
          ],
          [{ id: 'reject', label: t('suggestion_reject'), icon: api.icons.X, action: () => reject(suggested) }],
        ],
      });
      return;
    }
    setMenu({
      ...at,
      sections: [
        ...(opened ? [[{ id: 'zone', label: t('zone_read'), icon: api.icons.SquareDashed, shortcut: 'Z', action: () => setZoneMode(true) }]] : []),
        [
        { id: 'zoom-in', label: t('viewer_zoom_in'), icon: ZoomIn, action: () => stepZoom(1) },
        { id: 'zoom-out', label: t('viewer_zoom_out'), icon: ZoomOut, action: () => stepZoom(-1) },
        { id: 'fit', label: t('viewer_fit_width'), icon: MoveHorizontal, action: () => setZoom('fit') },
        ],
      ],
    });
  };

  const reveal = (elementId: string) => {
    onMinimize();
    revealOnCanvas(elementId);
  };

  /** ZN's map picker lives in its detail panel; the plugin only leads there. */
  const pickOnMap = (elementId: string) => {
    reveal(elementId);
    api.stores.useUIStore.getState().setSidePanelTab('detail');
    api.toast.info(t('geo_pick_toast'));
  };

  // ─── OCR ─────────────────────────────────────────────────

  // Cached results first: a document is never recognized twice. Reset and
  // reload on every document, including the same file added again (new
  // asset id, same hash): a reset without reload left the OCR waiting.
  React.useEffect(() => {
    let cancelled = false;
    setOcrPages({});
    setOcrLoaded(false);
    setOcrFailed([]);
    setOcrCurrent(null);
    setOcrClearing(false);
    loadOcr(dossierId, asset.hash)
      .then((doc) => {
        if (cancelled) return;
        setOcrPages(doc.pages);
        setOcrLoaded(true);
      })
      .catch((err: unknown) => {
        console.error('MarkNeurone: cannot load OCR cache', err);
        if (!cancelled) setOcrLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dossierId, asset.id, asset.hash]);

  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;
  const engineUsed = React.useRef(false);

  // Background OCR of scanned pages, one at a time, starting from the page
  // on screen when each page starts (scrolling does not interrupt a page).
  React.useEffect(() => {
    if (!opened || !report || !ocrLoaded || ocrPaused) return;
    const pending = report.imagePages.filter((n) => !ocrPages[String(n)] && !ocrFailed.includes(n));
    if (!pending.length) return;
    const from = currentPageRef.current;
    const pageNumber = pending.find((n) => n >= from) ?? pending[0];
    let cancelled = false;
    setOcrCurrent(pageNumber);
    setOcrPercent(0);
    // Rendering and preprocessing count for the first 10 %, recognition for the rest.
    const progress = (fraction: number) => {
      if (!cancelled) setOcrPercent(Math.round(10 + fraction * 90));
    };
    (async () => {
      engineUsed.current = true;
      const engine = await import('../services/ocrEngine.ts');
      const page = await opened.doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      if (cancelled) return;
      const prepared = await engine.preprocessImage(canvas, { dropColor: getSettings().ocr.dropColor });
      if (cancelled) return;
      progress(0);
      const lines = await engine.recognize(prepared.canvas, progress);
      if (cancelled) return;
      const result = buildOcrPage(lines, { width: prepared.canvas.width, height: prepared.canvas.height, scale: OCR_SCALE, skew: prepared.skew });
      await saveOcrPage(dossierId, asset.hash, pageNumber, result);
      if (!cancelled) setOcrPages((prev) => ({ ...prev, [String(pageNumber)]: result }));
    })()
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('MarkNeurone: OCR failed on page', pageNumber, err);
        setOcrFailed((failed) => [...failed, pageNumber]);
      });
    // ocrCurrent is not cleared when a page ends: the next run sets it at
    // once, and clearing it showed "starting" for a frame between pages.
    return () => {
      cancelled = true;
    };
  }, [opened, report, ocrLoaded, ocrPaused, ocrPages, ocrFailed]);

  // The engine (several megabytes of WASM and model) is released with the reader.
  React.useEffect(
    () => () => {
      if (engineUsed.current) import('../services/ocrEngine.ts').then((m) => m.stopOcr());
    },
    [],
  );

  /** Page texts for search: OCR text replaces the (empty) text of scanned pages. */
  const effectiveTexts = React.useMemo<PageText[]>(
    () =>
      pageTexts.map((p, i) => {
        const ocr = ocrPages[String(i + 1)];
        return ocr ? ocrPageText(ocr) : p;
      }),
    [pageTexts, ocrPages],
  );

  const cooccurrenceScope = getSettings().links.cooccurrence;
  const possibleLinks = React.useMemo(() => {
    if (cooccurrenceScope === 'off') return [];
    const linked = new Set(links.map((l) => pairKey(l.fromId, l.toId)));
    return cooccurrences(effectiveTexts.map((p) => p.text), placed, cooccurrenceScope, linked, dismissedPairs)
      .filter((c) => elements.some((el) => el.id === c.from.targetId) && elements.some((el) => el.id === c.to.targetId));
  }, [cooccurrenceScope, effectiveTexts, placed, links, elements, dismissedPairs, settingsVersion]);
  const marksByPage = React.useMemo(() => {
    const byPage = new Map<number, PageMark[]>();
    for (const c of possibleLinks) {
      const list = byPage.get(c.page) ?? [];
      list.push({ key: c.key, quads: [...c.from.quads, ...c.to.quads], title: t('cooccurrence_mark', { from: nameOf(c.from.targetId!), to: nameOf(c.to.targetId!) }) });
      byPage.set(c.page, list);
    }
    return byPage;
  }, [possibleLinks, elements]);

  // ─── Pre-highlighting ────────────────────────────────────

  // Off when a document is first read, then as the user leaves it.
  const [suggestionsOn, setSuggestionsOn] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setSuggestionsOn(false);
    loadViewPrefs(dossierId, asset.hash)
      .then((prefs) => {
        if (!cancelled) setSuggestionsOn(prefs.suggestions);
      })
      .catch((err: unknown) => console.error('MarkNeurone: cannot load reader preferences', err));
    return () => {
      cancelled = true;
    };
  }, [dossierId, asset.hash]);
  const toggleSuggestions = () => {
    const next = !suggestionsOn;
    setSuggestionsOn(next);
    saveViewPrefs(dossierId, asset.hash, { suggestions: next }).catch((err: unknown) =>
      console.error('MarkNeurone: cannot save reader preferences', err));
  };

  /** Names the dictionary looks for: labels, and values of the profile's alias properties. */
  const assets: { id: string; filename: string }[] = api.stores.useDossierStore((s: { assets: { id: string; filename: string }[] }) => s.assets);
  const named = React.useMemo<NamedElement[]>(
    () =>
      elements
        .filter((el) => isGraphElement(el) && el.label?.trim() && !isDocumentCarrier(el, assets))
        .map((el) => ({
          id: el.id,
          label: el.label,
          aliases: el.properties
            .filter((pr) => typeof pr.value === 'string' && getProfile().aliasKeys.some((k) => k.toLowerCase() === pr.key.toLowerCase()))
            .map((pr) => pr.value as string),
        })),
    [elements, assets, settingsVersion],
  );

  const suggestions = React.useMemo<Suggestion[]>(
    () => (suggestionsOn ? buildSuggestions(effectiveTexts.map((p) => p.text), named, annotations, getSettings().identifiers.countries) : []),
    [suggestionsOn, effectiveTexts, named, annotations, settingsVersion],
  );

  const suggestionsByPage = React.useMemo(() => {
    const tagSets: ZnTagSet[] = api.stores.useTagSetStore.getState().getAll();
    const tagColorOf = (elementId: string) => {
      const tag = elements.find((el) => el.id === elementId)?.tags[0];
      return tag ? tagSets.find((ts) => ts.name.toLowerCase() === tag.toLowerCase())?.defaultVisual.color ?? null : null;
    };
    const byPage = new Map<number, PageSuggestion[]>();
    for (const s of suggestions) {
      // A known name takes its element's tag color; homonyms of different colors stay neutral.
      const colors = new Set((s.elementIds ?? []).map(tagColorOf));
      const color = colors.size === 1 ? [...colors][0] ?? SUGGESTION_COLOR : SUGGESTION_COLOR;
      const list = byPage.get(s.page) ?? [];
      list.push({ key: s.key, start: s.start, end: s.end, color });
      byPage.set(s.page, list);
    }
    return byPage;
  }, [suggestions, elements, tagSetMap]);

  /** Suggestion under a click, measured on the rendered text layer. */
  const suggestionAt = (target: EventTarget | null, x: number, y: number): Suggestion | null => {
    const pageEl = target instanceof Element ? (target.closest('.mn-page') as HTMLElement | null) : null;
    const layer = pageEl?.querySelector('.textLayer') as HTMLElement | null;
    if (!pageEl || !layer || !suggestions.length) return null;
    const page = Number(pageEl.dataset.pageNumber);
    const origin = layer.getBoundingClientRect();
    const px = x - origin.left;
    const py = y - origin.top;
    return (
      suggestions.find(
        (s) => s.page === page && rangeBoxes(layer, s.start, s.end).some((r) => px >= r.left - 1 && px <= r.right + 1 && py >= r.top - 1 && py <= r.bottom + 1),
      ) ?? null
    );
  };

  /** The suggested passage, ready for the same choices as a manual selection. */
  const suggestionPassage = (s: Suggestion): Passage | null => {
    if (!root) return null;
    const passage = passageFromOffsets(root, s.page, s.start, s.end, sizes, scale);
    if (!passage) return null;
    return withOcrReading({
      ...passage,
      origin: s.source,
      suggestion: {
        kind: s.kind,
        ...(s.checksumOk !== undefined ? { checksumOk: s.checksumOk } : {}),
        ...(s.suspect ? { suspect: true } : {}),
        ...(s.elementIds ? { elementIds: s.elementIds } : {}),
      },
    });
  };

  /**
   * What a suggestion was recognized as: its type, or the element already in
   * the dossier, shown with its tag color as on the canvas.
   */
  const suggestionLabel = (p: Passage): { title: string; titleColor?: string | null; titleHint?: string } | null => {
    const s = p.suggestion;
    if (!s) return null;
    if (s.kind !== 'name') return { title: t(`suggestion_kind_${s.kind}`) };
    const ids = s.elementIds ?? [];
    if (ids.length > 1) return { title: t('suggestion_homonyms', { count: ids.length }), titleColor: null };
    const element = elements.find((el) => el.id === ids[0]);
    const tag = element?.tags[0];
    const tagSets: ZnTagSet[] = api.stores.useTagSetStore.getState().getAll();
    const color = tag ? tagSets.find((ts) => ts.name.toLowerCase() === tag.toLowerCase())?.defaultVisual.color ?? null : null;
    return { title: element?.label ?? '', titleColor: color, titleHint: t('suggestion_known', { name: element?.label ?? '' }) };
  };
  const suggestionTitle = (p: Passage) => {
    const label = suggestionLabel(p);
    return label?.titleHint ?? label?.title;
  };

  const reject = (p: Passage) => {
    setPending(null);
    rejectSuggestion(docCtx, p).catch((err: unknown) => {
      console.error('MarkNeurone: cannot dismiss suggestion', err);
      api.toast.error(t('write_error'));
    });
  };

  // ─── Search ──────────────────────────────────────────────

  const hits = React.useMemo<SearchHit[]>(
    () => (searchOpen && query.trim() ? findInPages(effectiveTexts.map((p) => p.text), query) : []),
    [searchOpen, query, effectiveTexts],
  );
  const currentHit = hits.length ? hits[Math.min(hitIndex, hits.length - 1)] : null;
  const hitsByPage = React.useMemo(() => {
    const byPage = new Map<number, { start: number; end: number; current: boolean }[]>();
    for (const hit of hits) {
      const list = byPage.get(hit.page) ?? [];
      list.push({ start: hit.start, end: hit.end, current: hit === currentHit });
      byPage.set(hit.page, list);
    }
    return byPage;
  }, [hits, currentHit]);

  /** Scrolls so that a hit sits in the upper third, from pdf.js item positions. */
  const scrollToHit = (hit: SearchHit) => {
    if (!root || !sizes[hit.page - 1]) return;
    let top = PADDING;
    for (let i = 0; i < hit.page - 1; i++) top += Math.floor(sizes[i].height * scale) + PAGE_GAP;
    const page = effectiveTexts[hit.page - 1];
    let y = 0;
    if (page?.starts.length) {
      let item = 0;
      while (item + 1 < page.starts.length && page.starts[item + 1] <= hit.start) item++;
      y = (page.ys[item] ?? 0) * scale;
    } else {
      // Text document: measured on the sheet, which is always rendered.
      const layer = root.querySelector(`.mn-page[data-page-number="${hit.page}"] .textLayer`) as HTMLElement | null;
      y = (layer && rangeBoxes(layer, hit.start, hit.end)[0]?.top) ?? 0;
    }
    root.scrollTo({ top: Math.max(0, top + y - root.clientHeight / 3), behavior: 'smooth' });
  };

  React.useEffect(() => {
    if (currentHit) scrollToHit(currentHit);
  }, [currentHit]);

  const stepHit = (direction: 1 | -1) => {
    if (!hits.length) return;
    setHitIndex((i) => (Math.min(i, hits.length - 1) + direction + hits.length) % hits.length);
  };
  const openSearch = () => {
    setSearchOpen(true);
    // Prefill with the current text selection, as browsers do.
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length < 80) {
      setQuery(selected);
      setHitIndex(0);
    }
    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
    setHitIndex(0);
  };

  const toolButton = 'p-1.5 rounded text-text-secondary hover:bg-bg-secondary disabled:opacity-40';

  // Proposal read in the first page's header (OCR text once recognized); never applied by itself.
  const firstPageText = effectiveTexts[0]?.text ?? '';
  const proposedReference = React.useMemo(() => detectReference(firstPageText), [firstPageText]);
  const commitReference = (value: string) => {
    const next = cleanReference(value);
    setReferenceDraft(null);
    if (next === reference) return;
    saveReference(dossierId, asset.hash, next)
      .then(() => {
        setReference(next);
        const plan = planRelabel({ dossierId, asset, reference: next }, annotations);
        setRelabel(relabelCount(plan) ? plan : null);
      })
      .catch((err: unknown) => {
        console.error('MarkNeurone: cannot save the document reference', err);
        api.toast.error(t('reference_error'));
      });
  };
  const referenceField = referenceDraft !== null
    ? h('input', {
        autoFocus: true,
        value: referenceDraft,
        placeholder: asset.filename,
        'aria-label': t('reference_label'),
        className: 'px-2 py-1 text-xs bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary',
        style: { width: 240 },
        onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setReferenceDraft(e.target.value),
        // Saved on blur only; Enter blurs, Escape blurs without saving.
        onBlur: () => {
          if (referenceCancelled.current) setReferenceDraft(null);
          else commitReference(referenceDraft);
          referenceCancelled.current = false;
        },
        onKeyDown: (e: ReactTypes.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            referenceCancelled.current = true;
            e.currentTarget.blur();
          }
        },
      })
    : h(React.Fragment, null,
        h('button', {
          type: 'button',
          onClick: () => setReferenceDraft(reference),
          title: t('reference_label'),
          className: `inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-bg-secondary truncate ${reference ? 'text-text-primary' : 'text-text-tertiary'}`,
          style: { maxWidth: 240 },
        }, h(api.icons.FileText, { size: 12, className: 'shrink-0' }), h('span', { className: 'truncate' }, reference || asset.filename)),
        !reference && proposedReference
          ? h('button', {
              type: 'button',
              onClick: () => commitReference(proposedReference),
              title: t('reference_use'),
              className: 'text-accent hover:underline truncate',
              style: { maxWidth: 220 },
            }, proposedReference)
          : null);

  // After a change of reference: offer to rewrite the sources already written.
  const relabelBar = relabel
    ? h('div', { className: 'flex items-center gap-2 px-4 py-2 border-b border-border-default text-xs text-text-secondary' },
        h(api.icons.FileText, { size: 14, className: 'text-text-tertiary shrink-0' }),
        t('reference_relabel', { count: relabelCount(relabel) }),
        h('button', {
          type: 'button',
          className: 'ml-2 text-xs text-accent hover:underline',
          onClick: () => {
            const plan = relabel;
            setRelabel(null);
            applyRelabel(plan).catch((err: unknown) => {
              console.error('MarkNeurone: cannot update sources', err);
              api.toast.error(t('reference_relabel_error'));
            });
          },
        }, t('reference_relabel_action')),
        h('button', { type: 'button', className: 'ml-2 text-xs text-accent hover:underline', onClick: () => setRelabel(null) }, t('reference_relabel_skip')))
    : null;

  const toolbar = h(
    'div',
    { className: 'flex items-center gap-3 px-4 py-1.5 border-b border-border-default bg-bg-secondary text-xs text-text-secondary' },
    opened
      ? h('span', null, t('viewer_page', { current: currentPage, total: opened.doc.numPages }))
      : textDoc ? null : h('span', null, t('viewer_loading')),
    referenceField,
    searchOpen
      ? h('div', { className: 'flex items-center gap-1' },
          h(api.icons.Search, { size: 14, className: 'text-text-tertiary shrink-0' }),
          h('input', {
            ref: searchInputRef,
            value: query,
            placeholder: t('search_placeholder'),
            'aria-label': t('search_placeholder'),
            className: 'px-2 py-1 text-xs bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary',
            style: { width: 220 },
            onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
              setHitIndex(0);
            },
            onKeyDown: (e: ReactTypes.KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                stepHit(e.shiftKey ? -1 : 1);
              } else if (e.key === 'Escape') {
                // Close the search, not the reader.
                e.stopPropagation();
                closeSearch();
              }
            },
          }),
          h('span', { className: 'text-center', style: { minWidth: 48 } },
            query.trim() ? (hits.length ? `${Math.min(hitIndex, hits.length - 1) + 1} / ${hits.length}` : t('search_none')) : ''),
          h('button', { onClick: () => stepHit(-1), disabled: !hits.length, title: t('search_previous'), className: toolButton }, h(api.icons.ChevronUp, { size: 14 })),
          h('button', { onClick: () => stepHit(1), disabled: !hits.length, title: t('search_next'), className: toolButton }, h(api.icons.ChevronDown, { size: 14 })),
          h('button', { onClick: closeSearch, title: t('search_close'), className: toolButton }, h(api.icons.X, { size: 14 })))
      : h('button', { onClick: openSearch, disabled: !ready, title: t('search_open'), className: toolButton }, h(api.icons.Search, { size: 14 })),
    h('button', {
      onClick: toggleSuggestions,
      disabled: !ready,
      'aria-pressed': suggestionsOn,
      title: t(suggestionsOn ? 'suggestions_hide' : 'suggestions_show'),
      // Grey when off, accent when on: the icon alone tells the state.
      className: `p-1.5 rounded disabled:opacity-40 ${suggestionsOn ? 'text-accent bg-accent/10 hover:bg-accent/20' : 'text-text-secondary hover:bg-bg-secondary'}`,
    }, h(api.icons.Sparkles, { size: 14 })),
    h('div', { className: 'flex items-center gap-1 ml-auto' },
      h('button', { onClick: () => stepZoom(-1), disabled: !ready, title: t('viewer_zoom_out'), className: toolButton }, h(ZoomOut, { size: 14 })),
      h('span', { className: 'text-center', style: { minWidth: 40 } }, `${percent} %`),
      h('button', { onClick: () => stepZoom(1), disabled: !ready, title: t('viewer_zoom_in'), className: toolButton }, h(ZoomIn, { size: 14 })),
      h('button', {
        onClick: () => setZoom('fit'),
        disabled: !ready,
        title: t('viewer_fit_width'),
        className: `${toolButton}${zoom === 'fit' ? ' bg-bg-tertiary' : ''}`,
      }, h(MoveHorizontal, { size: 14 })),
    ),
    h('span', { className: 'font-mono', title: `SHA-256 ${asset.hash}` }, `SHA-256 ${asset.hash.slice(0, 12)}`),
  );

  // Two elements selected with Ctrl+click: offer the link. Floating over the
  // document, so that showing it never moves the page under the mouse.
  const linkBanner = linkPair && !linkDraft
    ? h('div', {
        className: 'absolute z-10 flex items-center gap-2 px-3 py-1.5 bg-bg-primary border border-accent/30 rounded sketchy-border-soft panel-shadow text-xs text-text-primary',
        style: { top: 8, left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100% - 32px)' },
      },
        h('span', { className: 'truncate' }, `${nameOf(elementOf(linkPair.from)!)} → ${nameOf(elementOf(linkPair.to)!)}`),
        h('button', {
          type: 'button',
          onClick: () => openLinkDraft(linkPair.from, linkPair.to),
          title: t('link_pair_action'),
          'aria-label': t('link_pair_action'),
          className: 'ml-auto p-1 rounded text-accent hover:bg-accent/20',
        }, h(Link2, { size: 14 })),
        h('button', { type: 'button', onClick: () => setSelectedIds([]), title: t('clear_selection'), className: 'p-1 text-text-tertiary hover:text-text-secondary' },
          h(api.icons.X, { size: 12 })))
    : null;

  // Scanned pages: OCR progress, or what was recognized.
  let notice: ReactTypes.ReactNode = null;
  /** Only a failure is a warning; progress and result are plain information. */
  let noticeWarning = false;
  if (report && report.imagePages.length) {
    const total = report.imagePages.length;
    const done = report.imagePages.filter((n) => ocrPages[String(n)]).length;
    const noticeButton = (label: string, onClick: () => void) =>
      h('button', { type: 'button', onClick, className: 'ml-2 text-xs text-accent hover:underline' }, label);
    const recognized = report.imagePages.map((n) => ocrPages[String(n)]).filter((o): o is OcrPage => !!o);
    const meanConfidence = recognized.length ? Math.round(recognized.reduce((sum, o) => sum + o.confidence, 0) / recognized.length) : 0;
    // Deleted on request; the OCR stays paused until the user resumes it.
    const clearOcr = () => {
      setOcrPaused(true);
      setOcrClearing(false);
      deleteOcr(dossierId, asset.hash)
        .then(() => {
          setOcrPages({});
          setOcrFailed([]);
        })
        .catch((err: unknown) => {
          console.error('MarkNeurone: cannot delete the recognized text', err);
          api.toast.error(t('ocr_clear_error'));
        });
    };
    const clearButton = done > 0 ? noticeButton(t('ocr_clear'), () => setOcrClearing(true)) : null;
    if (ocrClearing) {
      notice = h(React.Fragment, null,
        t('ocr_clear_confirm'),
        noticeButton(t('ocr_clear_action'), clearOcr),
        noticeButton(t('cancel'), () => setOcrClearing(false)));
    } else if (done < total - ocrFailed.length && !ocrPaused) {
      notice = h(React.Fragment, null,
        ocrCurrent ? t('ocr_running', { done, total }) : t('ocr_starting', { done, total }),
        ocrCurrent
          ? h('div', {
              role: 'progressbar',
              'aria-valuemin': 0,
              'aria-valuemax': 100,
              'aria-valuenow': ocrPercent,
              'aria-label': t('ocr_page_progress', { page: ocrCurrent, percent: ocrPercent }),
              title: t('ocr_page_progress', { page: ocrCurrent, percent: ocrPercent }),
              className: 'w-24 h-1.5 rounded bg-bg-tertiary overflow-hidden shrink-0',
            }, h('div', { className: 'h-full bg-accent', style: { width: `${ocrPercent}%` } }))
          : null,
        noticeButton(t('ocr_pause'), () => setOcrPaused(true)));
    } else if (ocrPaused && done < total) {
      notice = h(React.Fragment, null, t('ocr_paused', { done, total }), noticeButton(t('ocr_resume'), () => setOcrPaused(false)), clearButton);
    } else if (ocrFailed.length) {
      noticeWarning = true;
      notice = h(React.Fragment, null,
        t('ocr_failed', { pages: ocrFailed.join(', '), done, total }),
        noticeButton(t('ocr_retry'), () => setOcrFailed([])),
        clearButton);
    } else {
      notice = h(React.Fragment, null, t('ocr_done', { count: done, confidence: meanConfidence }), clearButton);
    }
  }

  const documentColumn = h(
    'div',
    { className: 'flex flex-col flex-1 min-w-0 min-h-0' },
    toolbar,
    relabelBar,
    notice
      ? h('div', { className: 'flex items-center gap-2 px-4 py-2 border-b border-border-default text-xs text-text-secondary tabular-nums' },
          noticeWarning
            ? h(TriangleAlert, { size: 14, className: 'text-warning shrink-0' })
            : h(api.icons.ScanText, { size: 14, className: 'text-text-tertiary shrink-0' }),
          notice)
      : null,
    h('div', { className: 'relative flex flex-col flex-1 min-h-0' },
    linkBanner,
    h(
      'div',
      {
        ref: setRoot,
        onScroll,
        onMouseDown,
        onMouseUp,
        onContextMenu,
        className: 'flex-1 overflow-auto bg-bg-tertiary',
        style: { padding: PADDING },
      },
      error ? h('p', { className: 'text-sm text-error' }, error) : null,
      (opened || textDoc) && root
        ? sizes.map((size, i) =>
            h(PdfPage, {
              key: i + 1,
              doc: opened?.doc ?? null,
              blocks: textDoc?.blocks ?? null,
              onHeight: textDoc ? onSheetHeight : undefined,
              pageNumber: i + 1,
              size,
              scale,
              root,
              highlights: highlightsByPage.get(i + 1) ?? NO_HIGHLIGHTS,
              arcs: arcsByPage.get(i + 1) ?? NO_ARCS,
              searchHits: hitsByPage.get(i + 1) ?? NO_SEARCH_HITS,
              suggestions: suggestionsByPage.get(i + 1) ?? NO_SUGGESTIONS,
              marks: marksByPage.get(i + 1) ?? NO_MARKS,
              onMark: (key: string) => openPossibleLink(key, i + 1),
              zoneMode,
              onZone,
              ocr: ocrPages[String(i + 1)] ?? null,
            }))
        : null,
    )),
  );

  return h(
    'div',
    { className: 'flex flex-1 min-h-0' },
    documentColumn,
    h(ElementSheet, {
      ctx: docCtx,
      elementId: sheetElementId,
      draft,
      linkDraft,
      annotations,
      selectedAnnotationId,
      onElementChange: showElement,
      onDraftDone: draftDone,
      onLinkDone: linkDone,
      onDismissPair: dismissPair,
      linkId: activeLinkId,
      onOpenLink: showLink,
      orphanId: activeOrphanId,
      onGoto: gotoAnnotation,
      onReveal: reveal,
      onPickOnMap: pickOnMap,
    }),
    pending
      ? h(SelectionBar, {
          passage: pending,
          onChoose: chooseGesture,
          onCancel: cancelPending,
          ...suggestionLabel(pending),
          onReject: pending.suggestion ? () => reject(pending) : undefined,
          // A selection on a scanned page can be read again, more finely.
          onReread: ocrPages[String(pending.page)] && !pending.preview?.framed ? () => rereadSelection(pending) : undefined,
          onLink: getSettings().links.verb && !pending.suggestion ? () => linkFromWords(pending) : undefined,
        })
      : null,
    menu ? h(ReaderContextMenu, { ...menu, onClose: () => setMenu(null) }) : null,
  );
}
