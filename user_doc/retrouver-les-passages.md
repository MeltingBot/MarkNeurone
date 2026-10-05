# Retrouver les passages d'origine

## Source des objets

Chaque élément, lien et événement créé avec MarkNeurone reçoit dans son champ « Source » une ligne qui désigne le document et la page, par exemple :

```
PV n° 00347/2026, pièce n° 2 p.3 [mn:1a2b3c4d]
```

Le document est désigné par sa référence de pièce si vous en avez saisi une, sinon par le nom du fichier. Le code entre crochets permet à MarkNeurone de retrouver le passage après une fusion d'éléments ou l'import d'une archive. Ne le supprimez pas. Le reste du champ peut être complété librement.

Un même élément peut cumuler plusieurs lignes de source, issues de plusieurs documents.

## Depuis le lecteur

Lorsque rien n'est sélectionné, la fiche liste les éléments surlignés dans le document, dans l'ordre du texte, avec une recherche. Un clic ouvre l'élément et va à son premier passage.

Dans la fiche d'un élément, « Passages du document » liste ses passages. « Voir le passage » fait défiler le document jusqu'au passage choisi.

Le clic droit sur un passage surligné propose « Passages identiques », qui recherche dans le document les autres occurrences du même texte.

## Depuis le canvas : l'onglet « Marqueur »

Dans le panneau de droite de ZeroNeurone, l'onglet « Marqueur » liste les passages de l'élément sélectionné sur le canvas, ou ceux du lien sélectionné, dans tous les documents du dossier. Chaque document occupe une section repliable. Les passages identiques n'occupent qu'une ligne, suivie de leurs numéros de page. Un clic ouvre le document sur le passage.

C'est le moyen le plus direct de voir dans quelles pièces un élément apparaît.

## Fusion et suppression d'éléments

- Lorsque deux éléments sont fusionnés dans ZeroNeurone, leurs passages suivent l'élément résultant.
- Lorsqu'un élément ou un lien est supprimé, ses surlignages sont conservés. Ils apparaissent comme surlignages orphelins dans le lecteur. Le clic droit sur un tel passage, puis « Rattacher à un élément... », permet de le rattacher à un autre élément. Un événement ou un lien disparu est alors recréé sur l'élément choisi. Une propriété disparue peut l'être aussi.
