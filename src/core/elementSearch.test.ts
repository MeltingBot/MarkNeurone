import { describe, expect, it } from 'vitest';
import { searchElements, searchEvents } from './elementSearch.ts';

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

describe('searchEvents', () => {
  const events = [
    { id: 'a', label: 'Prospection', date: new Date('2018-01-01T12:00:00'), description: 'Visite des clients' },
    { id: 'b', label: 'Embauche', date: new Date('2016-05-03T12:00:00') },
    { id: 'c', label: 'Départ', date: new Date('2020-02-10T12:00:00') },
  ];
  it('puts the given events first, then the others by date', () => {
    expect(searchEvents(events, '', new Set(['c'])).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });
  it('matches label, date and description, case and accents aside', () => {
    expect(searchEvents(events, 'depart').map((e) => e.id)).toEqual(['c']);
    expect(searchEvents(events, '2018').map((e) => e.id)).toEqual(['a']);
    expect(searchEvents(events, '03/05').map((e) => e.id)).toEqual(['b']);
    expect(searchEvents(events, 'clients').map((e) => e.id)).toEqual(['a']);
  });
});
