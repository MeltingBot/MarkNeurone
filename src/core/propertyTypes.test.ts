import { describe, expect, it } from 'vitest';
import { countries, countryName, matchChoice, matchCountry, parseChoices } from './propertyTypes.ts';

describe('countries', () => {
  it('lists ISO codes with French names, without groupings', () => {
    const list = countries();
    expect(list.find((c) => c.code === 'FR')?.fr).toBe('France');
    expect(list.some((c) => c.code === 'EU' || c.code === 'ZZ')).toBe(false);
    expect(list.length).toBeGreaterThan(190);
    expect(countryName('de')).toBe('Allemagne');
  });

  it('reads a country named in a passage, in French or English', () => {
    expect(matchCountry('France')).toBe('FR');
    expect(matchCountry('ALLEMAGNE')).toBe('DE');
    expect(matchCountry('Germany')).toBe('DE');
    expect(matchCountry('be')).toBe('BE');
    expect(matchCountry('Niort')).toBeNull();
  });
});

describe('choices', () => {
  it('matches an option case and accents aside', () => {
    expect(matchChoice('marié', ['Célibataire', 'Marié'])).toBe('Marié');
    expect(matchChoice('veuf', ['Célibataire', 'Marié'])).toBeNull();
  });

  it('parses comma-separated options', () => {
    expect(parseChoices(' a, b ,, a , c')).toEqual(['a', 'b', 'c']);
  });
});
