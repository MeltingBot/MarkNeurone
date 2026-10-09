import { beforeEach, describe, expect, it, vi } from 'vitest';

const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);

// In-memory pluginData and a dossier where ZN removed asset "a1" from its
// element but kept its row, as dossierStore.removeAsset does.
let data: Map<string, unknown>;
let elements: { assetIds?: string[] }[];
let assets: { id: string; hash: string; filename: string }[];

vi.mock('../hostAPI.ts', () => ({
  getHostAPI: () => ({
    pluginData: {
      get: async (_d: string, key: string) => data.get(key),
      set: async (_d: string, key: string, value: unknown) => void data.set(key, value),
      remove: async (_d: string, key: string) => void data.delete(key),
      list: async (_d: string, prefix: string) =>
        [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, value: data.get(key) })),
    },
    repositories: { elementRepository: { getByDossier: async () => elements } },
    fileService: { getAssetsByDossier: async () => assets },
  }),
}));
const { absentDocuments, forgetDocument, onDocumentDeleted, presentDocumentHashes } = await import('./documentData.ts');

const ocr = { version: 1, model: 'fra_fast', pages: { '1': { lines: [], confidence: 90, skew: 0, at: '' } } };

beforeEach(() => {
  data = new Map<string, unknown>([
    ['ocr-index', [H1, H2]],
    [`ocr:${H1}`, ocr],
    [`ocr:${H2}`, ocr],
    [`annotation:${H1}:x`, { id: 'x' }],
    [`annotation:${H1}:y`, { id: 'y' }],
  ]);
  elements = [{ assetIds: ['a2'] }, {}];
  assets = [
    { id: 'a1', hash: H1, filename: 'pv.pdf' },
    { id: 'a2', hash: H2, filename: 'autre.pdf' },
  ];
});

describe('presentDocumentHashes', () => {
  it('counts only the assets an element refers to', async () => {
    expect([...(await presentDocumentHashes('d'))]).toEqual([H2]);
  });
});

describe('onDocumentDeleted', () => {
  it('deletes the OCR of the deleted document and reports its kept annotations', async () => {
    expect(await onDocumentDeleted('d', 'a1')).toEqual({ filename: 'pv.pdf', annotations: 2 });
    expect(data.has(`ocr:${H1}`)).toBe(false);
    expect(data.get('ocr-index')).toEqual([H2]);
    expect(data.has(`annotation:${H1}:x`) && data.has(`annotation:${H1}:y`)).toBe(true);
    expect(data.has(`ocr:${H2}`)).toBe(true);
  });

  it('keeps everything while another copy of the file is in the dossier', async () => {
    assets.push({ id: 'a3', hash: H1, filename: 'pv (copie).pdf' });
    elements.push({ assetIds: ['a3'] });
    expect(await onDocumentDeleted('d', 'a1')).toBeNull();
    expect(data.has(`ocr:${H1}`)).toBe(true);
  });
});

describe('absentDocuments', () => {
  it('lists deleted documents that still have annotations, with their file name', async () => {
    data.set(`annotation:${H2}:z`, { id: 'z' });
    expect(await absentDocuments('d')).toEqual([{ hash: H1, filename: 'pv.pdf', annotations: 2 }]);
  });

  it('gives no name when ZN no longer has the asset row', async () => {
    assets = assets.filter((a) => a.id !== 'a1');
    expect(await absentDocuments('d')).toEqual([{ hash: H1, filename: null, annotations: 2 }]);
  });
});

describe('forgetDocument', () => {
  it('deletes annotations, OCR, reference and view preferences of the document', async () => {
    data.set(`ref:${H1}`, 'PV n° 347');
    data.set(`view:${H1}`, { suggestions: true });
    await forgetDocument('d', H1);
    for (const k of [`annotation:${H1}:x`, `annotation:${H1}:y`, `ocr:${H1}`, `ref:${H1}`, `view:${H1}`]) expect(data.has(k), k).toBe(false);
  });
});
