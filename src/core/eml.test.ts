// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseEml } from './eml.ts';
import { textFormatOf } from './textDocument.ts';

const eml = (lines: string[]) => new TextEncoder().encode(lines.join('\r\n'));
const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

describe('textFormatOf', () => {
  it('recognizes e-mails by name or type', () => {
    expect(textFormatOf({ filename: 'Message.EML' })).toBe('eml');
    expect(textFormatOf({ filename: 'message', mimeType: 'message/rfc822' })).toBe('eml');
  });
});

describe('parseEml', () => {
  it('reads the main headers as fields, then the text body', () => {
    expect(parseEml(eml([
      'Received: from mx.exemple.fr',
      'From: =?UTF-8?Q?Odile_Delarze?= <odile.delarze@exemple.fr>',
      'To: Marc Vasseur <marc.vasseur@exemple.org>,',
      ' contact@exemple.net',
      'Subject: =?UTF-8?B?UsOpdW5pb24gZGUg?=',
      ' =?UTF-8?B?bGFuZGk=?=',
      'Date: Mon, 6 Oct 2026 10:12:00 +0200',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Bonjour, rendez-vous =C3=A0 la gare =',
      'de Lyon.',
      '',
      'Odile',
    ]))).toEqual([
      { kind: 'field', text: 'De\tOdile Delarze <odile.delarze@exemple.fr>' },
      { kind: 'field', text: 'À\tMarc Vasseur <marc.vasseur@exemple.org>, contact@exemple.net' },
      { kind: 'field', text: 'Date\tMon, 6 Oct 2026 10:12:00 +0200' },
      { kind: 'field', text: 'Sujet\tRéunion de landi' },
      { kind: 'pre', text: 'Bonjour, rendez-vous à la gare de Lyon.\n\nOdile' },
    ]);
  });

  it('reads raw 8-bit text in its declared charset, or guesses it', () => {
    const blocks = parseEml(latin1('Subject: Relev\xe9\r\nContent-Type: text/plain; charset=iso-8859-1\r\n\r\nMontant : 150 \xe9cus'));
    expect(blocks).toEqual([
      { kind: 'field', text: 'Sujet\tRelevé' },
      { kind: 'pre', text: 'Montant : 150 écus' },
    ]);
    // 8-bit UTF-8 without a charset, euro sign included.
    expect(parseEml(eml(['Subject: test', '', 'Prix : 20 €']))[1]).toEqual({ kind: 'pre', text: 'Prix : 20 €' });
  });

  it('prefers the plain text of an alternative, and lists attachment names', () => {
    const blocks = parseEml(eml([
      'From: a@exemple.fr',
      'Content-Type: multipart/mixed; boundary="mix"',
      '',
      'preamble',
      '--mix',
      'Content-Type: multipart/alternative; boundary=alt',
      '',
      '--alt',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      btoa('Voir le relevé joint.'.replace(/é/, '\xc3\xa9')),
      '--alt',
      'Content-Type: text/html',
      '',
      '<p>Voir le <b>relevé</b> joint.</p>',
      '--alt--',
      '--mix',
      'Content-Type: application/pdf; name="releve.pdf"',
      'Content-Disposition: attachment; filename="releve.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      'JVBERi0xLjQK',
      '--mix',
      'Content-Type: image/jpeg',
      "Content-Disposition: attachment; filename*=utf-8''photo%20%C3%A9t%C3%A9%09%0A2.jpg",
      '',
      '/9j/',
      '--mix--',
      'epilogue',
    ]));
    expect(blocks).toEqual([
      { kind: 'field', text: 'De\ta@exemple.fr' },
      { kind: 'pre', text: 'Voir le relevé joint.' },
      { kind: 'field', text: 'Pièces jointes\treleve.pdf\nphoto été 2.jpg' },
    ]);
  });

  it('reads an HTML body as blocks', () => {
    const blocks = parseEml(eml([
      'Content-Type: text/html; charset=utf-8',
      '',
      '<html><head><style>p { color: red }</style></head><body>',
      '<h2>Commande</h2><p>Livraison au<br>12 rue des Lilas</p>',
      '<p><a href="https://suivi.exemple.fr/c/42">Suivre le colis</a> ou <a href="https://exemple.fr">https://exemple.fr</a></p>',
      '<ul><li>Article A</li><li>Article B</li></ul>',
      '<table><tr><td>Total</td><td>45,00 €</td></tr></table>',
      '<table><tr><td><table><tr><td>Mise</td><td>en page</td></tr></table></td></tr></table>',
      '</body></html>',
    ]));
    expect(blocks).toEqual([
      { kind: 'h2', text: 'Commande' },
      { kind: 'p', text: 'Livraison au\n12 rue des Lilas' },
      { kind: 'p', text: 'Suivre le colis (https://suivi.exemple.fr/c/42) ou https://exemple.fr' },
      { kind: 'li', text: 'Article A' },
      { kind: 'li', text: 'Article B' },
      { kind: 'row', text: 'Total\t45,00 €' },
      { kind: 'row', text: 'Mise\ten page' },
    ]);
  });

  it('reads a forwarded message after its title', () => {
    const blocks = parseEml(eml([
      'Subject: Tr: facture',
      'Content-Type: multipart/mixed; boundary=b',
      '',
      '--b',
      'Content-Type: text/plain',
      '',
      'Pour info.',
      '--b',
      'Content-Type: message/rfc822',
      'Content-Disposition: attachment; filename="facture.eml"',
      '',
      'From: compta@exemple.fr',
      'Subject: facture',
      '',
      'Ci-joint la facture.',
      '--b--',
    ]));
    expect(blocks).toEqual([
      { kind: 'field', text: 'Sujet\tTr: facture' },
      { kind: 'pre', text: 'Pour info.' },
      { kind: 'h2', text: 'Message joint' },
      { kind: 'field', text: 'De\tcompta@exemple.fr' },
      { kind: 'field', text: 'Sujet\tfacture' },
      { kind: 'pre', text: 'Ci-joint la facture.' },
    ]);
  });

  it('joins format=flowed lines', () => {
    expect(parseEml(eml(['Content-Type: text/plain; format=flowed', '', 'Une phrase coupée ', 'en deux.', '-- ', 'Signature']))).toEqual([
      { kind: 'pre', text: 'Une phrase coupée en deux.\n-- \nSignature' },
    ]);
  });
});
