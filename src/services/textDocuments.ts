// ─── Text documents: file to blocks ──────────────────────────
//
// DOCX and ODT are ZIP archives; only their main XML part is read.

import JSZip from 'jszip';
import { decodeText, parseDocxXml, parseMarkdown, parseOdtXml, parseTxt, type TextBlock, type TextFormat } from '../core/textDocument.ts';

async function zipEntry(bytes: Uint8Array, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file(path);
  if (!entry) throw new Error(`missing-${path}`);
  return entry.async('string');
}

export async function readTextDocument(bytes: Uint8Array, format: TextFormat): Promise<TextBlock[]> {
  switch (format) {
    case 'docx':
      return parseDocxXml(await zipEntry(bytes, 'word/document.xml'));
    case 'odt':
      return parseOdtXml(await zipEntry(bytes, 'content.xml'));
    case 'md':
      return parseMarkdown(decodeText(bytes));
    case 'txt':
      return parseTxt(decodeText(bytes));
  }
}
