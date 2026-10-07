# Installation

MarkNeurone est distribué sous la forme d'un fichier unique, `markneurone.js`, qui contient le plugin, le moteur de reconnaissance du texte et le modèle de langue française. Aucun téléchargement n'a lieu ensuite.

## Ajouter le plugin à ZeroNeurone

1. Copiez `markneurone.js` dans le dossier `plugins/` servi par ZeroNeurone, à côté du fichier `manifest.json`.
2. Ajoutez l'entrée suivante dans la liste `plugins` de `manifest.json` :

   ```json
   {
     "id": "mark-neurone",
     "file": "markneurone.js",
     "name": "MarkNeurone",
     "description": "Lecture annotée de documents",
     "trust": "trusted",
     "integrity": "<empreinte SHA-256 du fichier>"
   }
   ```

3. Calculez l'empreinte du fichier, par exemple avec `sha256sum markneurone.js`, et reportez-la dans le champ `integrity`. ZeroNeurone refuse de charger un plugin dont l'empreinte ne correspond pas.
4. Rechargez ZeroNeurone. La carte MarkNeurone apparaît dans la section « Extensions » de la page d'accueil.

Le niveau `trusted` est nécessaire : MarkNeurone lit la sélection du canvas et centre la vue sur les éléments, deux fonctions que ZeroNeurone réserve aux plugins de confiance.

Après chaque mise à jour du plugin, recalculez l'empreinte et mettez à jour `manifest.json`.

## Version de ZeroNeurone

Le choix d'un lieu sur une carte depuis le lecteur nécessite une version de ZeroNeurone qui propose ce sélecteur aux plugins. Avec une version antérieure, le lecteur se réduit et ouvre l'élément dans le panneau de ZeroNeurone, où la localisation se renseigne de la manière habituelle.

Les liens de source, qui ouvrent le lecteur sur le passage depuis le champ « Source » d'un élément, d'un lien ou d'un événement, nécessitent ZeroNeurone 2.62 ou suivante. Avec une version antérieure, la source s'affiche en texte brut et le passage se retrouve par l'onglet « Marqueur ».

## Désinstallation

Retirez l'entrée de `manifest.json` et le fichier `markneurone.js`. Les éléments, liens et propriétés créés avec MarkNeurone sont des objets ordinaires de ZeroNeurone et restent dans le graphe. Les surlignages restent enregistrés dans le dossier et réapparaissent si le plugin est réinstallé.

## Licence

MarkNeurone est distribué sous licence MIT. Les licences des composants inclus (PDF.js, Tesseract.js, JSZip et leurs dépendances) figurent dans [`THIRD-PARTY-LICENSES.md`](../THIRD-PARTY-LICENSES.md) et en tête du fichier `markneurone.js`.
