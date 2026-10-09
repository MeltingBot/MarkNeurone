---
title: "Installation"
weight: 1
---

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

MarkNeurone nécessite ZeroNeurone 2.63 ou une version ultérieure. Avec une version antérieure, le plugin ne se charge pas et un message l'indique.

Dans un dossier partagé, les surlignages et les références des documents sont transmis aux autres membres, et un lien de source vers un passage s'ouvre chez chacun d'eux. Tous les membres doivent utiliser la même version de MarkNeurone. Le texte reconnu par l'OCR n'est pas transmis : un membre qui n'a pas lancé la reconnaissance voit le passage à l'échelle de la page.

## Désinstallation

Retirez l'entrée de `manifest.json` et le fichier `markneurone.js`. Les éléments, liens et propriétés créés avec MarkNeurone sont des objets ordinaires de ZeroNeurone et restent dans le graphe. Les surlignages restent enregistrés dans le dossier et réapparaissent si le plugin est réinstallé.

## Licence

MarkNeurone est distribué sous licence MIT. Les licences des composants inclus (PDF.js, Tesseract.js, JSZip et leurs dépendances) figurent dans [`THIRD-PARTY-LICENSES.md`](https://github.com/MeltingBot/MarkNeurone/blob/main/THIRD-PARTY-LICENSES.md) et en tête du fichier `markneurone.js`.
