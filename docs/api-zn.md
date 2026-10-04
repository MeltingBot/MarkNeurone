# API de plugins de ZeroNeurone : ce que MarkNeurone peut utiliser

État établi le 1er octobre 2026 par lecture du code de ZN (`zeroneurone/src/`, React 19.2, Zustand 5, Dexie 4.4, pdfjs-dist 6.2.108). Les chemins sont relatifs à `zeroneurone/src/` sauf mention contraire.

Règle suivie : ZN n'est pas modifié, sauf décision explicite (section 10). Chaque capacité manquante est signalée ci-dessous avec le contournement retenu côté plugin. Aucun contournement ne passe par une structure interne non exposée à `register(api)`.

## 1. Chargement et objet `api`

Le chargeur (`services/pluginLoaderService.ts`) lit `/plugins/manifest.json`, vérifie l'empreinte SHA-256 de chaque fichier, remplace les imports nus `react`, `react-dom`, `react/jsx-runtime` et `dexie` par des modules de l'hôte, puis appelle `register(api)`. Un plugin est un fichier ES unique servi depuis `zeroneurone/public/plugins/`. Le manifeste est généré par `zeroneurone/scripts/build-plugins.mjs`, qui recalcule les empreintes.

Les plugins sont désactivés par défaut. La liste des plugins actifs est dans `localStorage`, clé `zeroneurone:enabled-plugins` (`plugins/pluginRegistry.ts`).

Clés de l'objet `api` (`plugins/pluginAPI.ts`, version délimitée par plugin via `createScopedPluginAPI`) :

| Clé | Contenu utile à MarkNeurone |
| --- | --- |
| `registerPlugin`, `registerPlugins`, `unregisterPlugin` | Enregistrement dans les slots |
| `React`, `icons`, `i18n` | React de l'hôte, icônes lucide, instance i18next |
| `stores` | `useDossierStore`, `useSelectionStore`, `useViewStore`, `useUIStore`, `useTagSetStore`, `useTabStore`, `useReportStore` |
| `repositories` | `elementRepository`, `linkRepository`, `dossierRepository` (écriture Dexie seule, voir 3) |
| `fileService` | Lecture des assets |
| `events` | Bus d'événements, `on(type, cb)` renvoie la fonction de désabonnement |
| `toast` | `success`, `error`, `warning`, `info`, `dismiss` |
| `pluginData` | Stockage clé/valeur par dossier, voir 5 |
| `generateUUID` | Identifiants |

Le niveau de confiance `trusted` donne accès à toute l'API. Le niveau `community` filtre selon les permissions du manifeste (`plugins/pluginSandbox.ts`) et rend la sélection et la vue du canvas en lecture seule. MarkNeurone est déclaré `trusted`.

Le fichier de types `types/plugin-api.d.ts` ne correspond plus au runtime sur plusieurs points (signature de `fileService.getAssetFile`, noms des méthodes des repositories, événements de tags absents). Le plugin type lui-même ce qu'il utilise dans `src/hostAPI.ts`.

## 2. Slots

| Slot | Props | Usage dans MarkNeurone |
| --- | --- | --- |
| `app:global` | aucune | Modale de lecture du PDF, toujours montée |
| `panel:right` | `{ dossierId }` | Onglet « Occurrences » de l'élément sélectionné |
| `contextMenu:element` | `MenuContext` : `elementIds`, `linkIds`, `hasTextAssets`, `dossierId` | « Lire dans MarkNeurone », « Voir la source » |
| `contextMenu:canvas` | idem, plus `canvasPosition` | « Importer un PDF à lire » |
| `home:card` | carte de présentation | Description du plugin |
| `export:hooks` | `onExport(zip, dossierId)`, `zip` est l'instance JSZip | Écriture de `annotations.json` |
| `import:hooks` | `onImport(zip, targetDossierId)` | Relecture de `annotations.json` |
| `keyboard:shortcuts` | `{ keys, action, description }` | Ouverture du lecteur |

L'onglet de panneau peut être ouvert par programme : `useUIStore.getState().setSidePanelTab(id)`.

## 3. Lecture et écriture du graphe

Lecture en direct : `useDossierStore.getState()` expose `elements`, `links`, `assets`, `currentDossier`.

Écriture : passer par le store, jamais par les repositories. Le document Yjs est la source de vérité et les repositories n'écrivent que dans Dexie, sans mise à jour de l'interface ni des collaborateurs.

| Besoin | Méthode du store |
| --- | --- |
| Créer un élément | `createElement(label, position, options?: Partial<Element>)` |
| Ajouter une propriété | `updateElement(id, { properties: [...anciennes, nouvelle] })` |
| Ajouter un événement | `updateElement(id, { events: [...anciens, nouvel] })` |
| Créer un lien | `createLink(fromId, toId, { label, direction, source })` |
| Attacher un fichier | `addAsset(elementId, file)` |

Modèle (`types/index.ts`) :

- `Element` : `label`, `tags: string[]`, `properties: Property[]`, `source: string`, `date`, `dateRange`, `events: ElementEvent[]`, `assetIds`, `position`.
- `Property` : `{ key, value, type? }`, types `text`, `number`, `date`, `datetime`, `boolean`, `choice`, `geo`, `country`, `link`. Les clés en double sont autorisées.
- `ElementEvent` : `{ id, date, dateEnd?, label, description?, geo?, properties?, source? }`. ZN n'a pas d'élément de type événement : un événement est une sous-fiche d'un élément, visible dans la frise.
- `Link` : `fromId`, `toId`, `label`, `direction` (`none`, `forward`, `backward`, `both`), `source`.

## 4. Sélection et navigation sur le canvas

- Lire la sélection : `useSelectionStore.getState().selectedElementIds` (un `Set`), et s'abonner avec `useSelectionStore.subscribe`.
- Sélectionner : `selectElements(ids)` (plugin `trusted` uniquement).
- Centrer sur un élément : pas de méthode dédiée. On calcule la vue et on appelle `useViewStore.getState().requestViewportChange({ x, y, zoom })`, comme le fait `components/report/ReportMarkdownPreview.tsx` (lignes 190 à 208).

## 5. Données propres au plugin

`pluginData` (version délimitée) : `get(dossierId, key)`, `set(dossierId, key, value)`, `remove(dossierId, key)`, et `getGlobal`, `setGlobal`, `removeGlobal` pour les réglages. Stockage dans la table Dexie `pluginData`, chiffré au repos si le chiffrement est actif, supprimé avec le dossier. Aucune limite de taille au-delà de celle d'IndexedDB.

Ces données ne sont ni exportées dans le ZIP ni synchronisées avec les collaborateurs. Le plugin les exporte lui-même par `export:hooks`.

En mode workspace (`src/plugin.ts`), `pluginData` est brut et prend l'identifiant du plugin en premier argument : un adaptateur délimité est créé, comme dans ForeNeurone.

## 6. Assets et PDF

- `Asset` : `{ id, filename, mimeType, size, hash, ... }`. Le champ `hash` est l'empreinte SHA-256 du contenu, calculée par ZN à l'ajout (`services/fileService.ts`). MarkNeurone l'utilise comme `documentHash`.
- Lecture du contenu : `api.fileService.getAssetFile(asset)` renvoie un `File` déchiffré.
- ZN embarque `pdfjs-dist` 6.2.108 et un aperçu PDF (`components/common/PdfPreview.tsx`), mais ni l'un ni l'autre n'est exposé aux plugins. L'extraction de texte de ZN (`extractPdfText`) se limite aux 100 premières pages, sans positions.
- Tesseract est absent de ZN.
- Documents texte (DOCX, ODT, TXT, Markdown) : ZN extrait leur texte à l'ajout (`asset.extractedText`), mais sous une forme normalisée (espaces regroupés, guillemets et tirets réécrits, sans titres, listes ni tableaux), qui peut changer avec la version de ZN. MarkNeurone n'utilise donc pas ce champ : il fait sa propre extraction (`core/textDocument.ts`, identifiant `TEXT_EXTRACTOR_ID` enregistré dans chaque annotation) et affiche le document comme une feuille continue de texte. Les positions des surlignages sont des positions dans ce texte, recalculées à l'affichage, car la mise en page dépend des polices du poste. Les en-têtes, pieds de page, notes, commentaires, révisions supprimées et images ne sont pas lus ; le format `.doc` binaire n'est pas pris en charge. ZN embarque `jszip`, mais le plugin ne peut pas l'importer : il l'embarque aussi.
- La politique de sécurité du contenu (`security-headers.conf`) autorise `script-src 'self' blob: 'wasm-unsafe-eval'` et `worker-src 'self' blob:` : un worker et un module WASM chargés depuis une Blob URL sont acceptés.

## 7. Événements

Types : `dossier:created|updated|deleted|opened|closed`, `element:created|updated|deleted|tagAdded|tagRemoved`, `link:created|updated|deleted`, `asset:created|deleted`. Charge utile : `{ type, dossierId, entityId?, timestamp, meta? }`.

## 8. Capacités manquantes et contournements

| N° | Manque | Contournement retenu |
| --- | --- | --- |
| 1 | Aucun onglet ni vue de plugin, panneau latéral limité à 600 px (`components/panels/SidePanel.tsx`) | Lecteur dans une grande modale montée par `app:global`, réductible en pastille pour revenir au canvas |
| 2 | pdf.js non exposé | Le plugin embarque `pdfjs-dist` 6.2.108 et son worker dans le bundle |
| 3 | Pas de champ alias sur `Element` | Dictionnaire construit sur le libellé et sur les propriétés dont la clé est dans une liste réglable (par défaut `Alias`) |
| 4 | Aucun événement à la fusion d'éléments (`mergeElements` n'émet ni `element:merged` ni `element:deleted`) | `core/integrity.ts`, appelé par le lecteur à l'ouverture d'un document et à chaque changement des éléments ou liens du store : la cible actuelle est gardée tant qu'elle porte le jeton d'ancre, sinon l'élément qui le porte est suivi (`mergeElements` concatène les `source`, `stores/dossierStore.ts` l. 1968 à 1970, et déplace les événements et les liens). Sans porteur, l'annotation devient orpheline en gardant sa dernière cible. Rien n'est réécrit avant la fin du chargement du dossier (`isLoading`) |
| 5 | `import:hooks` ne reçoit pas la correspondance entre anciens et nouveaux identifiants | Annotations indexées par empreinte du document. Jeton `[mn:<id court>]` écrit dans le champ natif `source` de l'élément ou du lien, ce qui permet de recâbler `targetId` après import |
| 6 | Une propriété de type `link` n'ouvre qu'une URL externe (`window.open`) | Retour au passage par l'onglet « Occurrences » et par l'entrée de menu « Voir la source » |
| 7 | Pas d'asset sans élément | Importer un PDF à lire crée, sur geste explicite, un élément document qui porte l'asset |
| 8 | Sélection et vue en écriture réservées aux plugins `trusted` | MarkNeurone est déclaré `trusted` dans le registre de `build-plugins.mjs` |
| 9 | Les raccourcis du canvas (Suppr, Ctrl+Z...) écoutent `keydown` sur `window` en phase de bouillonnement (`pages/DossierPage.tsx` l. 343, `components/canvas/Canvas.tsx` l. 4096 et 4822) et restent actifs sous une modale | La modale, ouverte et non réduite, pose un écouteur sur `document` en phase de bouillonnement qui appelle `stopPropagation()`. Il s'exécute après les gestionnaires React de la modale et avant ceux de ZN sur `window`. Une écoute en capture sur `window` bloquerait aussi la saisie dans la modale |
| 10 | Pas d'événement de changement de sélection | Abonnement direct à `useSelectionStore` |
| 11 | Pas de méthode de centrage sur un élément | Calcul de la vue et `requestViewportChange` |
| 12 | `element:updated` ne porte pas les changements, `element:deleted` ne porte pas l'élément supprimé | Le plugin compare avec son propre index d'annotations |
| 13 | Les raccourcis de plugin ne fonctionnent que sur la page dossier, `scope` est ignoré | Sans conséquence : le lecteur n'a de sens que dans un dossier |
| 14 | `asset:deleted` est émis après la suppression, avec le seul identifiant de l'asset, et aucun événement ne précède la suppression. `removeAsset` retire l'asset de son élément mais garde sa ligne dans la table `assets` | Le plugin ne peut ni prévenir ni demander confirmation avant. Après coup, il retrouve l'empreinte et le nom par la ligne conservée, efface le texte reconnu si plus aucun élément ne référence un document de même empreinte, et avertit l'utilisateur si des surlignages sont conservés. Un document est tenu pour présent tant qu'un élément le référence, y compris pour l'export |

## 9. Évolutions de ZN qui simplifieraient le plugin

À proposer à part, si l'on décide un jour de faire évoluer ZN. Aucune n'est requise.

1. Un événement `element:merged` avec `{ targetId, sourceId }`.
2. La table de correspondance des identifiants passée aux `import:hooks`.
3. Un champ `aliases` sur `Element`.
4. Une méthode `centerOnElement(id)` dans `useViewStore`.
5. Un slot de vue principale pour les plugins.
6. Un événement ou un crochet avant la suppression d'un asset, pour avertir l'utilisateur des surlignages qui en dépendent avant qu'il confirme.

## 10. Évolutions de ZN réalisées pour MarkNeurone

### `ui.openGeoPicker` (branche `feature/plugin-geo-picker` de ZN)

Besoin : choisir un lieu sur une carte, avec recherche d'adresse, sans quitter le lecteur. Le plugin ne fait aucun appel réseau ; la carte et la recherche (Nominatim) restent celles de ZN.

- `plugins/pluginUi.ts` : `openGeoPicker(initial?, { query? })` renvoie une promesse résolue avec `{ lat, lng }` ou `null` si l'utilisateur annule. `query` préremplit le champ de recherche du sélecteur (prop `initialQuery` ajoutée à `GeoPicker`), la recherche reste déclenchée par l'utilisateur. Une demande encore ouverte est annulée par une nouvelle.
- `components/plugins/PluginUiHost.tsx`, monté dans `App.tsx` : affiche le `GeoPicker` existant (chargé à la demande) quand un plugin le demande.
- `pluginAPI.ui.openGeoPicker`, nouvelle permission `ui` (accordée par défaut aux plugins communautaires, comme `toast`), typage dans `types/plugin-api.d.ts`.
- Tests : `plugins/pluginUi.test.ts`.

Côté plugin, `src/services/mapPicker.ts` utilise cette fonction si elle existe, et sinon renvoie l'utilisateur vers le panneau de ZN (réduction du lecteur, sélection de l'élément).

Constat sur ZN non corrigé : la section Localisation du panneau Détail ne se met pas à jour quand la position est modifiée par un plugin ; la donnée est à jour, l'affichage l'est au rechargement.

### Constat : l'annulation d'une fusion ne restaure pas l'élément

Observé le 2 octobre 2026 : après une fusion depuis le canvas (Organiser, Fusionner), Ctrl+Z vide la pile d'annulation mais l'élément fusionné n'est pas recréé, ni à l'écran ni après rechargement (le dossier compte un élément de moins), sans erreur en console. `historyStore.ts` (cas `merge-elements`) restaure l'élément par `pasteElements`, qui n'ajoute pas l'élément aux onglets du canvas et ne met pas à jour l'état Zustand. Non corrigé (hors du plugin). Côté MarkNeurone, le cas est couvert par les tests de `core/integrity.ts` : si l'élément revient avec son jeton, ses passages le rejoignent.

