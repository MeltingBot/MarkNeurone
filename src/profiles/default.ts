// ─── Default reading profile ─────────────────────────────────
//
// The only place where element categories are named. They are ZN tag names:
// colors come from the user's TagSets, and a tag missing from the dossier is
// simply created by ZN when used. The user changes them in the settings
// (core/settings.ts); profiles provided by GoNeurone are for V2.

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
  /**
   * Kinds the settings were saved with: a kind added since then gets its
   * default tag and key, while an empty one the user chose stays empty.
   */
  suggestionKinds?: SuggestionKind[];
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
    be_bce: 'Entreprise',
    ch_ide: 'Entreprise',
    lu_rcs: 'Entreprise',
    lu_tva: 'Entreprise',
    url: 'Site web',
    btc: 'Wallet crypto',
    eth: 'Wallet crypto',
  },
  suggestionKeys: {
    phone: 'Téléphone',
    iban: 'IBAN',
    email: 'Email',
    plate: 'Immatriculation',
    siret: 'SIRET',
    nir: 'NIR',
    be_bce: "Numéro d'entreprise",
    be_nn: 'Numéro national',
    ch_ide: 'IDE',
    ch_avs: 'Numéro AVS',
    lu_rcs: 'RCS',
    lu_tva: 'Numéro de TVA',
    lu_nin: 'Matricule',
    url: 'URL',
    ipv4: 'Adresse IP',
    ipv6: 'Adresse IP',
    btc: 'Adresse Bitcoin',
    eth: 'Adresse Ethereum',
    amount: 'Montant',
  },
};
