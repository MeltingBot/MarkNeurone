import { describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../core/model.ts';

const ID1 = '11111111-0000-4000-8000-000000000000';
const ID2 = '22222222-0000-4000-8000-000000000000';
const ID3 = '33333333-0000-4000-8000-000000000000';

const elements: Record<string, { source: string; events: { id: string; source?: string }[] }> = {
  el: {
    source: 'Saisie manuelle ; [scan.pdf p.1](mn:11111111) ; [scan.pdf p.2](mn:22222222) (vérifié)',
    events: [{ id: 'ev', source: '[scan.pdf p.1](mn:11111111)' }],
  },
};
const links: Record<string, { source: string }> = { ln: { source: '[scan.pdf p.3](mn:33333333)' } };

vi.mock('../hostAPI.ts', () => ({ getHostAPI: () => ({}) }));
vi.mock('./graphWriter.ts', () => ({
  getElement: (id: string) => elements[id],
  getLink: (id: string) => links[id],
}));
const { planRelabel, relabelCount } = await import('./qualify.ts');

const ann = (id: string, kind: Annotation['kind'], page: number, extra: Partial<Annotation>): Annotation => ({
  id,
  documentId: 'a',
  documentHash: 'h',
  page,
  quads: [],
  text: '',
  kind,
  status: 'validated',
  origin: 'manual',
  createdAt: '',
  ...extra,
});

describe('planRelabel', () => {
  const ctx = { dossierId: 'd', asset: { id: 'a', hash: 'h', filename: 'scan.pdf', mimeType: 'application/pdf' }, reference: 'PV n° 347' };

  it('rewrites the parts the plugin wrote, on elements, events and links', () => {
    const plan = planRelabel(ctx as never, [
      ann(ID1, 'event', 1, { targetId: 'el', eventIds: { el: 'ev' } }),
      ann(ID2, 'property', 2, { targetId: 'el' }),
      ann(ID3, 'link', 3, { targetId: 'ln' }),
    ]);
    expect(relabelCount(plan)).toBe(2);
    expect(plan.elements.get('el')?.source).toBe('Saisie manuelle ; [PV n° 347 p.1](mn:11111111) ; [scan.pdf p.2](mn:22222222) (vérifié)');
    expect(plan.elements.get('el')?.events[0].source).toBe('[PV n° 347 p.1](mn:11111111)');
    expect(plan.links.get('ln')).toBe('[PV n° 347 p.3](mn:33333333)');
  });

  it('plans nothing when the sources already carry the reference', () => {
    expect(relabelCount(planRelabel({ ...ctx, reference: '' } as never, [ann(ID3, 'link', 3, { targetId: 'ln' })]))).toBe(0);
  });
});
