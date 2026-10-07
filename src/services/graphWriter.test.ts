import { describe, expect, it, vi } from 'vitest';

// graphWriter reaches ZN through the host API only at call time.
const state: { elements: unknown[]; updates: [string, Record<string, unknown>][] } = { elements: [], updates: [] };
vi.mock('../hostAPI.ts', () => ({
  getHostAPI: () => ({
    stores: {
      useDossierStore: {
        getState: () => ({
          elements: state.elements,
          updateElement: async (id: string, changes: Record<string, unknown>) => void state.updates.push([id, changes]),
        }),
      },
    },
  }),
}));
const { detachAnchor, freePosition } = await import('./graphWriter.ts');

describe('detachAnchor', () => {
  const ID = '1a2b3c4d-0000-4000-8000-000000000000';
  const anchor = '[pv.pdf p.2](mn:1a2b3c4d)';

  it('removes the anchor from the element and from the events that carry it', async () => {
    state.updates = [];
    state.elements = [{
      id: 'el',
      source: `Note\n${anchor}`,
      events: [
        { id: 'ev1', source: `${anchor}\nAutre` },
        { id: 'ev2', source: 'Autre' },
        { id: 'ev3' },
      ],
    }];
    await detachAnchor('el', ID);
    expect(state.updates).toEqual([['el', {
      source: 'Note',
      events: [{ id: 'ev1', source: 'Autre' }, { id: 'ev2', source: 'Autre' }, { id: 'ev3' }],
    }]]);
  });

  it('writes nothing when no source carries the anchor', async () => {
    state.updates = [];
    state.elements = [{ id: 'el', source: 'Note', events: [{ id: 'ev', source: 'Autre' }] }];
    await detachAnchor('el', ID);
    expect(state.updates).toEqual([]);
  });
});

describe('freePosition', () => {
  it('keeps the centre when it is free', () => {
    expect(freePosition({ x: 0, y: 0 }, [{ x: 500, y: 500 }])).toEqual({ x: 0, y: 0 });
  });

  it('moves away from a node sitting on the centre', () => {
    const p = freePosition({ x: 0, y: 0 }, [{ x: 10, y: 5 }]);
    expect(Math.abs(p.x - 10) >= 160 || Math.abs(p.y - 5) >= 110).toBe(true);
  });

  it('finds a spot in a crowded area', () => {
    const occupied = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => ({ x: i * 160, y: j * 110 })));
    const p = freePosition({ x: 0, y: 0 }, occupied);
    expect(occupied.every((o) => Math.abs(o.x - p.x) >= 160 || Math.abs(o.y - p.y) >= 110)).toBe(true);
  });
});
