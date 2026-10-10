// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blockStarts, blocksText, decodeText, parseDocxXml, parseMarkdown, parseOdtXml, parseTxt, textFormatOf } from './textDocument.ts';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = (body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`;

describe('textFormatOf', () => {
  it('recognizes the formats by name or type', () => {
    expect(textFormatOf({ filename: 'PV.DOCX' })).toBe('docx');
    expect(textFormatOf({ filename: 'pv.odt' })).toBe('odt');
    expect(textFormatOf({ filename: 'notes.md' })).toBe('md');
    expect(textFormatOf({ filename: 'notes', mimeType: 'text/plain' })).toBe('txt');
    expect(textFormatOf({ filename: 'pv.doc' })).toBeNull();
    expect(textFormatOf({ filename: 'pv.pdf', mimeType: 'application/pdf' })).toBeNull();
  });
});

describe('decodeText', () => {
  it('reads UTF-8, and falls back to Windows-1252', () => {
    expect(decodeText(new TextEncoder().encode('﻿Audition de Mme Hélène\r\nfin'))).toBe('Audition de Mme Hélène\nfin');
    expect(decodeText(new Uint8Array([0x48, 0xe9, 0x6c, 0xe8, 0x6e, 0x65, 0x20, 0x80]))).toBe('Hélène €');
  });
});

describe('parseTxt', () => {
  it('keeps lines in one preformatted block', () => {
    expect(parseTxt('ligne 1\n  ligne 2\n\n')).toEqual([{ kind: 'pre', text: 'ligne 1\n  ligne 2' }]);
    expect(parseTxt('\n \n')).toEqual([]);
  });
});

describe('parseMarkdown', () => {
  it('turns markup into blocks without markers', () => {
    const blocks = parseMarkdown([
      '# Audition',
      '',
      'Se présente **Odile DELARZE**, joignable',
      'au 04 60 48 05 02.',
      '',
      '- véhicule *Berlingo*',
      '1. voir [le site](https://exemple.test)',
      '',
      '| Nom | Téléphone |',
      '|-----|-----------|',
      '| Firmin | 06 00 00 00 00 |',
      '',
      '```',
      'brut  *non traité*',
      '```',
    ].join('\n'));
    expect(blocks).toEqual([
      { kind: 'h1', text: 'Audition' },
      { kind: 'p', text: 'Se présente Odile DELARZE, joignable au 04 60 48 05 02.' },
      { kind: 'li', text: 'véhicule Berlingo' },
      { kind: 'li', text: 'voir le site (https://exemple.test)' },
      { kind: 'row', text: 'Nom\tTéléphone' },
      { kind: 'row', text: 'Firmin\t06 00 00 00 00' },
      { kind: 'pre', text: 'brut  *non traité*' },
    ]);
  });

  it('leaves identifiers with underscores alone', () => {
    expect(parseMarkdown('compte user_name_42 et a*b')[0].text).toBe('compte user_name_42 et a*b');
  });
});

describe('parseDocxXml', () => {
  it('reads headings, runs, tabs, breaks, lists and tables', () => {
    const blocks = parseDocxXml(docx(`
      <w:p><w:pPr><w:pStyle w:val="Titre1"/></w:pPr><w:r><w:t>Procès-verbal</w:t></w:r></w:p>
      <w:p><w:r><w:t xml:space="preserve">Se présente </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Odile</w:t></w:r><w:r><w:tab/><w:t>DELARZE</w:t><w:br/><w:t>suite</w:t></w:r></w:p>
      <w:p/>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Berlingo</w:t></w:r></w:p>
      <w:p><w:del><w:r><w:delText>supprimé</w:delText></w:r></w:del><w:ins><w:r><w:t>ajouté</w:t></w:r></w:ins><w:r><w:fldChar w:fldCharType="begin"/><w:instrText>HYPERLINK</w:instrText></w:r></w:p>
      <w:tbl><w:tblPr/><w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Nom</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Plaque</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Firmin</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>VA-637-FV</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:r><w:t>Constatations</w:t></w:r></w:p>`));
    expect(blocks).toEqual([
      { kind: 'h1', text: 'Procès-verbal' },
      { kind: 'p', text: 'Se présente Odile\tDELARZE\nsuite' },
      { kind: 'li', text: 'Berlingo' },
      { kind: 'p', text: 'ajouté' },
      { kind: 'row', text: 'Nom\tPlaque' },
      { kind: 'row', text: 'Firmin\tVA-637-FV' },
      { kind: 'h2', text: 'Constatations' },
    ]);
  });

  it('rejects broken XML', () => {
    expect(() => parseDocxXml('<w:document')).toThrow();
  });
});

describe('parseOdtXml', () => {
  it('collapses white space, reads spaces, lists, headings and tables', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">
<office:body><office:text>
  <text:sequence-decls><text:sequence-decl text:name="Table"/></text:sequence-decls>
  <text:h text:outline-level="2">Audition</text:h>
  <text:p>  Se   présente <text:span>Odile</text:span><text:s text:c="3"/>DELARZE<text:tab/>fin<text:line-break/>suite<text:note><text:note-citation>1</text:note-citation><text:note-body><text:p>note</text:p></text:note-body></text:note></text:p>
  <text:p/>
  <text:list><text:list-item><text:p>Berlingo</text:p></text:list-item></text:list>
  <table:table><table:table-column/><table:table-row><table:table-cell><text:p>Nom</text:p></table:table-cell><table:table-cell><text:p>IBAN</text:p></table:table-cell></table:table-row></table:table>
</office:text></office:body></office:document-content>`;
    expect(parseOdtXml(xml)).toEqual([
      { kind: 'h2', text: 'Audition' },
      { kind: 'p', text: 'Se présente Odile   DELARZE\tfin\nsuite' },
      { kind: 'li', text: 'Berlingo' },
      { kind: 'row', text: 'Nom\tIBAN' },
    ]);
  });
});

describe('blocksText', () => {
  it('ends every block with a line break, and gives block offsets', () => {
    const blocks = [{ kind: 'h1' as const, text: 'Titre' }, { kind: 'p' as const, text: 'Corps' }];
    expect(blocksText(blocks)).toBe('Titre\nCorps\n');
    expect(blockStarts(blocks)).toEqual([0, 6]);
  });
});
