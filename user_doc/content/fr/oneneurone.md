---
title: "Extraction avec OneNeurone"
weight: 11
---

# Extraction avec OneNeurone

Lorsque le plugin OneNeurone est installé, activé et que sa licence comprend l'extraction, MarkNeurone peut lui confier un document. OneNeurone repère les personnes, organisations, événements et relations, et propose de les créer dans le graphe. MarkNeurone n'embarque aucun modèle de langue : l'extraction est entièrement faite par OneNeurone.

Cette fonction nécessite ZeroNeurone 2.64 ou une version ultérieure. Sans OneNeurone, ou sans sa licence d'extraction, les boutons décrits ici n'apparaissent pas.

## Lancer une extraction

- **Document entier** : bouton « Extraire avec OneNeurone » dans la barre d'outils du lecteur.
- **Partie du document** : sélectionnez un passage, puis choisissez « Extraire la sélection avec OneNeurone » dans la barre qui apparaît à côté de la sélection.

Le lecteur se réduit et le panneau de OneNeurone s'ouvre sur le document. Lancez l'extraction depuis ce panneau, puis acceptez, fusionnez ou rejetez chaque entité proposée. Rien n'est créé dans le graphe avant votre validation. Les passages des objets que vous acceptez apparaissent dans le lecteur lorsque vous le rouvrez.

Si le panneau de OneNeurone contient encore des entités non traitées d'une extraction précédente, une confirmation est demandée : « Remplacer » les retire du panneau pour passer au nouveau document, « Annuler » garde l'extraction en cours.

## Source des objets créés

Pour que la source d'un objet désigne son passage, l'option « Media en source » doit être cochée dans le panneau d'extraction de OneNeurone. Sans elle, OneNeurone n'écrit aucune source et MarkNeurone ne surligne rien.

Pour chaque élément, lien ou événement accepté dans OneNeurone, MarkNeurone cherche le passage du document dont il provient :

- pour un élément, le nom tel qu'il est écrit dans le document ;
- pour un lien, les mots qui vont du nom d'un élément à celui de l'autre, dans une même phrase ;
- pour un événement, les mots qui vont du nom de l'élément à la date, dans une même phrase, ou à défaut la seule phrase du document qui porte cette date.

Lorsque le passage est trouvé, il est surligné dans le document et la source de l'objet pointe vers lui, comme pour un objet créé à la main. Sinon, la source désigne le document entier. C'est le cas notamment :

- lorsque le modèle a reformulé un nom ;
- pour une page numérisée dont le texte n'a pas encore été reconnu ;
- pour un lien ou un événement dont les mots s'étendent sur plus de trois lignes ou sur une longue portion de texte, en particulier dans un tableau : les cellules n'y forment pas de phrases, et un passage qui en traverserait plusieurs serait trompeur.

Le surlignage apparaît lorsque la page est affichée dans le lecteur pour la première fois.

Lorsqu'une entité est fusionnée avec un élément existant dans OneNeurone, le passage du nouveau document s'ajoute à la source de l'élément. Les passages et documents déjà cités sont conservés : seul le lien vers le document entier en cours d'extraction est remplacé par celui de son passage.

## Passages à vérifier

Les objets acceptés un par un dans OneNeurone donnent des passages ordinaires. Ceux acceptés tous ensemble donnent des passages à vérifier : ils gardent la couleur de leur tag, sont encadrés d'un trait pointillé dans le document et portent la mention « à vérifier » dans la liste des éléments du document, dans la fiche et dans l'onglet Marqueur. Au survol, une info-bulle indique ce que représente le surlignage, par exemple « Claire Morvan · Personne · OneNeurone · à vérifier ».

Chaque passage à vérifier se traite individuellement, par un clic droit sur son surlignage ou dans la liste des passages de la fiche (celle de l'élément, ou celle du lien pour un lien) :

- « Valider le passage » le rend ordinaire ;
- « Rejeter le passage » le supprime et retire son lien de la source de l'objet. L'objet lui-même reste dans le graphe ; supprimez-le dans ZeroNeurone si l'extraction était fausse.

Les passages repérés par OneNeurone gardent la mention « OneNeurone » après validation, pour distinguer ce qui a été lu par une personne de ce qui a été proposé par le modèle.

## Objets supprimés et dossier partagé

Si un objet créé par OneNeurone est ensuite supprimé dans ZeroNeurone, son passage devient un surlignage orphelin. La section « Surlignages orphelins » de l'onglet Marqueur permet de les retirer tous en une fois (voir [Retrouver les passages d'origine](retrouver-les-passages.md)).

Dans un dossier partagé, les passages et leur statut (à vérifier ou validé) sont transmis aux autres membres comme tous les surlignages. Pour que les liens de source s'ouvrent chez eux, ils doivent aussi avoir installé MarkNeurone.
