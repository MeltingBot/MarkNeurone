---
title: "Retrouver les passages d'origine"
weight: 7
---

# Retrouver les passages d'origine

## Source des objets

Chaque élément, lien et événement créé avec MarkNeurone reçoit dans son champ « Source » un lien qui désigne le document et la page, par exemple :

```
[Rapport annuel 2024 p.12](mn:1a2b3c4d)
[PV n° 00347/2026, pièce n° 2 p.3](mn:5e6f7a8b)
```

Le document est désigné par sa référence si vous en avez saisi une, sinon par le nom du fichier. Le code qui suit `mn:` permet à MarkNeurone de retrouver le passage après une fusion d'éléments ou l'import d'une archive. Ne le supprimez pas. Le reste du champ peut être complété librement.

Dans ZeroNeurone 2.62 et suivantes, le champ Source n'affiche que « Rapport annuel 2024 p.12 », en lien : un clic ouvre le lecteur sur le passage. Un clic à côté du lien affiche le texte complet pour le modifier. Un lien grisé désigne un passage dont le surlignage ou le document n'est plus dans le dossier.

Un même élément peut cumuler plusieurs liens de source, issus de plusieurs documents, un par ligne. Lorsque deux éléments sont fusionnés, l'élément résultant conserve les liens des deux : chaque passage reste accessible depuis sa source.

## Depuis le lecteur

Lorsque rien n'est sélectionné, la fiche liste les éléments surlignés dans le document, dans l'ordre du texte, avec une recherche. Un clic ouvre l'élément et va à son premier passage.

Dans la fiche d'un élément, « Passages du document » liste ses passages. « Voir le passage » fait défiler le document jusqu'au passage choisi.

Le clic droit sur un passage surligné propose « Passages identiques », qui recherche dans le document les autres occurrences du même texte.

## Depuis le canvas : l'onglet « Marqueur »

Dans le panneau de droite de ZeroNeurone, l'onglet « Marqueur » liste les passages de l'élément sélectionné sur le canvas, ou ceux du lien sélectionné, dans tous les documents du dossier. Chaque document occupe une section repliable. Les passages identiques n'occupent qu'une ligne, suivie de leurs numéros de page. Un clic ouvre le document sur le passage.

C'est le moyen le plus direct de voir dans quels documents un élément apparaît.

## Fusion et suppression d'éléments

- Lorsque deux éléments sont fusionnés dans ZeroNeurone, leurs passages suivent l'élément résultant.
- Lorsqu'un élément ou un lien est supprimé, ses surlignages sont conservés. Ils apparaissent comme surlignages orphelins dans le lecteur. Le clic droit sur un tel passage, puis « Rattacher à un élément... », permet de le rattacher à un autre élément. Un événement ou un lien disparu est alors recréé sur l'élément choisi. Une propriété disparue peut l'être aussi.
