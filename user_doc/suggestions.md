# Suggestions

Le bouton « Afficher les suggestions » de la barre d'outils signale dans le document, en surlignage atténué, deux types de passages.

**Les noms déjà présents dans le dossier.** Les libellés des éléments et la valeur de leurs propriétés de surnom (par défaut « Alias ») sont recherchés dans le document, sans tenir compte de la casse ni des accents. Les variantes simples sont reconnues : ordre inversé (« MARTIN Jean » pour « Jean MARTIN ») et initiale du prénom (« J. MARTIN »). Le passage est surligné dans la couleur du tag de l'élément, ce qui fait apparaître les recoupements avec les autres pièces.

**Les identifiants de forme connue :**

- téléphones français et internationaux ;
- plaques d'immatriculation françaises ;
- IBAN, SIRET et NIR, avec vérification de la clé de contrôle ;
- adresses e-mail et URL ;
- adresses IPv4 et IPv6 ;
- adresses Bitcoin et Ethereum ;
- montants en euros ;
- dates.

## Traiter une suggestion

Un clic sur une suggestion propose les mêmes choix qu'une sélection : élément (E), propriété (P), événement (V) ou localisation (G). Le tag ou le nom de propriété est prérempli selon le type détecté, par exemple le tag « Téléphone » pour un numéro de téléphone. Ces correspondances se modifient dans les [réglages](reglages.md). « Ignorer » (Suppr) écarte la suggestion.

Pour un nom déjà présent dans le dossier, la barre l'indique (« Déjà dans le dossier : ... »). Lorsque plusieurs éléments portent ce nom, elle en donne le nombre. Le rattachement reste à votre choix, comme pour une sélection manuelle.

Chaque suggestion se traite séparément : il n'existe pas de validation groupée. Les objets créés à partir d'une suggestion gardent l'indication de leur origine (identifiant reconnu ou nom du dossier).

Lorsque la clé de contrôle d'un IBAN, d'un SIRET ou d'un NIR est fausse, le formulaire signale une erreur de lecture probable. Sur un document numérisé, vérifiez le numéro sur l'image.

## Première lecture

Les suggestions sont masquées à la première ouverture de chaque document, pour permettre une première lecture sans orientation. Votre choix est ensuite conservé pour chaque document.
