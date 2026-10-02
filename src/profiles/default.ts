// ─── Default reading profile ─────────────────────────────────
//
// The only place where element categories are named. They are ZN tag names:
// colors come from the user's TagSets, and a tag missing from the dossier is
// simply created by ZN when used. Profiles will be editable in the settings
// and provided by GoNeurone (V2).

import type { SuggestionKind } from '../core/suggestions.ts';

export interface GridEntry {
  /** ZN tag applied to the created element. */
  tag: string;
  /** Keyboard shortcut in the qualification form. */
  key: string;
}

export interface ReadingProfile {
  id: string;
  name: string;
  grid: GridEntry[];
  /** Property keys whose values count as alternative names of an element. */
  aliasKeys: string[];
  /** Pre-highlighting: tag proposed when a suggestion becomes an element. */
  suggestionTags: Partial<Record<SuggestionKind, string>>;
  /** Pre-highlighting: key proposed when a suggestion becomes a property. */
  suggestionKeys: Partial<Record<SuggestionKind, string>>;
}

// Built-in ZN TagSets most frequent in hearing reports.
const DEFAULT_TAGS = ['Personne', 'Entreprise', 'Lieu', 'Véhicule', 'Téléphone', 'Compte bancaire', 'Email'];

export const DEFAULT_PROFILE: ReadingProfile = {
  id: 'default',
  name: 'Par défaut',
  grid: DEFAULT_TAGS.map((tag, i) => ({ tag, key: String(i + 1) })),
  aliasKeys: ['Alias'],
  suggestionTags: {
    phone: 'Téléphone',
    iban: 'Compte bancaire',
    email: 'Email',
    plate: 'Véhicule',
    siret: 'Entreprise',
  },
  suggestionKeys: {
    phone: 'Téléphone',
    iban: 'IBAN',
    email: 'Email',
    plate: 'Immatriculation',
    siret: 'SIRET',
    nir: 'NIR',
    url: 'URL',
    ipv4: 'Adresse IP',
    ipv6: 'Adresse IP',
    btc: 'Adresse Bitcoin',
    eth: 'Adresse Ethereum',
    amount: 'Montant',
  },
};
