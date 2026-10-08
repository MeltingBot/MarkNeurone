// Finding an element by typing: label first, then property values (a phone
// number, an alias). Case, accents and punctuation are ignored.

import { normalizeName } from './dictionary.ts';
import { sourceLabels } from './anchors.ts';

export interface SearchableElement {
  id: string;
  label: string;
  properties: { key: string; value: unknown }[];
  /** ZN source field: the references of the documents it was read in. */
  source?: string | null;
}

export interface ElementHit<T extends SearchableElement> {
  element: T;
  /** Property whose value matched, when the label did not. */
  property?: { key: string; value: string };
  /** Source (document reference) that matched, when nothing else did. */
  reference?: string;
}

const valueText = (v: unknown): string => (v instanceof Date ? v.toLocaleDateString('fr-FR') : v === null || v === undefined ? '' : String(v));

/**
 * Elements matching every word of the query, labels starting with it first,
 * then labels containing it, then matches on a property value, then on a
 * source (a document reference such as "00347/2026"). Within each group,
 * `first` ids come first (e.g. elements read in the open document).
 */
export function searchElements<T extends SearchableElement>(elements: T[], query: string, limit = 30, first: Set<string> = new Set()): ElementHit<T>[] {
  const words = normalizeName(query).split(' ').filter(Boolean);
  const firstOut = (hits: ElementHit<T>[]) => [...hits.filter((h) => first.has(h.element.id)), ...hits.filter((h) => !first.has(h.element.id))];
  if (!words.length) return firstOut(elements.map((element) => ({ element }))).slice(0, limit);
  const matches = (text: string) => {
    const n = normalizeName(text);
    return words.every((w) => n.includes(w));
  };
  const start = normalizeName(query);
  const starts: ElementHit<T>[] = [];
  const contains: ElementHit<T>[] = [];
  const byProperty: ElementHit<T>[] = [];
  const bySource: ElementHit<T>[] = [];
  for (const element of elements) {
    if (matches(element.label)) {
      (normalizeName(element.label).startsWith(start) ? starts : contains).push({ element });
      continue;
    }
    const prop = element.properties.find((p) => matches(valueText(p.value)));
    if (prop) {
      byProperty.push({ element, property: { key: prop.key, value: valueText(prop.value) } });
      continue;
    }
    const reference = sourceLabels(element.source).find(matches);
    if (reference) bySource.push({ element, reference });
  }
  return [starts, contains, byProperty, bySource].flatMap(firstOut).slice(0, limit);
}

export interface SearchableEvent {
  id: string;
  label: string;
  date: Date | string;
  description?: string;
}

const eventDate = (d: Date | string) => new Date(d).toLocaleDateString('fr-FR');

/**
 * Events matching every word of the query in their label, date (as
 * dd/mm/yyyy) or description. `first` ids come first (e.g. events read on
 * the same page), then the others by date.
 */
export function searchEvents<T extends SearchableEvent>(events: T[], query: string, first: Set<string> = new Set()): T[] {
  const words = normalizeName(query).split(' ').filter(Boolean);
  const byDate = (a: T, b: T) => new Date(a.date).getTime() - new Date(b.date).getTime();
  const ordered = [...events.filter((e) => first.has(e.id)).sort(byDate), ...events.filter((e) => !first.has(e.id)).sort(byDate)];
  if (!words.length) return ordered;
  return ordered.filter((e) => {
    // Dates keep their digits together: "01/01/2018" is searched as "01 01 2018".
    const text = normalizeName(`${e.label} ${eventDate(e.date)} ${e.description ?? ''}`);
    return words.every((w) => text.includes(w));
  });
}

export interface NamedElement extends SearchableElement {
  tags: string[];
}

/** Elements sharing a label (case, accents and punctuation aside), by that label; unique labels left out. */
export function homonymGroups<T extends NamedElement>(elements: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const el of elements) {
    const name = normalizeName(el.label);
    if (!name) continue;
    const group = groups.get(name);
    if (group) group.push(el);
    else groups.set(name, [el]);
  }
  for (const [name, group] of groups) if (group.length < 2) groups.delete(name);
  return groups;
}

export interface Discriminants {
  properties: { key: string; value: string }[];
  /** Labels of the elements it is linked to and not all the others are. */
  linked: string[];
}

/**
 * What tells an element apart from the others bearing the same label: the
 * property values and linked elements that not all of them share (tags are
 * shown anyway).
 * Null when the label is unique.
 */
export function discriminants<T extends NamedElement>(
  element: T,
  groups: Map<string, T[]>,
  linkedLabels: (id: string) => string[] = () => [],
  max = 3,
): Discriminants | null {
  const others = groups.get(normalizeName(element.label))?.filter((o) => o.id !== element.id);
  if (!others?.length) return null;
  const sharedByAll = (has: (o: T) => boolean) => others.every(has);
  const properties: { key: string; value: string }[] = [];
  for (const p of element.properties) {
    const value = valueText(p.value);
    if (value && !sharedByAll((o) => o.properties.some((q) => q.key === p.key && valueText(q.value) === value))) properties.push({ key: p.key, value });
  }
  const linked = [...new Set(linkedLabels(element.id))];
  return {
    properties: properties.slice(0, max),
    linked: linked.filter((l) => !sharedByAll((o) => linkedLabels(o.id).includes(l))).slice(0, max),
  };
}
