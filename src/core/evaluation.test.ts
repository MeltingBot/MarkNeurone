import { describe, expect, it } from 'vitest';
import { evaluationModelOf, formatEvaluation, withAxis } from './evaluation.ts';

describe('evaluationModelOf', () => {
  it('falls back to the confidence model', () => {
    expect(evaluationModelOf(null)).toBe('zeroneurone');
    expect(evaluationModelOf({})).toBe('zeroneurone');
    expect(evaluationModelOf({ evaluationModel: 'other' })).toBe('zeroneurone');
    expect(evaluationModelOf({ evaluationModel: 'admiralty' })).toBe('admiralty');
  });
});

describe('withAxis', () => {
  it('sets one axis and keeps the other', () => {
    const b = withAxis(null, 'europol', 'source', 'B');
    expect(b).toEqual({ scale: 'europol', source: 'B', info: null });
    expect(formatEvaluation(withAxis(b, 'europol', 'info', '2'))).toBe('B2');
  });

  it('replaces a grading made in another scale', () => {
    expect(withAxis({ scale: 'admiralty', source: 'E', info: '5' }, 'europol', 'info', '3')).toEqual({ scale: 'europol', source: null, info: '3' });
  });

  it('gives null once both axes are cleared', () => {
    expect(withAxis({ scale: 'europol', source: 'A', info: null }, 'europol', 'source', '')).toBeNull();
  });
});
