// ─── Text document sheet ─────────────────────────────────────
//
// Visible, selectable text of a text document, built with the structure the
// selection code expects from a text layer: its text (text nodes, <br> as
// "\n") is exactly blocksText(blocks). Bullets are CSS, not text; table
// cells, and the label and value of a field, are separated by hidden "\t"
// so that offsets keep them.

import type { TextBlock } from '../core/textDocument.ts';

/** Sheet width, in page units (A4 width in points, like a PDF page). */
export const TEXT_SHEET_WIDTH = 595;

export const TEXT_SHEET_CSS = `
.mn-page .textLayer.mn-flow { position: relative; inset: auto; overflow: visible; line-height: 1.5; color: #1f2328;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; tab-size: 4;
  padding: calc(var(--scale-factor) * 56px) calc(var(--scale-factor) * 64px); min-height: calc(var(--scale-factor) * 842px); box-sizing: border-box; }
.mn-page .textLayer.mn-flow > .mn-b { position: relative; z-index: 1; transform: none; white-space: pre-wrap; overflow-wrap: anywhere;
  font-size: calc(var(--scale-factor) * 11px); margin: 0 0 0.6em; }
.mn-page .textLayer.mn-flow span { position: static; color: inherit; white-space: pre-wrap; transform: none; }
.mn-page .textLayer.mn-flow br { position: static; }
.mn-page .textLayer.mn-flow ::selection { background: rgba(0 0 255 / 0.2); color: #1f2328; }
.mn-page .textLayer.mn-flow > .mn-h1 { font-size: calc(var(--scale-factor) * 17px); font-weight: 600; margin-top: 0.8em; }
.mn-page .textLayer.mn-flow > .mn-h2 { font-size: calc(var(--scale-factor) * 14px); font-weight: 600; margin-top: 0.6em; }
.mn-page .textLayer.mn-flow > .mn-h3 { font-size: calc(var(--scale-factor) * 12px); font-weight: 600; }
.mn-page .textLayer.mn-flow > .mn-li { padding-left: 1.4em; margin-bottom: 0.2em; }
.mn-page .textLayer.mn-flow > .mn-li::before { content: '\\2022'; position: absolute; left: 0.4em; user-select: none; }
.mn-page .textLayer.mn-flow > .mn-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); column-gap: 1em;
  margin: 0; padding: 0.25em 0; border-bottom: 1px solid #d0d7de; }
.mn-page .textLayer.mn-flow > .mn-row > .mn-sep, .mn-page .textLayer.mn-flow > .mn-row > br { display: none; }
.mn-page .textLayer.mn-flow > .mn-pre { margin: 0; }
.mn-page .textLayer.mn-flow > .mn-field { display: grid; grid-template-columns: 7em minmax(0, 1fr); column-gap: 1em; margin: 0; padding: 0.15em 0; }
.mn-page .textLayer.mn-flow > .mn-field > span:first-child { color: #59636e; }
.mn-page .textLayer.mn-flow > .mn-field > .mn-sep, .mn-page .textLayer.mn-flow > .mn-field > br { display: none; }
.mn-page .textLayer.mn-flow > .mn-field + .mn-b:not(.mn-field) { margin-top: 0.8em; }
.mn-page .textLayer.mn-flow > .mn-b:not(.mn-field) + .mn-field { margin-top: 0.8em; }
.mn-page .textLayer.mn-flow > .mn-row + .mn-b:not(.mn-row) { margin-top: 0.6em; }
`;

export function renderTextBlocks(container: HTMLElement, blocks: TextBlock[]): void {
  const fragment = document.createDocumentFragment();
  for (const block of blocks) {
    const div = document.createElement('div');
    div.className = `mn-b mn-${block.kind}`;
    if (block.kind === 'row' || block.kind === 'field') {
      block.text.split('\t').forEach((cell, i) => {
        if (i > 0) {
          const sep = document.createElement('span');
          sep.className = 'mn-sep';
          sep.textContent = '\t';
          div.appendChild(sep);
        }
        const span = document.createElement('span');
        span.textContent = cell;
        div.appendChild(span);
      });
    } else {
      div.appendChild(document.createTextNode(block.text));
    }
    div.appendChild(document.createElement('br'));
    fragment.appendChild(div);
  }
  container.replaceChildren(fragment);
  container.classList.add('mn-flow');
}
