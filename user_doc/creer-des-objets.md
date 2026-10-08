# Créer des objets à partir d'un passage

Sélectionnez un passage à la souris. Une barre apparaît au-dessus de la sélection. Choisissez ce que représente le passage avec une touche, avec la barre ou avec le menu du clic droit :

| Touche | Objet | Effet dans ZeroNeurone |
|---|---|---|
| E | Élément | Crée un élément, ou rattache le passage à un élément existant |
| P | Propriété | Ajoute une propriété à un élément ou à l'un de ses événements |
| V | Événement | Ajoute un événement daté à un ou plusieurs éléments |
| G | Localisation | Renseigne les coordonnées d'un élément |

Un formulaire prérempli s'ouvre dans la fiche, à droite du document. Corrigez ce qui doit l'être et validez avec Entrée ou avec le bouton du formulaire. Échap ferme le formulaire sans rien créer.

Une sélection doit tenir sur une seule page.

## Élément

Le libellé est prérempli avec le texte sélectionné. Une option des réglages propose les noms des nouveaux éléments en majuscules.

Ajoutez un ou plusieurs tags. Les tags proposés sont ceux des réglages, chacun avec un raccourci : Alt+1 pour le premier, Alt+2 pour le deuxième, et ainsi de suite jusqu'à Alt+9. Par défaut : Personne, Entreprise, Lieu, Véhicule, Téléphone, Compte bancaire, Email.

Sous le libellé, « Éléments existants proches » liste les éléments du dossier dont le nom ressemble au passage, avec le type de correspondance (identique, ordre inversé, initiales).

- « Créer » crée un nouvel élément. C'est l'action proposée par défaut, même lorsqu'un élément proche existe.
- « Rattacher », sur un des éléments proposés, relie le passage à cet élément sans en créer un nouveau.

Vérifiez les éléments proposés avant de rattacher : deux personnes peuvent porter le même nom. En cas de doute, créez un nouvel élément. Deux éléments se fusionnent plus tard dans ZeroNeurone, alors qu'un rattachement erroné passe facilement inaperçu. Pour deux éléments de même nom, la liste indique ce qui les distingue : les propriétés dont la valeur diffère et les éléments auxquels chacun est lié.

Dans les listes de choix d'un élément, les éléments déjà surlignés dans le document ouvert apparaissent en premier. La recherche porte sur le libellé, les valeurs des propriétés, la référence des documents et la source. Saisir une référence de procès-verbal, par exemple « 00347/2026 », liste tous les documents qui portent cette référence, puis les éléments surlignés dans ces documents. Seules les références enregistrées sont prises en compte, pas celles seulement proposées à l'ouverture. Au survol d'un élément, la liste affiche les références des documents où il a été surligné.

Le nouvel élément est placé sur le canvas et le passage est surligné dans la couleur de son tag.

## Propriété

L'élément qui recevra la propriété est celui affiché dans la fiche. « Changer » permet d'en choisir un autre, en le recherchant par son libellé ou par la valeur de ses propriétés. La recherche ne tient compte ni de la casse ni des accents.

« Rattacher à » permet de placer la propriété sur l'élément lui-même ou sur l'un de ses événements, choisi par recherche.

Choisissez ou saisissez le nom de la propriété. Les noms déjà utilisés dans le dossier sont proposés pendant la saisie. Le type suit ceux de ZeroNeurone : texte, numérique, date, date et heure, booléen, choix, pays, lien. La valeur est préremplie à partir du passage : la date lue, le pays ou l'option reconnus.

Une nouvelle propriété est enregistrée dans le dossier et associée aux tags de l'élément, comme lorsqu'elle est créée dans ZeroNeurone.

Si l'élément, ou l'événement choisi, a déjà des propriétés, « Existante » permet de rattacher le passage à l'une d'elles plutôt que d'en créer une nouvelle. La valeur de la propriété n'est pas modifiée : le passage devient sa source. Lorsqu'une propriété a la même valeur que le passage, « Existante » est proposé d'emblée avec cette propriété sélectionnée ; le rattachement n'a lieu qu'après « Rattacher ».

## Événement

Le libellé est prérempli avec le passage, la date et l'heure avec celles lues dans le passage ou, à défaut, dans la phrase. Les dates écrites en toutes lettres sont reconnues (« le vingt-quatre mars deux mille vingt-cinq »), y compris avec septante, huitante, octante et nonante. Lorsque l'année manque, celle de la page est reprise et le formulaire le signale : vérifiez-la.

« De » et « À » donnent le début et la fin de l'événement. Lorsque le passage contient deux dates et que la seconde est postérieure à la première, elle remplit « À ». Sans heure, l'événement porte sur la journée entière, comme dans ZeroNeurone. La fin est facultative ; une fin antérieure au début est refusée. Elle se modifie ensuite dans la fiche de l'événement.

Le nom de ville affiché à côté de l'heure de début (par défaut celle du fuseau du poste) indique le fuseau dans lequel les heures sont écrites dans le document. Un clic permet d'en choisir un autre, par recherche : pour un document qui donne les heures de Beyrouth, choisissez « Asia/Beirut » et saisissez les heures telles qu'elles sont écrites. Le fuseau vaut pour le début et la fin, et ZeroNeurone le conserve avec l'événement. Changer de fuseau dans la fiche d'un événement garde les heures affichées et les rapporte au nouveau fuseau.

« Éléments concernés » ne coche que l'élément affiché. Les éléments déjà surlignés dans la même phrase sont listés sans être cochés : cochez ceux auxquels l'événement doit aussi être ajouté. « Ajouter un élément... » permet d'en ajouter d'autres.

La description est vide au départ ; « Reprendre la phrase » y place la phrase du passage. Un lieu peut être indiqué, ainsi que des propriétés propres à l'événement, comme dans la fiche d'événement de ZeroNeurone.

## Localisation

« Choisir sur la carte » ouvre le sélecteur de carte de ZeroNeurone, avec sa recherche d'adresse. Les coordonnées peuvent aussi être saisies en degrés décimaux.

La recherche d'adresse du sélecteur de carte passe par un service en ligne : le texte saisi dans la recherche quitte le poste. Le reste de MarkNeurone n'effectue aucun appel réseau.

## Fiche de l'élément

La partie droite du lecteur présente l'élément sélectionné comme le panneau de ZeroNeurone : libellé et tags, propriétés, événements, localisation, liens, cotation et liste des passages du document qui s'y rapportent. Les modifications faites dans la fiche sont enregistrées dans le graphe.

La cotation suit le modèle d'évaluation choisi pour le dossier dans ZeroNeurone : niveau de confiance, grille Europol ou grille Amirauté / OTAN.

« Voir sur le canvas » centre la vue de ZeroNeurone sur l'élément.

## Retirer un surlignage

Un clic droit sur un passage surligné, puis « Retirer le surlignage », supprime le surlignage et retire sa ligne de la source de l'élément ou du lien. L'objet créé dans le graphe n'est pas supprimé : supprimez-le dans ZeroNeurone si nécessaire.
