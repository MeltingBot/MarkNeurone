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
    },
    repositories: { elementRepository: { getByDossier: async () => elements } },
    fileService: { getAssetsByDossier: async () => assets },
  }),
}));
const { absentDocuments, onDocumentDeleted, presentDocumentHashes } = await import('./documentData.ts');

const ocr = { version: 1, model: 'fra_fast', pages: { '1': { lines: [], confidence: 90, skew: 0, at: '' } } };

beforeEach(() => {
  data = new Map<string, unknown>([
    ['ocr-index', [H1, H2]],
    [`ocr:${H1}`, ocr],
    [`ocr:${H2}`, ocr],
    [`ann:${H1}`, [{ id: 'x' }, { id: 'y' }]],
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
    expect(data.get(`ann:${H1}`)).toHaveLength(2);
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
    data.set('ann-index', [H1, H2]);
    data.set(`ann:${H2}`, [{ id: 'z' }]);
    expect(await absentDocuments('d')).toEqual([{ hash: H1, filename: 'pv.pdf', annotations: 2 }]);
  });

  it('gives no name when ZN no longer has the asset row', async () => {
    data.set('ann-index', [H1]);
    assets = assets.filter((a) => a.id !== 'a1');
    expect(await absentDocuments('d')).toEqual([{ hash: H1, filename: null, annotations: 2 }]);
  });
});
