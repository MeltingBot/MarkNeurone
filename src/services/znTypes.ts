// Subset of ZN's data model used by the plugin (zeroneurone/src/types/index.ts).
// Type-only: the plugin never imports ZN types at runtime.

import type { Evaluation } from '../core/evaluation.ts';

export type ZnPropertyType = 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'choice' | 'geo' | 'country' | 'link';

export interface ZnProperty {
  key: string;
  value: string | number | boolean | Date | null;
  type?: ZnPropertyType;
}

/** ZN GeoData: a point, or a zone drawn in ZN (kept as is by the plugin). */
export type ZnGeo =
  | { type: 'point'; lat: number; lng: number; altitude?: number; extrude?: boolean }
  | { type: 'polygon'; center: { lat: number; lng: number }; [key: string]: unknown };

export interface ZnElementEvent {
  id: string;
  date: Date;
  dateEnd?: Date;
  label: string;
  description?: string;
  source?: string;
  geo?: ZnGeo;
  /** Typed properties, as on elements and links. */
  properties?: ZnProperty[];
}

export interface ZnElement {
  id: string;
  label: string;
  tags: string[];
  properties: ZnProperty[];
  source: string;
  /** Files attached to the element (ZN assets). */
  assetIds?: string[];
  events: ZnElementEvent[];
  position: { x: number; y: number };
  geo?: ZnGeo | null;
  /** 0 to 100 in steps of 10 (confidence model). */
  confidence?: number | null;
  /** Grading (Europol and Admiralty models, ZN 2.59+). */
  evaluation?: Evaluation | null;
  isGroup?: boolean;
  isAnnotation?: boolean;
}

export type ZnLinkDirection = 'none' | 'forward' | 'backward' | 'both';

export interface ZnLink {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  direction: ZnLinkDirection;
  source: string;
  confidence?: number | null;
  evaluation?: Evaluation | null;
}

export interface ZnTagSet {
  id: string;
  name: string;
  defaultVisual: { color: string | null; shape: string | null; icon: string | null };
  suggestedProperties: { key: string; type: ZnPropertyType }[];
}

/** Elements that can carry information: canvas notes and groups are excluded. */
export function isGraphElement(el: ZnElement): boolean {
  return !el.isGroup && !el.isAnnotation;
}
