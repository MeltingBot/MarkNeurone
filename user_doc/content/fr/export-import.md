---
title: "Export, import et suppression"
weight: 9
---

# Export, import et suppression

## Export et import d'un dossier

Les surlignages et le texte reconnu sont inclus dans l'export ZIP de ZeroNeurone, dans le fichier `annotations.json` placé à côté de `dossier.json` et dans le dossier `markneurone/ocr/` de l'archive. Une archive exportée avec MarkNeurone reste lisible par un ZeroNeurone sans le plugin : ces fichiers sont alors ignorés.

À l'import, les surlignages sont rattachés aux éléments et aux liens du dossier importé grâce au code inscrit dans leur source. Lorsqu'un surlignage ne correspond à aucun élément ni lien, MarkNeurone affiche le nombre de surlignages concernés. Ils restent disponibles comme surlignages orphelins.

Les données mal formées de l'archive sont écartées à l'import. Un fichier de texte reconnu illisible n'empêche pas l'import des surlignages : le texte sera reconnu de nouveau à l'ouverture du document.

L'export ne contient que les documents présents dans le dossier.

## Suppression d'un document

Lorsque vous supprimez d'un dossier l'élément qui porte un document, ou retirez le document de cet élément :

- le texte reconnu du document est effacé, sauf si un autre élément du dossier porte le même fichier ;
- ses surlignages sont conservés, pour le cas où le document serait ajouté à nouveau. Un message l'indique.

Si le même fichier est ajouté à nouveau, ses surlignages réapparaissent et la reconnaissance du texte est relancée.

L'onglet « Marqueur » liste, dans la section « Documents supprimés », les documents dont des surlignages sont conservés. « Effacer » les supprime définitivement, après confirmation.

ZeroNeurone ne prévient pas les plugins avant la suppression d'un document. MarkNeurone ne peut donc pas demander de confirmation avant : il agit après coup.
