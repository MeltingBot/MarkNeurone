// Annotation model (section 7 of the scoping note).

export type AnnotationKind = 'element' | 'property' | 'event' | 'location' | 'link' | 'suggestion';
export type AnnotationStatus = 'suggested' | 'validated' | 'rejected';
export type AnnotationOrigin = 'manual' | 'pattern' | 'dictionary' | 'profile' | 'oneneurone';

/**
 * Rectangle in page space, unscaled: PDF user space [x1, y1, x2, y2] with
 * origin bottom-left for a PDF; CSS pixels at scale 1, origin top-left, for a
 * text document, where quads only cache what textRange locates.
 */
export type Quad = [number, number, number, number];

export interface Annotation {
  id: string;
  /** Asset id of the document in the dossier. */
  documentId: string;
  /** SHA-256 of the file; stable across export and import, unlike the asset id. */
  documentHash: string;
  /** 1-based page number; always 1 for a text document (one continuous sheet). */
  page: number;
  quads: Quad[];
  /** Exact highlighted text, as validated by the user. */
  text: string;
  /** Sentence containing the passage. */
  context?: string;
  /** Character offsets of the passage in the page text. */
  textRange?: [number, number];
  /** Text documents: extraction rules textRange refers to (TEXT_EXTRACTOR_ID). */
  extractor?: string;
  kind: AnnotationKind;
  status: AnnotationStatus;
  /** Kept after validation: tells human reading from accepted suggestions. */
  origin: AnnotationOrigin;
  /** Element id (element, property, event, location) or link id (link). */
  targetId?: string;
  /** Property key, for kind 'property'. */
  propertyKey?: string;
  /** Link ends [from, to], for kind 'link'; the anchor is on the link itself. */
  linkEnds?: [string, string];
  /** Highlights the link was drawn between [from, to], to show it in the document. */
  linkAnchors?: [string | null, string | null];
  /** ElementEvent ids per element, for kind 'event'; for kind 'property', the event the property belongs to. */
  eventIds?: Record<string, string>;
  /** Target no longer exists in the graph; the reading work is kept. */
  orphan?: boolean;
  ocr?: {
    rawText: string;
    confidence: number;
    corrected: boolean;
  };
  createdAt: string;
}
