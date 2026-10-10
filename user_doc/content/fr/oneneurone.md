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

Le lecteur se ferme et le panneau de OneNeurone s'ouvre sur le résultat. Rien n'est créé dans le graphe avant votre validation dans ce panneau.

## Source des objets créés

Pour chaque élément, lien ou événement accepté dans OneNeurone, MarkNeurone cherche le passage du document dont il provient :

- pour un élément, le nom tel qu'il est écrit dans le document ;
- pour un lien, la phrase qui contient les noms des deux éléments ;
- pour un événement, la phrase qui contient le nom de l'élément et la date.

Lorsque le passage est trouvé, il est surligné dans le document et la source de l'objet pointe vers lui, comme pour un objet créé à la main. Sinon, la source désigne le document entier. C'est le cas notamment lorsque le modèle a reformulé un nom, ou pour une page numérisée dont le texte n'a pas encore été reconnu.

Le surlignage apparaît lorsque la page est affichée dans le lecteur pour la première fois.

## Passages à vérifier

Les objets acceptés un par un dans OneNeurone donnent des passages ordinaires. Ceux acceptés tous ensemble donnent des passages à vérifier : ils sont encadrés d'un trait pointillé dans le document et portent la mention « à vérifier » dans la fiche et dans l'onglet Marqueur.

Dans la liste des passages de la fiche, chaque passage à vérifier se traite individuellement :

- « Valider le passage » le rend ordinaire ;
- « Rejeter le passage » le supprime et retire son lien de la source de l'objet. L'objet lui-même reste dans le graphe ; supprimez-le dans ZeroNeurone si l'extraction était fausse.

Les passages repérés par OneNeurone gardent la mention « OneNeurone » après validation, pour distinguer ce qui a été lu par une personne de ce qui a été proposé par le modèle.
