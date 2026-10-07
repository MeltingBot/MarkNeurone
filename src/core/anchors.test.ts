import { describe, expect, it } from 'vitest';
import { anchorIds, anchorLabel, anchorTarget, appendAnchor, relabelAnchor, removeAnchor, shortId } from './anchors.ts';

const ID = '1A2B3C4D-0000-4000-8000-000000000000';

describe('anchors', () => {
  it('builds a Markdown link from a UUID', () => {
    expect(shortId(ID)).toBe('1a2b3c4d');
    expect(anchorTarget(ID)).toBe('mn:1a2b3c4d');
    expect(anchorLabel('pv.pdf', 3, ID)).toBe('[pv.pdf p.3](mn:1a2b3c4d)');
    expect(anchorLabel('pv.docx', null, ID)).toBe('[pv.docx](mn:1a2b3c4d)');
  });

  it('keeps brackets, backslashes and the source separator out of the label', () => {
    expect(anchorLabel('PV [1] ; copie\\scan.pdf', 2, ID)).toBe('[PV (1) , copie/scan.pdf p.2](mn:1a2b3c4d)');
    expect(anchorIds(anchorLabel('a](mn:99aa00ff)', 1, ID))).toEqual(['1a2b3c4d']);
  });

  it('appends to an existing source without duplicates', () => {
    const label = anchorLabel('pv.pdf', 3, ID);
    expect(appendAnchor('', label)).toBe(label);
    expect(appendAnchor('Fichier SIV', label)).toBe(`Fichier SIV\n${label}`);
    expect(appendAnchor(`Fichier SIV\n${label}`, label)).toBe(`Fichier SIV\n${label}`);
    expect(appendAnchor(`Fichier SIV ; ${label}`, label)).toBe(`Fichier SIV ; ${label}`);
  });

  it('finds every anchor, including after a merge concatenated two sources', () => {
    expect(anchorIds('[pv.pdf p.3](mn:1a2b3c4d)\n[autre.pdf p.1](mn:99aa00ff)')).toEqual(['1a2b3c4d', '99aa00ff']);
    expect(anchorIds('[pv.pdf p.3](mn:1a2b3c4d) ; [autre.pdf p.1](mn:99aa00ff)')).toEqual(['1a2b3c4d', '99aa00ff']);
    expect(anchorIds('note (mn:1a2b3c4d)')).toEqual([]);
    expect(anchorIds(undefined)).toEqual([]);
  });

  it('removes one anchor and keeps the other sources', () => {
    const label = anchorLabel('pv.pdf', 3, ID);
    expect(removeAnchor(`Fichier SIV ; ${label} ; [autre.pdf p.1](mn:99aa00ff)`, ID)).toBe('Fichier SIV ; [autre.pdf p.1](mn:99aa00ff)');
    expect(removeAnchor(label, ID)).toBe('');
  });

  it('removes one line of a field on several lines, and only that line', () => {
    const label = anchorLabel('pv.pdf', 3, ID);
    expect(removeAnchor(`Fichier SIV\n${label}\n[autre.pdf p.1](mn:99aa00ff)`, ID)).toBe('Fichier SIV\n[autre.pdf p.1](mn:99aa00ff)');
    expect(removeAnchor(`${label}\r\nFichier SIV`, ID)).toBe('Fichier SIV');
    expect(removeAnchor(`Fichier SIV\n${label}`, ID)).toBe('Fichier SIV');
  });

  it('keeps each separator of a field mixing lines and " ; "', () => {
    const label = anchorLabel('pv.pdf', 3, ID);
    expect(removeAnchor(`A ; B\n${label} ; C\nD`, ID)).toBe('A ; B\nC\nD');
    expect(removeAnchor(`A ; ${label}\nC`, ID)).toBe('A ; C');
    expect(removeAnchor('Fichier SIV', ID)).toBe('Fichier SIV');
  });
});

describe('relabelAnchor', () => {
  const ID = '1a2b3c4d-0000-4000-8000-000000000000';
  const OTHER = '9f9f9f9f-0000-4000-8000-000000000000';

  it('replaces the link the plugin wrote, and keeps its target', () => {
    const next = relabelAnchor('Note ; [scan.pdf p.3](mn:1a2b3c4d) ; [scan.pdf p.4](mn:9f9f9f9f)', ID, anchorLabel('PV n° 347', 3, ID));
    expect(next).toBe('Note ; [PV n° 347 p.3](mn:1a2b3c4d) ; [scan.pdf p.4](mn:9f9f9f9f)');
    expect(anchorIds(next)).toEqual(['1a2b3c4d', '9f9f9f9f']);
    expect(relabelAnchor(next, OTHER, anchorLabel('PV n° 347', 4, OTHER))).toContain('[PV n° 347 p.4](mn:9f9f9f9f)');
  });

  it('rewrites one line of a field on several lines', () => {
    const next = relabelAnchor('Note ; autre\n[scan.pdf p.3](mn:1a2b3c4d)\r\n[scan.pdf p.4](mn:9f9f9f9f)', ID, anchorLabel('PV', 3, ID));
    expect(next).toBe('Note ; autre\n[PV p.3](mn:1a2b3c4d)\r\n[scan.pdf p.4](mn:9f9f9f9f)');
  });

  it('works without a page, for a text document', () => {
    expect(relabelAnchor('[audition.docx](mn:1a2b3c4d)', ID, anchorLabel('PV n° 12', null, ID))).toBe('[PV n° 12](mn:1a2b3c4d)');
  });

  it('leaves a part the user edited around the anchor, and reports no change', () => {
    expect(relabelAnchor('[scan.pdf p.3](mn:1a2b3c4d) (vérifié)', ID, anchorLabel('PV', 3, ID))).toBeNull();
    expect(relabelAnchor('Note\n[scan.pdf p.3](mn:1a2b3c4d) (vérifié)', ID, anchorLabel('PV', 3, ID))).toBeNull();
    expect(relabelAnchor('[PV p.3](mn:1a2b3c4d)', ID, anchorLabel('PV', 3, ID))).toBeNull();
    expect(relabelAnchor('[scan.pdf p.4](mn:9f9f9f9f)', ID, anchorLabel('PV', 3, ID))).toBeNull();
    expect(relabelAnchor(undefined, ID, 'x')).toBeNull();
  });
});
