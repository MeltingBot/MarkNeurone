# MarkNeurone

Plugin de lecture annotée pour [ZeroNeurone](https://github.com/MeltingBot/zeroneurone). MarkNeurone affiche un document (PDF, DOCX, ODT, TXT, Markdown) dans ZeroNeurone et permet de créer, à partir d'un passage surligné, des éléments, des propriétés, des événements, des localisations et des liens dans le graphe. Chaque objet créé conserve une référence vers le passage d'origine.

Le plugin s'adresse en particulier à l'exploitation de procès-verbaux d'audition, que les analystes traitent habituellement par surlignage avant de construire le graphe.

## Principes

- **Traitement local.** Les documents, le texte reconnu par OCR et les annotations restent sur le poste. Le plugin n'effectue aucun appel réseau : le moteur OCR et le modèle de langue française sont inclus dans le plugin.
- **Validation par l'utilisateur.** Aucun objet n'est ajouté au graphe sans action explicite de l'utilisateur. Il n'existe pas de validation groupée.
- **Pas de rattachement automatique.** Lorsqu'un élément du graphe porte un nom proche du passage sélectionné, il est proposé, mais l'action par défaut reste la création d'un nouvel élément. Le rattachement à un élément existant est toujours un choix de l'utilisateur, afin d'éviter la fusion d'homonymes.
- **Pas d'ontologie imposée.** Les tags proposés par défaut proviennent d'un profil de configuration et peuvent être remplacés.
- **Traçabilité.** Chaque objet créé indique son origine et pointe vers le passage source, y compris après une fusion d'éléments ou un export du dossier.

## Fonctionnalités

### Formats pris en charge

- **PDF avec couche texte**, affichés avec PDF.js.
- **PDF numérisés.** Le texte est reconnu en arrière-plan, page par page, avec Tesseract. Le résultat est enregistré avec le dossier et n'est calculé qu'une fois par document. Lorsqu'un mot du passage a été lu avec une faible confiance, le formulaire affiche l'image du passage pour corriger la lecture avant de valider. Le texte lu par l'OCR reste enregistré à côté du texte validé.
- **Relecture d'une sélection.** Sur une page numérisée, la barre de sélection propose « Relire la sélection » : le passage est relu seul, à haute résolution et sans l'encre de couleur (tampons), et le formulaire affiche son image.
- **Passage encadré.** Pour ce qui ne peut pas être sélectionné (passage manuscrit, zone sans texte reconnu), « Encadrer un passage » dans le menu du clic droit (touche Z) permet de l'entourer à la souris. Si rien n'est lu, le texte se saisit dans le formulaire en s'aidant de l'image.
- **Tampons.** Avant la reconnaissance, l'encre de couleur (tampons rouges ou bleus) est retirée de l'image. Un texte imprimé en couleur est retiré de la même façon.
- **DOCX, ODT, TXT et Markdown.** Le texte est affiché sur une page continue avec ses titres, paragraphes, listes et tableaux. La mise en page d'origine n'est pas reproduite.

### Création d'objets dans le graphe

Après sélection d'un passage, une touche (ou le menu du clic droit) indique ce qu'il représente :

| Touche | Type | Effet dans ZeroNeurone |
|---|---|---|
| E | Élément | Crée un élément, ou rattache le passage à un élément existant choisi dans la liste des éléments proches |
| P | Propriété | Ajoute une propriété à l'élément affiché |
| V | Événement | Ajoute un événement daté à un ou plusieurs éléments. La date et l'heure sont lues dans la phrase lorsqu'elles y figurent. |
| G | Localisation | Renseigne les coordonnées de l'élément avec le sélecteur de carte de ZeroNeurone |

Un lien se crée en sélectionnant deux passages surlignés (Ctrl+clic) puis en appuyant sur L. Lorsque les deux passages appartiennent à la même phrase, le texte qui les sépare est proposé comme libellé du lien.

### Suggestions

Le bouton « Afficher les suggestions » de la barre d'outils signale dans le document, en surlignage atténué :

- les noms des éléments déjà présents dans le dossier (libellés et propriétés « Alias »), dans la couleur de leur tag, y compris en ordre inversé ou avec une initiale pour le prénom ;
- les téléphones, plaques d'immatriculation, IBAN, SIRET, NIR, adresses e-mail, URL, adresses IP, adresses Bitcoin et Ethereum, montants en euros et dates.

Un clic sur une suggestion propose les mêmes choix qu'une sélection (E, P, V, G), avec le tag ou la clé de propriété correspondant au type détecté, ou permet de l'ignorer (Suppr). Chaque suggestion se traite séparément : il n'existe pas de validation groupée. Les objets créés de cette façon gardent l'indication de leur origine (motif ou dictionnaire). Lorsque la clé de contrôle d'un IBAN, d'un SIRET ou d'un NIR est fausse, le formulaire signale une erreur de lecture probable.

Les suggestions sont masquées à la première ouverture de chaque document, pour une première lecture sans orientation. Le choix est ensuite conservé par document.

### Fiche de l'élément

La partie droite du lecteur présente l'élément sélectionné avec la même organisation que le panneau de ZeroNeurone : libellé et tags, propriétés, événements, localisation, liens, et liste des passages du document qui s'y rapportent.

### Onglet « Marqueur »

Dans le panneau de droite de ZeroNeurone, l'onglet « Marqueur » liste les passages de l'élément ou du lien sélectionné sur le canvas, dans tous les documents du dossier, un document par section repliable. Les passages identiques n'occupent qu'une ligne, suivie de leurs numéros de page. Un clic ouvre le document sur le passage.

### Réglages

La roue dentée de la carte MarkNeurone, dans la section « Extensions » de la page d'accueil de ZeroNeurone, ouvre les réglages. Ils valent pour tous les dossiers :

- les tags proposés à la création d'un élément, leur ordre (raccourcis Alt+1 à Alt+9) et leur couleur, qui est celle du tag dans ZeroNeurone ;
- les propriétés dont la valeur est lue comme un autre nom de l'élément (par défaut « Alias ») ;
- le tag et la clé de propriété proposés pour chaque type de suggestion ;
- le retrait de l'encre de couleur avant la reconnaissance du texte.

### Autres fonctions

- Recherche dans l'ensemble du document, y compris dans le texte reconnu par OCR.
- Les annotations sont incluses dans l'export ZIP de ZeroNeurone (`annotations.json`) et reliées aux éléments lors de l'import.
- Lorsqu'un élément est fusionné, ses annotations suivent l'élément résultant. Lorsqu'il est supprimé, elles sont conservées et peuvent être rattachées à un autre élément.

## Utilisation

1. Ajouter le document au dossier en le déposant sur le canvas de ZeroNeurone.
2. Faire un clic droit sur l'élément qui porte le document, puis choisir « Lire dans MarkNeurone ».
3. Sélectionner un passage, puis appuyer sur E, P, V ou G.

Le lecteur peut être réduit pour revenir au canvas, puis rouvert à la même position.

### Raccourcis clavier

| Touche | Action |
|---|---|
| E, P, V, G | Créer un élément, une propriété, un événement ou une localisation à partir de la sélection |
| Alt+1 à Alt+7 | Ajouter un tag du profil dans le formulaire de création d'élément |
| Ctrl+clic | Sélectionner plusieurs passages surlignés |
| L | Créer un lien entre les deux éléments sélectionnés |
| Z | Encadrer un passage à la souris |
| Suppr | Ignorer la suggestion sélectionnée |
| Ctrl+F | Rechercher dans le document |
| Entrée, Maj+Entrée | Résultat de recherche suivant, précédent |
| Échap | Fermer la liste ou le formulaire ouvert, puis réduire le lecteur |

## Développement

MarkNeurone est un workspace du monorepo `neurone` et se lance avec ZeroNeurone.

```bash
npm install            # à la racine du monorepo
npm run dev            # ZeroNeurone avec MarkNeurone, port 5179
npm run typecheck
npm run test           # tests unitaires (Vitest)
npm run build:plugin   # génère dist-plugin/markneurone.js
```

Le sélecteur de carte n'est disponible que si la version de ZeroNeurone expose `ui.openGeoPicker`. Avec une version antérieure, le lecteur se réduit et ouvre la fiche de l'élément dans le panneau de ZeroNeurone.

### Structure du code

```
src/
  core/          logique sans dépendance à l'interface, couverte par les tests : modèle de données,
                 références aux passages, géométrie, découpage en phrases, dates, identifiants
                 et clés de contrôle, recherche d'éléments proches, OCR, documents texte
  services/      accès à ZeroNeurone (graphWriter.ts concentre toutes les écritures dans le graphe),
                 PDF.js, OCR, stockage des annotations, export et import
  components/    lecteur, fiche de l'élément, menus
  profiles/      profil par défaut : tags, raccourcis, propriétés utilisées comme alias
  locales/       traductions FR et EN
bench/ocr/       banc d'essai de l'OCR
docs/api-zn.md   fonctions de l'API de plugins de ZeroNeurone utilisées, limites et solutions retenues
```

### Banc d'essai OCR

Le dossier `bench/ocr/` contient un outil autonome qui mesure, pour un ensemble de PDF numérisés, le temps de traitement par page, la confiance moyenne et le taux d'erreur sur les identifiants (téléphones, plaques, IBAN, SIRET). Voir [`bench/ocr/README.md`](bench/ocr/README.md).

### Données de test

Le dépôt ne contient que des documents fictifs : les procès-verbaux de test sont générés par le banc à partir de textes inventés, puis dégradés (inclinaison, bruit, tampons, photocopie). Pour mesurer l'OCR sur d'autres documents, placez-les dans `bench/ocr/data/`. Ce dossier est exclu de git.

## Documentation

- [`note-plugin-lecture-pdf-zn.md`](note-plugin-lecture-pdf-zn.md) : note de cadrage (périmètre, modèle de données, MVP).
- [`analyse-contradictoire-markneurone.md`](analyse-contradictoire-markneurone.md) : analyse des risques.
- [`docs/api-zn.md`](docs/api-zn.md) : API de plugins de ZeroNeurone.

## État du projet

Version 0.1.0, en développement. Les fonctions de la première version sont en place ; elles restent à éprouver sur des pièces réelles.

## Licence

[MIT](LICENSE). Licences des composants tiers : [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md).
