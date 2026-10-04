// Finding an element by typing: label first, then property values (a phone
// number, an alias). Case, accents and punctuation are ignored.

import { normalizeName } from './dictionary.ts';

export interface SearchableElement {
  id: string;
  label: string;
  properties: { key: string; value: unknown }[];
}

export interface ElementHit<T extends SearchableElement> {
  element: T;
  /** Property whose value matched, when the label did not. */
  property?: { key: string; value: string };
}

const valueText = (v: unknown): string => (v instanceof Date ? v.toLocaleDateString('fr-FR') : v === null || v === undefined ? '' : String(v));

/**
 * Elements matching every word of the query, labels starting with it first,
 * then labels containing it, then matches on a property value.
 */
export function searchElements<T extends SearchableElement>(elements: T[], query: string, limit = 30): ElementHit<T>[] {
  const words = normalizeName(query).split(' ').filter(Boolean);
  if (!words.length) return elements.slice(0, limit).map((element) => ({ element }));
  const matches = (text: string) => {
    const n = normalizeName(text);
    return words.every((w) => n.includes(w));
  };
  const first = normalizeName(query);
  const starts: ElementHit<T>[] = [];
  const contains: ElementHit<T>[] = [];
  const byProperty: ElementHit<T>[] = [];
  for (const element of elements) {
    if (matches(element.label)) {
      (normalizeName(element.label).startsWith(first) ? starts : contains).push({ element });
      continue;
    }
    const prop = element.properties.find((p) => matches(valueText(p.value)));
    if (prop) byProperty.push({ element, property: { key: prop.key, value: valueText(prop.value) } });
  }
  return [...starts, ...contains, ...byProperty].slice(0, limit);
}
