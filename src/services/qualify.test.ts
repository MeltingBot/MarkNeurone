import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Annotation } from '../core/model.ts';

const calls: { fn: string; args: unknown[] }[] = [];
const saved: Annotation[] = [];

vi.mock('../hostAPI.ts', () => ({ getHostAPI: () => ({ generateUUID: () => '1a2b3c4d-0000-4000-8000-000000000000' }) }));
vi.mock('./graphWriter.ts', () => ({
  attachAnchor: async (...args: unknown[]) => void calls.push({ fn: 'attachAnchor', args }),
  attachEventAnchor: async (...args: unknown[]) => void calls.push({ fn: 'attachEventAnchor', args }),
  addProperty: async (...args: unknown[]) => void calls.push({ fn: 'addProperty', args }),
}));
vi.mock('./annotationStore.ts', () => ({
  saveAnnotation: async (_dossierId: string, a: Annotation) => void saved.push(a),
  removeAnnotation: async () => {},
}));
const { qualifyAsExistingProperty } = await import('./qualify.ts');

const ctx = { dossierId: 'd', asset: { id: 'a', hash: 'h', filename: 'pv.pdf', mimeType: 'application/pdf', size: 1 }, reference: 'PV n° 347' };
const passage = { page: 2, quads: [], text: '06 12 34 56 78', clientBox: { left: 0, top: 0, right: 0, bottom: 0 } };

describe('qualifyAsExistingProperty', () => {
  beforeEach(() => {
    calls.length = 0;
    saved.length = 0;
  });

  it('anchors the passage on the element, without touching its properties', async () => {
    await qualifyAsExistingProperty(ctx, passage, 'el', 'Téléphone');
    expect(calls).toEqual([{ fn: 'attachAnchor', args: ['el', '[PV n° 347 p.2](mn:1a2b3c4d)'] }]);
    expect(saved[0]).toMatchObject({ kind: 'property', targetId: 'el', propertyKey: 'Téléphone', text: '06 12 34 56 78' });
    expect(saved[0]).not.toHaveProperty('eventIds');
  });

  it('anchors the passage on an event of the element, and keeps the event', async () => {
    await qualifyAsExistingProperty(ctx, passage, 'el', 'Lieu', 'ev');
    expect(calls).toEqual([{ fn: 'attachEventAnchor', args: ['el', 'ev', '[PV n° 347 p.2](mn:1a2b3c4d)'] }]);
    expect(saved[0]).toMatchObject({ kind: 'property', targetId: 'el', propertyKey: 'Lieu', eventIds: { el: 'ev' } });
  });
});
