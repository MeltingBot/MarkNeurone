// Generic patterns for pre-highlighting (section 5 of the scoping note):
// identifiers with check digits, contact and network identifiers, amounts
// and dates. Deterministic and explainable: each match says what it is.

import { extractIdentifiers, type IdentifierKind } from './identifiers.ts';
import { nirValid } from './checksums.ts';
import { findDates } from '../dates.ts';

export type PatternKind = IdentifierKind | 'nir' | 'email' | 'url' | 'ipv4' | 'ipv6' | 'btc' | 'eth' | 'amount' | 'date';

export interface PatternMatch {
  kind: PatternKind;
  start: number;
  end: number;
  /** false when the identifier carries a check digit and the check fails: probable misreading. */
  checksumOk?: boolean;
}

const EMAIL = /(?<![\w.+-])[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![\w-])/g;
const URL = /(?<![\w@/])(?:https?:\/\/|www\.)[^\s<>"«»]+/gi;
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`(?<![\\d.])(?:${OCTET}\\.){3}${OCTET}(?![\\d]|\\.\\d)`, 'g');
// Full form, or compressed with "::": a time such as 11:19 never matches.
const IPV6 = /(?<![\w:])(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,5})?|::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,6}))(?![\w:])/gi;
const BTC = /(?<![A-Za-z0-9])(?:bc1[ac-hj-np-z02-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})(?![A-Za-z0-9])/g;
const ETH = /(?<![A-Za-z0-9])0x[a-fA-F0-9]{40}(?![A-Za-z0-9])/g;
// 1 200 €, 1.200,50 euros, 500 EUR (thin and non-breaking spaces as thousands separators).
const AMOUNT = /(?<![\d,.])(?:\d{1,3}(?:[   .]\d{3})+|\d+)(?:,\d{1,2})?[   ]?(?:€|euros?(?![\p{L}])|EUR(?![\p{L}]))/giu;
const NIR = /(?<!\d)[12378][ ]?\d{2}[ ]?\d{2}[ ]?(?:\d{2}|2A|2B)[ ]?\d{3}[ ]?\d{3}[ ]?\d{2}(?!\d)/g;

/** Trailing punctuation belongs to the sentence, not to the address. */
function trimUrl(raw: string): string {
  return raw.replace(/[.,;:!?)\]'"»]+$/, '');
}

function collect(text: string, re: RegExp, kind: PatternKind, accept?: (raw: string) => boolean | { checksumOk: boolean }): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const m of text.matchAll(re)) {
    const raw = kind === 'url' ? trimUrl(m[0]) : m[0];
    const verdict = accept ? accept(raw) : true;
    if (verdict === false) continue;
    out.push({ kind, start: m.index, end: m.index + raw.length, ...(typeof verdict === 'object' ? verdict : {}) });
  }
  return out;
}

/** A base58 run of letters only is a word, not an address. */
const looksLikeAddress = (raw: string) => /\d/.test(raw.slice(1)) && /[a-zA-Z]/.test(raw.slice(1));

/** Earlier then longer match wins where matches overlap. */
function dropOverlaps(matches: PatternMatch[]): PatternMatch[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out: PatternMatch[] = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}

export function extractPatterns(text: string): PatternMatch[] {
  return dropOverlaps([
    ...extractIdentifiers(text).map(({ kind, start, end, checksumOk }) => ({ kind, start, end, ...(checksumOk !== undefined ? { checksumOk } : {}) })),
    ...collect(text, NIR, 'nir', (raw) => ({ checksumOk: nirValid(raw) })),
    ...collect(text, EMAIL, 'email'),
    ...collect(text, URL, 'url'),
    ...collect(text, IPV4, 'ipv4'),
    ...collect(text, IPV6, 'ipv6', (raw) => /[0-9a-f]{2}/i.test(raw)),
    ...collect(text, BTC, 'btc', looksLikeAddress),
    ...collect(text, ETH, 'eth'),
    ...collect(text, AMOUNT, 'amount'),
    ...findDates(text).map((d) => ({ kind: 'date' as const, start: d.start, end: d.end })),
  ]);
}
