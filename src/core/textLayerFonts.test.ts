import { describe, expect, it } from 'vitest';
import { fitTextStyles, textLayerFamily } from './textLayerFonts.ts';

describe('textLayerFamily', () => {
  it('matches the PDF font name, subset prefix removed', () => {
    expect(textLayerFamily('BAAAAA+TimesNewRomanPSMT', 'serif')).toMatch(/^"Times New Roman"/);
    expect(textLayerFamily('ABCDEF+Arial-BoldMT', 'sans-serif')).toMatch(/^Arial/);
    expect(textLayerFamily('Calibri,Bold', 'sans-serif')).toMatch(/^Calibri, Carlito/);
    expect(textLayerFamily('CourierNewPSMT', 'monospace')).toMatch(/^"Courier New"/);
    expect(textLayerFamily('Liberation Serif', 'sans-serif')).toMatch(/^"Times New Roman"/);
  });

  it('falls back on a metric-compatible family for the generic one', () => {
    expect(textLayerFamily('XYZABC+Garamond', 'serif')).toMatch(/^"Times New Roman"/);
    expect(textLayerFamily(undefined, 'sans-serif')).toMatch(/^Arial/);
    expect(textLayerFamily(undefined, 'monospace')).toMatch(/^"Courier New"/);
  });

  it('keeps an unknown generic family', () => {
    expect(textLayerFamily(undefined, 'cursive')).toBe('cursive');
  });
});

describe('fitTextStyles', () => {
  it('replaces each style family', () => {
    const styles = { f1: { fontFamily: 'serif' }, f2: { fontFamily: 'sans-serif' } };
    fitTextStyles(styles, (key) => (key === 'f2' ? 'Calibri' : undefined));
    expect(styles.f1.fontFamily).toMatch(/^"Times New Roman"/);
    expect(styles.f2.fontFamily).toMatch(/^Calibri/);
  });
});
