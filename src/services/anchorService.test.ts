import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../core/model.ts';

const HASH = 'a'.repeat(64);
let pages: string[] | null;
let asset: { id: string; hash: string; filename: string; mimeType: string } | undefined;
let stored: Annotation[];
let reference: string;

vi.mock('../hostAPI.ts', () => ({ getHostAPI: () => ({ generateUUID: () => '1a2b3c4d-0000-4000-8000-000000000000' }) }));
vi.mock('./documentPages.ts', () => ({ documentPageTexts: async () => pages }));
vi.mock('./documentAssets.ts', () => ({
  findAssetByHash: () => asset,
  isPdf: (a: { filename: string }) => a.filename.endsWith('.pdf'),
}));
vi.mock('./annotationStore.ts', () => ({
  loadAnnotations: async () => stored,
  saveAnnotation: async (_d: string, a: Annotation) => {
    stored = [...stored.filter((x) => x.id !== a.id), a];
  },
}));
vi.mock('./documentRef.ts', () => ({ loadReference: async () => reference }));

const { anchorPassage } = await import('./anchorService.ts');

const page1 = 'Le 24 septembre 2025, nous entendons le témoin. Se présente Paul DURAND, gérant de la société ALPHA.';
const base = { dossierId: 'd', documentHash: HASH, targetId: 'el', status: 'validated' as const };

beforeEach(() => {
  pages = [page1, 'Page deux.'];
  asset = { id: 'asset', hash: HASH, filename: 'pv.pdf', mimeType: 'application/pdf' };
  stored = [];
  reference = 'PV n° 347';
});

describe('anchorPassage', () => {
  it('records the passage of an element and returns its source link', async () => {
    const res = await anchorPassage({ ...base, kind: 'element', text: 'Paul DURAND' });
    expect(res).toEqual({ sourcePart: '[PV n° 347 p.1](mn:1a2b3c4d)', annotationId: '1a2b3c4d-0000-4000-8000-000000000000', page: 1 });
    const start = page1.indexOf('Paul');
    expect(stored[0]).toMatchObject({
      kind: 'element', targetId: 'el', page: 1, quads: [], text: 'Paul DURAND', textRange: [start, start + 11],
      origin: 'oneneurone', status: 'validated', documentId: 'asset',
    });
    expect(stored[0].context).toContain('Se présente Paul DURAND');
  });

  it('keeps a passage accepted all at once as to check', async () => {
    await anchorPassage({ ...base, status: 'suggested', kind: 'link', text: 'Paul DURAND', otherName: 'ALPHA', targetId: 'link', linkEnds: ['a', 'b'] });
    expect(stored[0]).toMatchObject({ kind: 'link', status: 'suggested', linkEnds: ['a', 'b'] });
  });

  it('reuses the same passage of the same object, and validates it when accepted one by one', async () => {
    const first = await anchorPassage({ ...base, status: 'suggested', kind: 'element', text: 'Paul DURAND' });
    const again = await anchorPassage({ ...base, kind: 'element', text: 'Paul DURAND' });
    expect(again?.annotationId).toBe(first?.annotationId);
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('validated');
  });

  it('returns null when the passage or the document is not found', async () => {
    expect(await anchorPassage({ ...base, kind: 'element', text: 'Jean DUPONT' })).toBeNull();
    asset = undefined;
    expect(await anchorPassage({ ...base, kind: 'element', text: 'Paul DURAND' })).toBeNull();
    expect(stored).toEqual([]);
  });

  it('gives no page for a text document', async () => {
    asset = { id: 'asset', hash: HASH, filename: 'note.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    reference = '';
    const res = await anchorPassage({ ...base, kind: 'element', text: 'ALPHA' });
    expect(res?.sourcePart).toBe('[note.docx](mn:1a2b3c4d)');
    expect(stored[0].extractor).toBeDefined();
  });
});
