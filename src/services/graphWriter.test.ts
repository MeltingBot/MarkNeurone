import { describe, expect, it, vi } from 'vitest';

// graphWriter reaches ZN through the host API only at call time.
vi.mock('../hostAPI.ts', () => ({ getHostAPI: () => ({}) }));
const { freePosition } = await import('./graphWriter.ts');

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
