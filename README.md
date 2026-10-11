# MarkNeurone

Plugin de lecture annotée pour [ZeroNeurone](https://github.com/MeltingBot/zeroneurone). MarkNeurone affiche un document (PDF, DOCX, ODT, TXT, Markdown, courriel EML) dans ZeroNeurone et permet de créer, à partir d'un passage surligné, des éléments, des propriétés, des événements, des localisations et des liens dans le graphe. Chaque objet créé conserve une référence vers le passage d'origine.

Il convient à tout document rédigé dont on veut tirer des éléments du graphe : rapports, articles de presse, statuts de société, décisions de justice, courriels, auditions. Il reprend en particulier la pratique des analystes qui surlignent les procès-verbaux avant de construire le graphe, d'où la reconnaissance du texte des documents numérisés et la lecture des en-têtes de PV. Les tableaux (relevés bancaires, fadettes) relèvent plutôt d'un import structuré.

**Documentation utilisateur : [mark.zeroneurone.com](https://mark.zeroneurone.com/), sources dans [`user_doc/`](user_doc/content/fr/_index.md).**

## Principes

- **Traitement local.** Le plugin n'effectue aucun appel réseau : le moteur OCR et le modèle de langue française sont inclus dans le plugin. Les annotations et les références des documents sont enregistrées avec le dossier ZeroNeurone ; dans un dossier partagé, elles sont transmises aux autres membres par la synchronisation chiffrée de ZeroNeurone (2.63 et suivantes). Le texte reconnu par OCR et les préférences d'affichage restent sur le poste.
- **Validation par l'utilisateur.** Aucun objet n'est ajouté au graphe sans action explicite de l'utilisateur. Il n'existe pas de validation groupée.
- **Pas de rattachement automatique.** Lorsqu'un élément du graphe porte un nom proche du passage sélectionné, il est proposé, mais l'action par défaut reste la création d'un nouvel élément. Le rattachement à un élément existant est toujours un choix de l'utilisateur, afin d'éviter la fusion d'homonymes.
- **Pas d'ontologie imposée.** Les tags proposés par défaut proviennent d'un profil de configuration et peuvent être remplacés.
- **Traçabilité.** Chaque objet créé indique son origine et pointe vers le passage source, y compris après une fusion d'éléments ou un export du dossier.

## Fonctionnalités

- Lecture des PDF avec couche texte, des PDF numérisés (OCR locale en arrière-plan avec Tesseract, mise en cache avec le dossier), des DOCX, ODT, TXT et Markdown, et des courriels EML (en-têtes, texte du message, noms des pièces jointes).
- Relecture d'une sélection à haute résolution, passage encadré à la souris pour l'écriture manuscrite, retrait de l'encre des tampons avant la reconnaissance.
- Création d'éléments, de propriétés (les huit types de ZeroNeurone), d'événements datés et de localisations à partir d'un passage, par une touche (E, P, V, G).
- Liens entre deux passages surlignés, et, en option, mode verbe et liens possibles signalés dans la marge.
- Suggestions : noms des éléments du dossier et identifiants français, et en option belges, suisses et luxembourgeois (téléphones, plaques, IBAN, identifiants d'entreprise et de personne), e-mails, URL, IP, adresses Bitcoin et Ethereum, montants en euros et en francs suisses, dates, avec contrôle des clés.
- Fiche de l'élément sur le modèle du panneau de ZeroNeurone, cotation comprise.
- Onglet « Marqueur » dans le panneau de ZeroNeurone : passages de l'élément sélectionné dans tous les documents du dossier.
- Référence du document (par exemple un numéro de PV ou de rapport) reprise dans la source des objets créés.
- Annotations et texte reconnu inclus dans l'export ZIP de ZeroNeurone et rattachés à l'import. Suivi des fusions et des suppressions d'éléments.

## Prise en main

1. Installer le plugin : voir [Installation](user_doc/content/fr/installation.md).
2. Déposer le document sur le canvas de ZeroNeurone.
3. Faire un clic droit sur l'élément qui porte le document, puis choisir « Lire dans MarkNeurone ».
4. Sélectionner un passage, puis appuyer sur E (élément), P (propriété), V (événement) ou G (localisation).

La suite est décrite dans la [documentation utilisateur](https://mark.zeroneurone.com/).

## Développement

MarkNeurone est un workspace du monorepo `neurone` et se lance avec ZeroNeurone.

```bash
npm install            # à la racine du monorepo
npm run dev            # ZeroNeurone avec MarkNeurone, port 5179
npm run typecheck
npm run test           # tests unitaires (Vitest)
npm run build:plugin   # génère dist-plugin/markneurone.js
```

Le build minifié place en tête de `markneurone.js` la licence de MarkNeurone et celles des composants inclus, que la minification retirerait sinon.

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
user_doc/        documentation utilisateur (site Hugo, voir user_doc/README.md)
```

### Banc d'essai OCR

Le dossier `bench/ocr/` contient un outil autonome qui mesure, pour un ensemble de PDF numérisés, le temps de traitement par page, la confiance moyenne et le taux d'erreur sur les identifiants (téléphones, plaques, IBAN, SIRET). Voir [`bench/ocr/README.md`](bench/ocr/README.md).

### Données de test

Le dépôt ne contient que des documents fictifs : les procès-verbaux de test sont générés par le banc à partir de textes inventés, puis dégradés (inclinaison, bruit, tampons, photocopie). Pour mesurer l'OCR sur d'autres documents, placez-les dans `bench/ocr/data/`. Ce dossier est exclu de git.

## État du projet

Version 1.6.2. Les fonctions de la première version sont en place. Elles ont été mesurées sur des procès-verbaux fictifs dégradés et restent à éprouver sur des pièces réelles. Voir le [changelog](CHANGELOG.md).

## Licence

[MIT](LICENSE). Licences des composants tiers : [`THIRD-PARTY-LICENSES.md`](THIRD-PARTY-LICENSES.md).
