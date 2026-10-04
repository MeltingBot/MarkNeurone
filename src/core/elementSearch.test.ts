import { describe, expect, it } from 'vitest';
import { searchElements } from './elementSearch.ts';

const el = (id: string, label: string, properties: { key: string; value: unknown }[] = []) => ({ id, label, properties });
const elements = [
  el('1', 'Dylan MARTINEAU'),
  el('2', 'SARL Bois et Charpentes Vallier'),
  el('3', 'Laurent VALLIER', [{ key: 'Téléphone', value: '06 12 34 56 78' }]),
  el('4', 'Hélène CARRÈRE'),
];

describe('searchElements', () => {
  it('ignores case and accents, labels starting with the query first', () => {
    expect(searchElements(elements, 'vallier').map((h) => h.element.id)).toEqual(['2', '3']);
    expect(searchElements([...elements, el('5', 'Vallier Transports')], 'vallier').map((h) => h.element.id)).toEqual(['5', '2', '3']);
    expect(searchElements(elements, 'helene').map((h) => h.element.id)).toEqual(['4']);
    expect(searchElements(elements, 'laurent').map((h) => h.element.id)).toEqual(['3']);
  });

  it('matches every word, in any order', () => {
    expect(searchElements(elements, 'vallier laurent').map((h) => h.element.id)).toEqual(['3']);
  });

  it('finds an element by a property value, and says which one', () => {
    const [hit] = searchElements(elements, '0612 34');
    expect(hit).toBeUndefined();
    const [byPhone] = searchElements(elements, '06 12 34');
    expect(byPhone.element.id).toBe('3');
    expect(byPhone.property).toEqual({ key: 'Téléphone', value: '06 12 34 56 78' });
  });

  it('lists elements up to the limit with an empty query', () => {
    expect(searchElements(elements, '  ', 2)).toHaveLength(2);
  });
});
