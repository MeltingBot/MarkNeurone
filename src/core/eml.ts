// ─── E-mails (.eml) ──────────────────────────────────────────
//
// An e-mail is read as text blocks: its main headers as label/value fields,
// then its text body, then the names of its attachments. A forwarded message
// attached to it (message/rfc822) is read the same way after its own title.
//
// Labels are part of the text that annotation offsets count: they are fixed
// here, in French like ZeroNeurone's own e-mail preview, and never translated.
// Any change in these rules requires a new TEXT_EXTRACTOR_ID.
//
// Not read: attachments' contents, inline images, other headers.

import { decodeText, parseTxt, type BlockKind, type TextBlock } from './textDocument.ts';

const HEADER_FIELDS: Array<[string, string]> = [
  ['from', 'De'],
  ['to', 'À'],
  ['cc', 'Cc'],
  ['date', 'Date'],
  ['subject', 'Sujet'],
];
const ATTACHMENTS_LABEL = 'Pièces jointes';
const FORWARDED_TITLE = 'Message joint';
const MAX_DEPTH = 10;

// ─── Bytes and charsets ──────────────────────────────────────

/** One char per byte, so that parts can be decoded with their own charset. */
function binaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return out;
}

function bytesOf(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** Declared charset when known, else UTF-8 or Windows-1252 like a text file. */
function decodeCharset(bytes: Uint8Array, charset: string | null): string {
  const label = charset?.replace(/\*.*$/, '').trim();
  if (label && !/^(us-ascii|ascii)$/i.test(label)) {
    try {
      return new TextDecoder(label).decode(bytes).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    } catch {
      // Unknown label: guess below.
    }
  }
  return decodeText(bytes);
}

function decodeBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  try {
    // A single leftover character carries no full byte.
    return bytesOf(atob(clean.length % 4 === 1 ? clean.slice(0, -1) : clean));
  } catch {
    return new Uint8Array();
  }
}

function decodeQuotedPrintable(s: string): Uint8Array {
  return bytesOf(s.replace(/=\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))));
}

// ─── Headers ─────────────────────────────────────────────────

/** RFC 2047 encoded words; adjacent ones join without the space between them. */
function decodeEncodedWords(value: string): string {
  return value
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?[^?]+\?[BbQq]\?[^?]*\?=)/g, '$1')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset: string, enc: string, data: string) =>
      decodeCharset(enc.toUpperCase() === 'B' ? decodeBase64(data) : decodeQuotedPrintable(data.replace(/_/g, ' ')), charset));
}

type Headers = Map<string, string>;

/** First occurrence of each header, unfolded. Raw 8-bit headers are read as UTF-8 or Windows-1252. */
function parseHeaders(raw: string): Headers {
  const headers: Headers = new Map();
  for (const line of decodeText(bytesOf(raw)).replace(/\n[ \t]+/g, ' ').split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!headers.has(name)) headers.set(name, line.slice(colon + 1).trim());
  }
  return headers;
}

/** A parameter of a structured header, RFC 2231 forms included. */
function headerParam(value: string | undefined, name: string): string | null {
  if (!value) return null;
  const params = value.split(';').slice(1).map((p) => {
    const eq = p.indexOf('=');
    return eq < 0 ? null : { key: p.slice(0, eq).trim().toLowerCase(), value: p.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1') };
  }).filter((p): p is { key: string; value: string } => p !== null);
  const plain = params.find((p) => p.key === name);
  const extended = params
    .filter((p) => p.key === `${name}*` || new RegExp(`^${name}\\*\\d+\\*?$`).test(p.key))
    .sort((a, b) => (Number(a.key.match(/\*(\d+)/)?.[1] ?? 0)) - Number(b.key.match(/\*(\d+)/)?.[1] ?? 0));
  if (extended.length) {
    const joined = extended.map((p) => p.value).join('');
    const ext = joined.match(/^([^']*)'[^']*'(.*)$/);
    if (ext) {
      const bytes = bytesOf(ext[2].replace(/%([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))));
      return decodeCharset(bytes, ext[1] || null);
    }
    return joined;
  }
  return plain ? decodeEncodedWords(plain.value) : null;
}

// ─── MIME parts ──────────────────────────────────────────────

interface Part {
  headers: Headers;
  body: string;
}

function splitPart(raw: string): Part {
  const end = raw.indexOf('\n\n');
  if (end < 0) return { headers: parseHeaders(raw), body: '' };
  return { headers: parseHeaders(raw.slice(0, end)), body: raw.slice(end + 2) };
}

function mimeType(part: Part): string {
  return (part.headers.get('content-type') ?? 'text/plain').split(';')[0].trim().toLowerCase();
}

function subParts(part: Part): Part[] {
  const boundary = headerParam(part.headers.get('content-type'), 'boundary');
  if (!boundary) return [];
  const marker = `--${boundary}`;
  const parts: Part[] = [];
  let current: string[] | null = null;
  for (const line of part.body.split('\n')) {
    const trimmed = line.trimEnd();
    if (trimmed === marker || trimmed === `${marker}--`) {
      if (current) parts.push(splitPart(current.join('\n')));
      if (trimmed !== marker) return parts;
      current = [];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) parts.push(splitPart(current.join('\n')));
  return parts;
}

function decodeBody(part: Part): string {
  const encoding = (part.headers.get('content-transfer-encoding') ?? '').trim().toLowerCase();
  const bytes = encoding === 'base64' ? decodeBase64(part.body) : encoding === 'quoted-printable' ? decodeQuotedPrintable(part.body) : bytesOf(part.body);
  return decodeCharset(bytes, headerParam(part.headers.get('content-type'), 'charset'));
}

function filenameOf(part: Part): string | null {
  return headerParam(part.headers.get('content-disposition'), 'filename') ?? headerParam(part.headers.get('content-type'), 'name');
}

function isAttachment(part: Part): boolean {
  if (/^\s*attachment/i.test(part.headers.get('content-disposition') ?? '')) return true;
  const type = mimeType(part);
  return type !== 'text/plain' && type !== 'text/html' && !type.startsWith('multipart/');
}

// ─── Bodies to blocks ────────────────────────────────────────

/** format=flowed: a line ending with a space continues on the next one. */
function unflow(text: string, delsp: boolean): string {
  return text.split('\n').reduce((out, line, i, lines) => {
    const flowed = line.endsWith(' ') && line !== '-- ' && i < lines.length - 1;
    return out + (flowed ? (delsp ? line.slice(0, -1) : line) : `${line}\n`);
  }, '');
}

function plainBlocks(part: Part): TextBlock[] {
  let text = decodeBody(part);
  const type = part.headers.get('content-type');
  if (headerParam(type, 'format')?.toLowerCase() === 'flowed') text = unflow(text, headerParam(type, 'delsp')?.toLowerCase() === 'yes');
  return parseTxt(text);
}

const HTML_SKIP = new Set(['script', 'style', 'head', 'title', 'img', 'svg', 'template', 'noscript']);
const HTML_BLOCK = new Set(['p', 'div', 'blockquote', 'section', 'article', 'header', 'footer', 'main', 'center', 'table', 'tbody', 'thead', 'tfoot', 'ul', 'ol', 'dl', 'dt', 'dd', 'pre', 'hr', 'address', 'form', 'fieldset', 'figure']);

function htmlBlocks(html: string): TextBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: TextBlock[] = [];
  let inline = '';
  let inlineKind: BlockKind = 'p';
  const flush = () => {
    const text = inline.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/^[ \n]+|[ \n]+$/g, '');
    if (text) blocks.push({ kind: inlineKind, text });
    inline = '';
    inlineKind = 'p';
  };
  const cellText = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const walk = (node: Node) => {
    for (const n of Array.from(node.childNodes)) {
      if (n.nodeType === 3) {
        inline += (n.nodeValue ?? '').replace(/[ \t\r\n\f]+/g, ' ');
        continue;
      }
      if (n.nodeType !== 1) continue;
      const el = n as Element;
      const tag = el.localName;
      if (HTML_SKIP.has(tag)) continue;
      if (tag === 'br') {
        inline += '\n';
      } else if (/^h[1-6]$/.test(tag)) {
        flush();
        const level = Number(tag[1]);
        inlineKind = level <= 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
        walk(el);
        flush();
      } else if (tag === 'li') {
        flush();
        inlineKind = 'li';
        walk(el);
        flush();
      } else if (tag === 'tr' && !el.querySelector('table')) {
        flush();
        const cells = Array.from(el.children).filter((c) => c.localName === 'td' || c.localName === 'th').map(cellText);
        if (cells.length > 1 && cells.some(Boolean)) blocks.push({ kind: 'row', text: cells.join('\t') });
        else if (cells.some(Boolean)) blocks.push({ kind: 'p', text: cells.filter(Boolean).join(' ') });
      } else if (tag === 'a') {
        // A link keeps its address, which may matter (as in Markdown).
        walk(el);
        const href = el.getAttribute('href')?.trim() ?? '';
        const label = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (/^https?:\/\//i.test(href) && label && label !== href) inline += ` (${href})`;
      } else if (HTML_BLOCK.has(tag) || tag === 'tr' || tag === 'td' || tag === 'th') {
        flush();
        walk(el);
        flush();
      } else {
        walk(el);
      }
    }
  };
  walk(doc.body ?? doc.documentElement);
  flush();
  return blocks;
}

// ─── Message ─────────────────────────────────────────────────

interface Collected {
  body: TextBlock[];
  attachments: string[];
}

function collect(part: Part, out: Collected, depth: number): void {
  if (depth > MAX_DEPTH) return;
  const type = mimeType(part);
  // A forwarded message is read even when sent as an attachment.
  if (type === 'message/rfc822') {
    out.body.push({ kind: 'h2', text: FORWARDED_TITLE }, ...messageBlocks(splitPart(part.body), depth + 1));
    return;
  }
  if (isAttachment(part)) {
    // Tabs and line breaks separate fields and names: never in a name.
    const name = filenameOf(part)?.replace(/\s+/g, ' ').trim();
    if (name) out.attachments.push(name);
    return;
  }
  if (type === 'multipart/alternative') {
    const parts = subParts(part);
    const plain = parts.find((p) => mimeType(p) === 'text/plain' && !isAttachment(p) && decodeBody(p).trim());
    const chosen = plain ?? parts.filter((p) => !isAttachment(p)).pop();
    if (chosen) collect(chosen, out, depth + 1);
    return;
  }
  if (type.startsWith('multipart/')) {
    for (const p of subParts(part)) collect(p, out, depth + 1);
    return;
  }
  if (type === 'text/html') out.body.push(...htmlBlocks(decodeBody(part)));
  else out.body.push(...plainBlocks(part));
}

function messageBlocks(message: Part, depth: number): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const [name, label] of HEADER_FIELDS) {
    const value = decodeEncodedWords(message.headers.get(name) ?? '').replace(/\s+/g, ' ').trim();
    if (value) blocks.push({ kind: 'field', text: `${label}\t${value}` });
  }
  const out: Collected = { body: [], attachments: [] };
  collect(message, out, depth);
  blocks.push(...out.body);
  if (out.attachments.length) blocks.push({ kind: 'field', text: `${ATTACHMENTS_LABEL}\t${out.attachments.join('\n')}` });
  return blocks;
}

export function parseEml(bytes: Uint8Array): TextBlock[] {
  const raw = binaryString(bytes).replace(/\r\n?/g, '\n');
  // Some exports (mbox) start with a "From " line before the headers.
  return messageBlocks(splitPart(raw.replace(/^From .*\n/, '')), 0);
}
