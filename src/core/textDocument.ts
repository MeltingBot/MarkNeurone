// ─── Text documents (DOCX, ODT, TXT, Markdown) ───────────────
//
// A text document is read as a list of blocks (headings, paragraphs, list
// items, table rows), shown on one continuous sheet. Its text is the blocks'
// texts, each followed by "\n": annotation offsets refer to that text, so it
// must not change for a given file. Any change in the extraction rules below
// requires a new TEXT_EXTRACTOR_ID.
//
// Not read: headers and footers, footnotes and comments, deleted revisions,
// images. Legacy binary formats (.doc) are not supported.

export const TEXT_EXTRACTOR_ID = 'text-1';

export type BlockKind = 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'row' | 'pre';

export interface TextBlock {
  kind: BlockKind;
  /** Table rows: cells separated by "\t". */
  text: string;
}

export type TextFormat = 'docx' | 'odt' | 'txt' | 'md';

export function textFormatOf(file: { filename: string; mimeType?: string }): TextFormat | null {
  const name = file.filename.toLowerCase();
  const type = file.mimeType ?? '';
  if (name.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (name.endsWith('.odt') || type === 'application/vnd.oasis.opendocument.text') return 'odt';
  if (name.endsWith('.md') || name.endsWith('.markdown') || type === 'text/markdown') return 'md';
  if (name.endsWith('.txt') || type === 'text/plain') return 'txt';
  return null;
}

/** Text of the document, as offsets count it. */
export function blocksText(blocks: TextBlock[]): string {
  return blocks.map((b) => `${b.text}\n`).join('');
}

/** Offset of each block in blocksText(blocks). */
export function blockStarts(blocks: TextBlock[]): number[] {
  const starts: number[] = [];
  let n = 0;
  for (const b of blocks) {
    starts.push(n);
    n += b.text.length + 1;
  }
  return starts;
}

const headingKind = (level: number): BlockKind => (level <= 1 ? 'h1' : level === 2 ? 'h2' : 'h3');

function push(blocks: TextBlock[], kind: BlockKind, text: string): void {
  // Empty paragraphs only make space; the sheet spaces blocks itself.
  if (text.trim()) blocks.push({ kind, text });
}

// ─── Plain text ──────────────────────────────────────────────

/** UTF-8 when valid, else Windows-1252 (texts saved by older French Windows tools). */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

/** A text file keeps its lines as they are: one preformatted block. */
export function parseTxt(text: string): TextBlock[] {
  const body = text.replace(/\n+$/, '');
  return body.trim() ? [{ kind: 'pre', text: body }] : [];
}

// ─── Markdown ────────────────────────────────────────────────

/** Inline markup removed; a link keeps its address, which may matter. */
function mdInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, label: string, url: string) => (label === url ? url : `${label} (${url})`))
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
    .replace(/(^|[^\w*])\*(?=\S)(.+?)(?<=\S)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^\w_])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, '$1');
}

const MD_TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/;

export function parseMarkdown(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  const lines = text.split('\n');
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) push(blocks, 'p', mdInline(paragraph.join(' ')));
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trimStart().startsWith(fence[1]); i++) code.push(lines[i]);
      push(blocks, 'pre', code.join('\n'));
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flush();
      push(blocks, headingKind(heading[1].length), mdInline(heading[2]));
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      continue;
    }
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      flush();
      push(blocks, 'li', mdInline(item[1].replace(/^\[[ xX]\]\s+/, '')));
      continue;
    }
    if (line.trimStart().startsWith('|')) {
      flush();
      if (MD_TABLE_SEPARATOR.test(line.trim())) continue;
      const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => mdInline(c.trim()));
      push(blocks, 'row', cells.join('\t'));
      continue;
    }
    paragraph.push(line.replace(/^\s{0,3}>\s?/, '').trim());
  }
  flush();
  return blocks;
}

// ─── XML helpers ─────────────────────────────────────────────

function children(el: Element): Element[] {
  return Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);
}

function child(el: Element, ns: string, local: string): Element | undefined {
  return children(el).find((c) => c.namespaceURI === ns && c.localName === local);
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('invalid-xml');
  return doc;
}

// ─── DOCX (word/document.xml) ────────────────────────────────

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Elements whose content is not part of the reading text. */
const DOCX_SKIP = new Set(['del', 'delText', 'instrText', 'delInstrText', 'footnoteReference', 'endnoteReference', 'commentReference', 'pPr', 'rPr', 'drawing', 'pict', 'object']);

function docxRunText(el: Element): string {
  let out = '';
  for (const c of children(el)) {
    if (c.namespaceURI !== W) {
      // mc:AlternateContent and the like: read the fallback only once.
      if (c.localName === 'AlternateContent') {
        const fallback = children(c).find((x) => x.localName === 'Fallback') ?? children(c).find((x) => x.localName === 'Choice');
        if (fallback) out += docxRunText(fallback);
      } else {
        out += docxRunText(c);
      }
      continue;
    }
    if (DOCX_SKIP.has(c.localName)) continue;
    switch (c.localName) {
      case 't':
        out += c.textContent ?? '';
        break;
      case 'tab':
        out += '\t';
        break;
      case 'br':
      case 'cr':
        out += '\n';
        break;
      case 'noBreakHyphen':
        out += '-';
        break;
      case 'softHyphen':
        break;
      default:
        out += docxRunText(c);
    }
  }
  return out;
}

function docxParagraphKind(p: Element): BlockKind {
  const pPr = child(p, W, 'pPr');
  if (!pPr) return 'p';
  const style = child(pPr, W, 'pStyle')?.getAttributeNS(W, 'val') ?? '';
  const outline = child(pPr, W, 'outlineLvl')?.getAttributeNS(W, 'val');
  const styled = style.match(/^(?:heading|titre|title)\s*(\d)?$/i);
  if (styled) return headingKind(styled[1] ? Number(styled[1]) : 1);
  if (outline !== null && outline !== undefined && /^\d$/.test(outline) && Number(outline) < 9) return headingKind(Number(outline) + 1);
  if (child(pPr, W, 'numPr') || /^(list|liste)/i.test(style)) return 'li';
  return 'p';
}

function docxCellText(tc: Element): string {
  const parts: string[] = [];
  const walk = (el: Element) => {
    for (const c of children(el)) {
      if (c.namespaceURI === W && c.localName === 'p') parts.push(docxRunText(c).replace(/[\t\n]/g, ' ').trim());
      else if (c.namespaceURI === W && c.localName === 'tcPr') continue;
      else walk(c);
    }
  };
  walk(tc);
  return parts.filter(Boolean).join(' ');
}

function docxBody(el: Element, blocks: TextBlock[]): void {
  for (const c of children(el)) {
    if (c.namespaceURI === W && c.localName === 'p') {
      push(blocks, docxParagraphKind(c), docxRunText(c));
    } else if (c.namespaceURI === W && c.localName === 'tbl') {
      for (const tr of children(c).filter((x) => x.localName === 'tr')) {
        const cells = children(tr).filter((x) => x.localName === 'tc').map(docxCellText);
        if (cells.some(Boolean)) blocks.push({ kind: 'row', text: cells.join('\t') });
      }
    } else if (c.namespaceURI === W && (c.localName === 'sectPr' || DOCX_SKIP.has(c.localName))) {
      continue;
    } else {
      docxBody(c, blocks);
    }
  }
}

export function parseDocxXml(xml: string): TextBlock[] {
  const doc = parseXml(xml);
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const blocks: TextBlock[] = [];
  if (body) docxBody(body, blocks);
  return blocks;
}

// ─── ODT (content.xml) ───────────────────────────────────────

const TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const TABLE = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
const OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';

const ODT_SKIP = new Set(['note', 'tracked-changes', 'bookmark', 'bookmark-start', 'bookmark-end', 'soft-page-break', 'sequence-decls', 'variable-decls', 'user-field-decls', 'table-of-content']);

/** Inline content; white space collapses as ODF specifies, text:s adds spaces. */
function odtInline(el: Element): string {
  let out = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) {
      out += (n.nodeValue ?? '').replace(/[ \t\r\n]+/g, ' ');
      continue;
    }
    if (n.nodeType !== 1) continue;
    const c = n as Element;
    if (c.namespaceURI === OFFICE && c.localName === 'annotation') continue;
    if (c.namespaceURI === TEXT) {
      if (ODT_SKIP.has(c.localName)) continue;
      if (c.localName === 's') {
        out += ' '.repeat(Math.max(1, Number(c.getAttributeNS(TEXT, 'c') ?? 1) || 1));
        continue;
      }
      if (c.localName === 'tab') {
        out += '\t';
        continue;
      }
      if (c.localName === 'line-break') {
        out += '\n';
        continue;
      }
    }
    out += odtInline(c);
  }
  return out;
}

function odtParagraph(el: Element): string {
  // Collapsed white space at the start and end of a paragraph is dropped.
  return odtInline(el).replace(/^ +| +$/g, '');
}

function odtCellText(cell: Element): string {
  const parts: string[] = [];
  const walk = (el: Element) => {
    for (const c of children(el)) {
      if (c.namespaceURI === TEXT && (c.localName === 'p' || c.localName === 'h')) parts.push(odtParagraph(c).replace(/[\t\n]/g, ' ').trim());
      else walk(c);
    }
  };
  walk(cell);
  return parts.filter(Boolean).join(' ');
}

function odtBody(el: Element, blocks: TextBlock[], inList: boolean): void {
  for (const c of children(el)) {
    if (c.namespaceURI === TEXT && c.localName === 'h') {
      push(blocks, headingKind(Number(c.getAttributeNS(TEXT, 'outline-level') ?? 1) || 1), odtParagraph(c));
    } else if (c.namespaceURI === TEXT && c.localName === 'p') {
      push(blocks, inList ? 'li' : 'p', odtParagraph(c));
    } else if (c.namespaceURI === TEXT && (c.localName === 'list' || c.localName === 'list-item' || c.localName === 'list-header')) {
      odtBody(c, blocks, true);
    } else if (c.namespaceURI === TABLE && c.localName === 'table-row') {
      const cells = children(c).filter((x) => x.namespaceURI === TABLE && x.localName === 'table-cell').map(odtCellText);
      if (cells.some(Boolean)) blocks.push({ kind: 'row', text: cells.join('\t') });
    } else if (c.namespaceURI === TEXT && ODT_SKIP.has(c.localName)) {
      continue;
    } else if (c.namespaceURI === TABLE && (c.localName === 'table-columns' || c.localName === 'table-column')) {
      continue;
    } else {
      odtBody(c, blocks, inList);
    }
  }
}

export function parseOdtXml(xml: string): TextBlock[] {
  const doc = parseXml(xml);
  const text = doc.getElementsByTagNameNS(OFFICE, 'text')[0];
  const blocks: TextBlock[] = [];
  if (text) odtBody(text, blocks, false);
  return blocks;
}
