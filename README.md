# MarkNeurone

Plugin de lecture annotée pour [ZeroNeurone](https://github.com/MeltingBot/zeroneurone). Il ouvre un document dans ZeroNeurone, permet d'en surligner des passages et de les transformer en éléments, propriétés, événements, localisations et liens du graphe, avec un retour vers la source.

Il reprend la pratique de prétraitement des procès-verbaux par surlignage des analystes criminels : chaque objet du graphe garde la trace du passage qui l'a fait naître.

## Principes

- **Local.** Aucun document, aucun texte reconnu et aucune annotation ne quitte le poste. Pas d'appel réseau, pas de télémétrie, pas d'OCR distant : le moteur et le modèle de reconnaissance sont inclus dans le plugin.
- **L'utilisateur décide.** Rien n'entre dans le graphe sans un geste explicite, et il n'existe pas de validation en masse.
- **Pas de rattachement automatique.** Un passage n'est jamais rattaché seul à un élément existant : les éléments proches sont proposés, la création reste l'action par défaut. Une fusion abusive d'homonymes est l'erreur la plus grave que le plugin puisse commettre.
- **Pas d'ontologie imposée.** Les tags proposés viennent d'un profil de configuration et restent modifiables.
- **Traçabilité.** Chaque objet créé garde son origine et une ancre vers le passage source, y compris après une fusion d'éléments ou un export.

## Fonctionnalités

**Documents**
- PDF avec couche texte, affichés avec PDF.js.
- PDF numérisés : reconnaissance du texte (OCR) en arrière-plan, page par page, avec Tesseract et un modèle français embarqué. Le résultat est mis en cache avec le dossier.
- DOCX, ODT, TXT et Markdown, affichés comme une feuille de texte continue (titres, paragraphes, listes, tableaux).

**Gestes de qualification**, sur un passage sélectionné :

| Touche | Geste | Résultat dans ZeroNeurone |
|---|---|---|
| E | Élément | Nouvel élément, ou rattachement à un élément existant choisi par l'utilisateur |
| P | Propriété | Propriété ajoutée à l'élément actif |
| V | Événement | Événement daté (date et heure lues dans la phrase) sur un ou plusieurs éléments |
| G | Localisation | Coordonnées de l'élément, avec le sélecteur de carte de ZeroNeurone |

Les mêmes gestes sont accessibles par clic droit sur la sélection.

**Liens** : Ctrl+clic sur deux surlignages, puis L. Le libellé proposé est le texte situé entre les deux passages lorsqu'ils sont dans la même phrase.

**Fiche de l'élément** à droite du document, sur le modèle du panneau de ZeroNeurone : identité et tags, propriétés, événements, localisation, liens et passages du document.

**Autres**
- Recherche dans tout le document, texte reconnu par OCR compris (Ctrl+F).
- Annotations incluses dans l'export ZIP de ZeroNeurone (`annotations.json`) et rattachées à l'import.
- Suivi des fusions et suppressions d'éléments : une annotation dont l'élément a disparu devient orpheline et peut être rattachée à nouveau.

## Raccourcis

| Touche | Action |
|---|---|
| E, P, V, G | Qualifier le passage sélectionné |
| Alt+1 à Alt+7 | Ajouter un tag du profil dans le formulaire d'élément |
| Ctrl+clic | Ajouter un surlignage à la sélection |
| L | Lier les deux éléments sélectionnés |
| Ctrl+F | Rechercher dans le document |
| Entrée, Maj+Entrée | Résultat suivant, précédent |
| Échap | Fermer la liste ou le formulaire en cours, puis réduire le lecteur |

## Utilisation

1. Déposer un document sur le canvas de ZeroNeurone : il est rattaché à un élément.
2. Clic droit sur cet élément, puis « Lire dans MarkNeurone ».
3. Sélectionner un passage et choisir un geste.

Le lecteur peut être réduit pour revenir au canvas sans perdre la position de lecture.

## Développement

Le plugin fait partie du monorepo `neurone` (npm workspaces) et s'exécute à côté de ZeroNeurone.

```bash
npm install            # à la racine du monorepo
npm run dev            # ZeroNeurone + MarkNeurone, port 5179
npm run typecheck
npm run test           # vitest
npm run build:plugin   # bundle dist-plugin/markneurone.js
```

Le sélecteur de carte de ZeroNeurone est utilisé lorsque la version de ZeroNeurone expose `ui.openGeoPicker`. Sinon, le lecteur se réduit et ouvre le panneau de l'élément.

### Organisation

```
src/
  core/          logique pure et testée : modèle, ancres, géométrie, phrases, dates,
                 identifiants et clés de contrôle, dictionnaire, recherche, OCR, documents texte
  services/      accès à ZeroNeurone (graphWriter.ts est le seul point d'écriture),
                 PDF.js, OCR, stockage des annotations, export et import
  components/    lecteur, fiche de l'élément, menus
  profiles/      profil par défaut (tags, raccourcis, clés d'alias)
  locales/       textes FR et EN
bench/ocr/       banc d'essai OCR autonome
docs/api-zn.md   capacités de l'API de plugins de ZeroNeurone et contournements
```

### Banc d'essai OCR

`bench/ocr/` mesure le temps, la confiance et le taux d'erreur sur les identifiants (téléphones, plaques, IBAN, SIRET) à partir de PV fictifs dégradés. Voir [`bench/ocr/README.md`](bench/ocr/README.md).

### Données de test

Le dépôt ne contient aucune pièce réelle. Les PV de test sont générés à partir de textes fictifs. Les fichiers déposés dans `bench/ocr/data/` restent hors du dépôt.

## Documentation

- [`note-plugin-lecture-pdf-zn.md`](note-plugin-lecture-pdf-zn.md) : note de cadrage (périmètre, modèle de données, MVP).
- [`analyse-contradictoire-markneurone.md`](analyse-contradictoire-markneurone.md) : analyse des risques.
- [`docs/api-zn.md`](docs/api-zn.md) : API de plugins de ZeroNeurone utilisée par MarkNeurone.

## État

MVP en cours. Restent à faire : le pré-surlignage (motifs et dictionnaire du dossier), l'OCR d'une zone avec correction, le retour au passage depuis le panneau de ZeroNeurone et l'écran de réglages du profil.

## Licence

[MIT](LICENSE). Composants tiers : [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md).
