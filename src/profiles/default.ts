// ─── Default reading profile ─────────────────────────────────
//
// The only place where element categories are named. They are ZN tag names:
// colors come from the user's TagSets, and a tag missing from the dossier is
// simply created by ZN when used. Profiles will be editable in the settings
// and provided by GoNeurone (V2).

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
}

// Built-in ZN TagSets most frequent in hearing reports.
const DEFAULT_TAGS = ['Personne', 'Entreprise', 'Lieu', 'Véhicule', 'Téléphone', 'Compte bancaire', 'Email'];

export const DEFAULT_PROFILE: ReadingProfile = {
  id: 'default',
  name: 'Par défaut',
  grid: DEFAULT_TAGS.map((tag, i) => ({ tag, key: String(i + 1) })),
  aliasKeys: ['Alias'],
};
