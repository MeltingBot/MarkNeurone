import { describe, expect, it } from 'vitest';
import { analyseTextLayer, countTextChars } from './textLayerDetection.ts';

describe('analyseTextLayer', () => {
  it('flags a fully scanned document', () => {
    expect(analyseTextLayer([0, 3, 12])).toEqual({ imagePages: [1, 2, 3], imageOnly: true });
  });

  it('keeps a text document', () => {
    expect(analyseTextLayer([1800, 2100])).toEqual({ imagePages: [], imageOnly: false });
  });

  it('lists scanned pages inside a mixed document', () => {
    expect(analyseTextLayer([1800, 0, 950])).toEqual({ imagePages: [2], imageOnly: false });
  });

  it('does not call an empty document image-only', () => {
    expect(analyseTextLayer([]).imageOnly).toBe(false);
  });
});

describe('countTextChars', () => {
  it('counts non-blank characters and skips marked content', () => {
    expect(countTextChars([{ str: 'Le PV ' }, { str: '' }, { str: ' n° 12' }, {}])).toBe(8);
  });
});
