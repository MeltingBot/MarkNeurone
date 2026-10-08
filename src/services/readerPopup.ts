// ─── Reader in a window of its own ───────────────────────────
//
// Same approach as ZN's detached side panel (hooks/useDetachedWindow): an
// empty window of the same origin, given ZN's stylesheets and theme, in
// which the reader is rendered through a React portal. Nothing leaves the
// machine: the window has no address and loads nothing but ZN's own styles.

const NAME = 'markneurone-reader';

export interface ReaderPopup {
  win: Window;
  container: HTMLElement;
  close: () => void;
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Styles of ZN's window, as links or inline rules. */
function styleTags(): string {
  const tags: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.href) tags.push(`<link rel="stylesheet" href="${escapeHtml(sheet.href)}">`);
      else tags.push(`<style>${Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')}</style>`);
    } catch {
      // Stylesheet of another origin: not readable, left out.
    }
  }
  return tags.join('\n');
}

/**
 * Opens the window and resolves once its styles are loaded. Null when the
 * browser blocked it. `onClosed` runs when the user closes the window.
 */
export function openReaderPopup(title: string, onClosed: () => void): Promise<ReaderPopup | null> {
  const width = Math.min(1400, window.screen.availWidth);
  const height = Math.min(900, window.screen.availHeight);
  const win = window.open('', NAME, `width=${width},height=${height},resizable=yes,scrollbars=no`);
  if (!win) return Promise.resolve(null);

  const theme = document.documentElement.getAttribute('data-theme');
  const doc = win.document;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html class="${escapeHtml(document.documentElement.className)}"${theme ? ` data-theme="${escapeHtml(theme)}"` : ''}>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
${styleTags()}
<style>body { margin: 0; overflow: hidden; } #mn-reader-root { height: 100vh; display: flex; flex-direction: column; }</style>
</head>
<body class="${escapeHtml(document.body.className)}"><div id="mn-reader-root"></div></body>
</html>`);
  doc.close();

  let poll = 0;
  const close = () => {
    clearInterval(poll);
    window.removeEventListener('beforeunload', close);
    if (!win.closed) win.close();
  };
  poll = window.setInterval(() => {
    if (win.closed) {
      close();
      onClosed();
    }
  }, 500);
  // ZN's window reloaded or closed: the reader window goes with it.
  window.addEventListener('beforeunload', close);

  return new Promise((resolve) => {
    let done = false;
    const ready = () => {
      if (done) return;
      done = true;
      const container = doc.getElementById('mn-reader-root');
      resolve(container ? { win, container, close } : null);
    };
    const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter((l) => !l.sheet);
    let left = links.length;
    if (!left) ready();
    for (const link of links) {
      const one = () => {
        left -= 1;
        if (left <= 0) ready();
      };
      link.addEventListener('load', one);
      link.addEventListener('error', one);
    }
    // A stylesheet that never answers does not keep the reader away.
    setTimeout(ready, 2000);
  });
}
