# Ouvrir et lire un document

## Formats pris en charge

| Format | Affichage |
|---|---|
| PDF avec couche texte | Pages d'origine, texte sélectionnable |
| PDF numérisé (sans couche texte) | Pages d'origine, texte reconnu en arrière-plan : voir [Documents numérisés](documents-numerises.md) |
| DOCX, ODT | Texte sur une page continue, avec titres, paragraphes, listes et tableaux |
| TXT (UTF-8 ou Windows-1252), Markdown | Texte sur une page continue |

Pour les DOCX, ODT, TXT et Markdown, la mise en page d'origine n'est pas reproduite. Ces documents n'ont pas de numéro de page : la référence au passage ne mentionne alors que le document.

## Ouvrir un document

1. Déposez le fichier sur le canvas de ZeroNeurone. Un élément portant le document est créé.
2. Faites un clic droit sur cet élément et choisissez « Lire dans MarkNeurone ».

Le lecteur s'ouvre dans une grande fenêtre. Il comporte le document à gauche et, à droite, la fiche de l'élément sélectionné.

## Naviguer dans le document

- Les boutons de la barre d'outils permettent d'agrandir, de réduire le zoom et d'ajuster la page à la largeur de la fenêtre. Ctrl+molette fait de même autour du pointeur.
- Pour déplacer le document à la souris, faites glisser la marge grise autour des pages, ou maintenez le bouton du milieu enfoncé. Le bouton « Main » de la barre d'outils permet de déplacer le document en le faisant glisser n'importe où ; un clic sur un passage surligné ouvre toujours sa fiche. Cliquez de nouveau sur ce bouton pour revenir à la sélection de texte.
- Le bouton en forme d'œil, ou la touche M, masque le texte du document : les pages s'affichent en aplat gris, sans texte lisible ni sélectionnable, par exemple pendant un partage d'écran. Les surlignages et la fiche restent visibles. Le masquage n'est pas enregistré et disparaît à la fermeture du lecteur.
- Le bouton à droite de la barre d'outils réduit la fiche en un bandeau étroit, pour laisser toute la largeur au document. Le bouton du bandeau la rouvre ; elle se rouvre aussi d'elle-même lorsqu'un formulaire doit s'afficher.
- Ctrl+F ouvre la recherche dans tout le document, texte reconnu compris. Entrée et Maj+Entrée passent au résultat suivant ou précédent.

## Réduire et reprendre la lecture

Échap, ou le bouton « Réduire », ferme le lecteur et laisse une pastille sur l'écran de ZeroNeurone. Elle permet de revenir au canvas, puis de reprendre la lecture à la même position. Le bouton « Fermer » ferme le lecteur.

## Référence du document

En haut du lecteur, un champ permet de saisir la référence du document, telle que vous la citez : « PV n° 00347/2026, pièce n° 2 », « Rapport annuel 2024 », « Le Monde, 12 mars 2026 ». Cette référence remplace le nom du fichier dans la source des objets créés, dans le titre du lecteur et dans l'onglet « Marqueur ».

Pour un procès-verbal, MarkNeurone propose la référence qu'il lit en tête de la première page, lorsqu'il en trouve une, y compris un numéro de PV belge (« BR.12.L1.012345/2024 »). Elle n'est utilisée qu'après un clic sur « Utiliser cette référence ».

Si vous modifiez la référence après avoir créé des objets, MarkNeurone propose de mettre à jour leur source. Le texte que vous avez vous-même ajouté dans la source n'est pas modifié. « Laisser » conserve les sources telles quelles.
