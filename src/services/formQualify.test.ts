import { describe, expect, it } from 'vitest';
import { rowProperty, sameValue } from './formQualify.ts';
import type { DraftRow } from '../core/formSession.ts';

const row = (changes: Partial<DraftRow>): DraftRow => ({ id: 'r', kind: 'property', key: 'K', text: '', anchor: { page: 1, start: 0, end: 1 }, type: 'text', checked: true, ...changes });

describe('rowProperty', () => {
  it('types dates at noon and numbers, text otherwise', () => {
    const d = rowProperty(row({ type: 'date', text: '12/04/1987' }));
    expect(d.type).toBe('date');
    expect([(d.value as Date).getDate(), (d.value as Date).getHours()]).toEqual([12, 12]);
    expect(rowProperty(row({ type: 'number', text: '1 234,5' }))).toEqual({ key: 'K', value: 1234.5, type: 'number' });
    expect(rowProperty(row({ type: 'date', text: 'inconnue' }))).toEqual({ key: 'K', value: 'inconnue', type: 'text' });
  });
});

describe('sameValue', () => {
  it('compares days for dates, folded text otherwise', () => {
    expect(sameValue('12/04/1987', new Date(1987, 3, 12, 12))).toBe(true);
    expect(sameValue(new Date(1987, 3, 12, 0), new Date(1987, 3, 12, 12))).toBe(true);
    expect(sameValue('13/04/1987', new Date(1987, 3, 12, 12))).toBe(false);
    expect(sameValue('Féminin', 'feminin ')).toBe(true);
    expect(sameValue('06 12 34 56 78', '06 12 34 56 79')).toBe(false);
    expect(sameValue(null, 'x')).toBe(false);
  });
});

describe('yes or no', () => {
  const row = (text: string): DraftRow => ({ id: 'r', kind: 'property', key: 'Urgent', text, anchor: { page: 1, start: 0, end: 1 }, type: 'boolean', checked: true });
  it('stores a yes or no as a boolean, anything else as text', () => {
    expect(rowProperty(row('Oui'))).toEqual({ key: 'Urgent', value: true, type: 'boolean' });
    expect(rowProperty(row('x'))).toEqual({ key: 'Urgent', value: true, type: 'boolean' });
    expect(rowProperty(row('Non'))).toEqual({ key: 'Urgent', value: false, type: 'boolean' });
    expect(rowProperty(row('peut-être'))).toEqual({ key: 'Urgent', value: 'peut-être', type: 'text' });
  });
});
