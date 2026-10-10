import { describe, expect, it } from 'vitest';
import { pdfPageText } from './pageText.ts';

describe('pdfPageText', () => {
  it('joins item strings with a line break after end-of-line items, as the text layer does', () => {
    const items = [{ str: 'Procès-verbal', hasEOL: true }, { type: 'marked' } as never, { str: 'Le 24 ' }, { str: 'septembre', hasEOL: true }];
    const { text, starts, kept } = pdfPageText(items);
    expect(text).toBe('Procès-verbal\nLe 24 septembre\n');
    expect(starts).toEqual([0, 14, 20]);
    expect(kept).toHaveLength(3);
  });
});
