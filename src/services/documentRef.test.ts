import { describe, expect, it, vi } from 'vitest';

let remote: ((change: { dossierId: string; key: string; deleted: boolean }) => void) | null = null;
const shared: string[][] = [];

vi.mock('../hostAPI.ts', () => ({
  getHostAPI: () => ({
    pluginData: {
      shareKeys: (prefixes: string[]) => void shared.push(prefixes),
      onRemoteChange: (cb: typeof remote) => {
        remote = cb;
        return () => {};
      },
    },
  }),
}));

const { getReferencesVersion, shareReferences, subscribeReferences } = await import('./documentRef.ts');

describe('shareReferences', () => {
  it('shares the references and refreshes their views when a member changes one', () => {
    shareReferences();
    expect(shared).toEqual([['ref:']]);

    const seen = vi.fn();
    subscribeReferences(seen);
    const before = getReferencesVersion();
    remote!({ dossierId: 'd', key: `annotation:${'1'.repeat(64)}:a`, deleted: false });
    expect(seen).not.toHaveBeenCalled();
    remote!({ dossierId: 'd', key: `ref:${'1'.repeat(64)}`, deleted: false });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(getReferencesVersion()).toBe(before + 1);
  });
});
