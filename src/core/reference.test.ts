import { describe, expect, it } from 'vitest';
import { cleanReference, detectReference, MAX_REFERENCE } from './reference.ts';

describe('cleanReference', () => {
  it('keeps out the anchor separator and token, and extra spaces', () => {
    expect(cleanReference('  PV  00347 ; pièce 2 ')).toBe('PV 00347 , pièce 2');
    expect(cleanReference('PV [mn:1a2b3c4d]')).toBe('PV (mn:1a2b3c4d]');
    expect(cleanReference(42)).toBe('');
    expect(cleanReference('x'.repeat(300))).toHaveLength(MAX_REFERENCE);
  });
});

describe('detectReference', () => {
  const header =
    'GENDARMERIE NATIONALE Région de gendarmerie de Nouvelle-Aquitaine BRIGADE DE RECHERCHES DE PARTHENAY ' +
    'PROCÈS-VERBAL N° 00347/2026 Pièce n° 2 Dossier : cote 03 Date : 12/03/2026 ' +
    "PROCÈS-VERBAL D'AUDITION DE TÉMOIN AFFAIRE Disparition inquiétante PARQUET Tribunal judiciaire de Niort, n° 26 071 000 123";

  it('reads the number and item of a report header', () => {
    expect(detectReference(header)).toBe('PV n° 00347/2026, pièce n° 2');
  });

  it('works without an item number, and across line breaks', () => {
    expect(detectReference('PROCES-VERBAL\nN°\n1234/2025\nDate')).toBe('PV n° 1234/2025');
  });

  it('proposes nothing for another kind of document', () => {
    expect(detectReference('Relevé de compte n° 123456')).toBeNull();
    expect(detectReference('PROCÈS-VERBAL sans numéro')).toBeNull();
  });
});
