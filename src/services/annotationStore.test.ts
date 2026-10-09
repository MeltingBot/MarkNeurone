import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../core/model.ts';

const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const D = 'dossier';

// In-memory pluginData of one dossier, with or without the ZN 2.63 methods.
let data: Map<string, unknown>;
let features: { sharedPluginData?: boolean };
let remote: ((change: { dossierId: string; key: string; deleted: boolean }) => void) | null;
let calls: { set: string[]; remove: string[]; list: string[]; shareKeys: string[][] };

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

vi.mock('../hostAPI.ts', () => ({
  getHostAPI: () => ({
    features,
    pluginData: {
      get: async (_d: string, key: string) => clone(data.get(key)),
      set: async (_d: string, key: string, value: unknown) => {
        calls.set.push(key);
        data.set(key, clone(value));
      },
      remove: async (_d: string, key: string) => {
        calls.remove.push(key);
        data.delete(key);
      },
      ...(features.sharedPluginData
        ? {
            list: async (_d: string, prefix: string) => {
              calls.list.push(prefix);
              return [...data.keys()]
                .filter((k) => k.startsWith(prefix))
                .sort()
                .map((key) => ({ key, value: clone(data.get(key)) }));
            },
            shareKeys: (prefixes: string[]) => void calls.shareKeys.push(prefixes),
            onRemoteChange: (cb: typeof remote) => {
              remote = cb;
              return () => {};
            },
          }
        : {}),
    },
  }),
}));

const store = await import('./annotationStore.ts');

function ann(id: string, hash = H1, extra: Partial<Annotation> = {}): Annotation {
  return {
    id,
    documentId: 'asset',
    documentHash: hash,
    page: 1,
    quads: [],
    text: id,
    kind: 'element',
    status: 'validated',
    origin: 'manual',
    createdAt: `2026-10-0${id.length}T00:00:00.000Z`,
    ...extra,
  } as Annotation;
}

const key = (hash: string, id: string) => `annotation:${hash}:${id}`;
const sharedKeys = () => [...data.keys()].filter((k) => k.startsWith('annotation:')).sort();
const waitRefresh = () => new Promise((resolve) => setTimeout(resolve, 80));

beforeEach(() => {
  data = new Map();
  features = { sharedPluginData: true };
  remote = null;
  calls = { set: [], remove: [], list: [], shareKeys: [] };
  store.resetAnnotationStore();
});

describe('migration of the former arrays', () => {
  it('splits each array into one key per annotation, then deletes the arrays and the index', async () => {
    data.set(`ann:${H1}`, [ann('a'), ann('bb')]);
    data.set(`ann:${H2}`, [ann('c', H2)]);
    data.set('ann-index', [H1, H2]);

    expect((await store.loadAnnotations(D, H1)).map((a) => a.id)).toEqual(['a', 'bb']);
    expect(sharedKeys()).toEqual([key(H1, 'a'), key(H1, 'bb'), key(H2, 'c')].sort());
    expect(data.has(`ann:${H1}`)).toBe(false);
    expect(data.has(`ann:${H2}`)).toBe(false);
    expect(data.has('ann-index')).toBe(false);
  });

  it('can run twice without duplicates, and keeps an annotation changed in between', async () => {
    const legacy = [ann('a'), ann('bb')];
    data.set(`ann:${H1}`, legacy);
    data.set('ann-index', [H1]);
    await store.loadAnnotations(D, H1);

    // Changed since (here or by another member), then the same array comes back.
    data.set(key(H1, 'a'), ann('a', H1, { text: 'corrigé' }));
    data.set(`ann:${H1}`, legacy);
    data.set('ann-index', [H1]);
    store.resetAnnotationStore();
    calls.set = [];

    const list = await store.loadAnnotations(D, H1);
    expect(list.map((a) => a.id)).toEqual(['a', 'bb']);
    expect(list[0].text).toBe('corrigé');
    expect(calls.set).toEqual([]);
    expect(sharedKeys()).toEqual([key(H1, 'a'), key(H1, 'bb')]);
    expect(data.has(`ann:${H1}`)).toBe(false);
    expect(data.has('ann-index')).toBe(false);
  });
});

describe('one key per annotation', () => {
  it('saves and removes a single key', async () => {
    await store.saveAnnotation(D, ann('a'));
    await store.saveAnnotation(D, ann('bb'));
    expect(sharedKeys()).toEqual([key(H1, 'a'), key(H1, 'bb')]);
    await store.removeAnnotation(D, H1, 'a');
    expect(sharedKeys()).toEqual([key(H1, 'bb')]);
    expect(data.has('ann-index')).toBe(false);
  });

  it('writeDocument removes the annotations taken out and writes only the changed ones', async () => {
    for (const id of ['a', 'bb', 'ccc']) data.set(key(H1, id), ann(id));
    calls.set = [];

    await store.writeDocument(D, H1, [ann('a'), ann('bb', H1, { orphan: true })]);

    expect(sharedKeys()).toEqual([key(H1, 'a'), key(H1, 'bb')]);
    expect(calls.set).toEqual([key(H1, 'bb')]);
    expect(calls.remove).toEqual([key(H1, 'ccc')]);
    expect(store.getAnnotations(D, H1).map((a) => a.id)).toEqual(['a', 'bb']);
  });

  it('deleteDocument removes every key of the document only', async () => {
    data.set(key(H1, 'a'), ann('a'));
    data.set(key(H1, 'bb'), ann('bb'));
    data.set(key(H2, 'c'), ann('c', H2));
    await store.deleteDocument(D, H1);
    expect(sharedKeys()).toEqual([key(H2, 'c')]);
  });

  it('lists annotated documents from the keys', async () => {
    data.set(key(H1, 'a'), ann('a'));
    data.set(key(H2, 'c'), ann('c', H2));
    expect((await store.annotatedDocuments(D)).sort()).toEqual([H1, H2]);
  });

  it('orders a document by creation, whatever the key order', async () => {
    data.set(key(H1, 'z'), ann('z', H1, { createdAt: '2026-01-01T00:00:00.000Z' }));
    data.set(key(H1, 'a'), ann('a', H1, { createdAt: '2026-02-01T00:00:00.000Z' }));
    expect((await store.loadAnnotations(D, H1)).map((a) => a.id)).toEqual(['z', 'a']);
  });
});

describe('changes made by another member', () => {
  it('shares the annotation prefix at registration', () => {
    store.shareAnnotations();
    expect(calls.shareKeys).toEqual([['annotation:']]);
    expect(remote).not.toBeNull();
  });

  it('reloads the document of the changed key, and leaves the others as they are', async () => {
    store.shareAnnotations();
    data.set(key(H1, 'a'), ann('a'));
    data.set(key(H2, 'c'), ann('c', H2));
    await store.loadAnnotations(D, H1);
    const other = await store.loadAnnotations(D, H2);

    // ZN has already written the new key in Dexie.
    data.set(key(H1, 'bb'), ann('bb'));
    calls.list = [];
    remote!({ dossierId: D, key: key(H1, 'bb'), deleted: false });
    await waitRefresh();

    expect(store.getAnnotations(D, H1).map((a) => a.id)).toEqual(['a', 'bb']);
    expect(store.getAnnotations(D, H2)).toBe(other);
    expect(calls.list).toEqual([`annotation:${H1}:`]);
  });

  it('reads a burst of changes on one document once', async () => {
    store.shareAnnotations();
    await store.loadAnnotations(D, H1);
    calls.list = [];
    for (const id of ['a', 'bb', 'ccc']) {
      data.set(key(H1, id), ann(id));
      remote!({ dossierId: D, key: key(H1, id), deleted: false });
    }
    await waitRefresh();
    expect(calls.list).toEqual([`annotation:${H1}:`]);
    expect(store.getAnnotations(D, H1)).toHaveLength(3);
  });

  it('finds the anchor of an annotation added by a member on a new document', async () => {
    store.shareAnnotations();
    await store.loadDossier(D);
    const added = ann('0a1b2c3d-0000-4000-8000-000000000000', H2);
    data.set(key(H2, added.id), added);
    remote!({ dossierId: D, key: key(H2, added.id), deleted: false });
    await waitRefresh();
    expect(store.findByAnchor(D, '0a1b2c3d')?.id).toBe(added.id);
  });

  it('ignores a change to a dossier nothing has read', async () => {
    store.shareAnnotations();
    remote!({ dossierId: 'other', key: key(H1, 'a'), deleted: false });
    await waitRefresh();
    expect(calls.list).toEqual([]);
  });
});

describe('without shared plugin data (ZN before 2.63)', () => {
  beforeEach(() => {
    features = {};
  });

  it('keeps one array per document and the index, and shares nothing', async () => {
    store.shareAnnotations();
    await store.saveAnnotation(D, ann('a'));
    await store.saveAnnotation(D, ann('bb'));
    await store.removeAnnotation(D, H1, 'a');

    expect(calls.shareKeys).toEqual([]);
    expect(remote).toBeNull();
    expect((data.get(`ann:${H1}`) as Annotation[]).map((a) => a.id)).toEqual(['bb']);
    expect(data.get('ann-index')).toEqual([H1]);
    expect(sharedKeys()).toEqual([]);
  });

  it('leaves former arrays as they are', async () => {
    data.set(`ann:${H1}`, [ann('a')]);
    data.set('ann-index', [H1]);
    expect(await store.annotatedDocuments(D)).toEqual([H1]);
    expect((await store.readDocument(D, H1)).map((a) => a.id)).toEqual(['a']);
    await store.writeDocument(D, H1, []);
    expect(data.get(`ann:${H1}`)).toEqual([]);
    expect(sharedKeys()).toEqual([]);
  });
});
