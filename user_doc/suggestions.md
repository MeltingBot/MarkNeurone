# Suggestions

Le bouton « Afficher les suggestions » de la barre d'outils signale dans le document, en surlignage atténué, deux types de passages.

**Les noms déjà présents dans le dossier.** Les libellés des éléments et la valeur de leurs propriétés de surnom (par défaut « Alias ») sont recherchés dans le document, sans tenir compte de la casse ni des accents. Les variantes simples sont reconnues : ordre inversé (« MARTIN Jean » pour « Jean MARTIN ») et initiale du prénom (« J. MARTIN »). Le passage est surligné dans la couleur du tag de l'élément, ce qui fait apparaître les recoupements avec les autres pièces.

**Les identifiants de forme connue.** Les identifiants français sont toujours recherchés. Ceux de la Belgique, de la Suisse et du Luxembourg ne le sont que si le pays est coché dans l'onglet « Reconnaissance » des [réglages](reglages.md) ; ils sont désactivés par défaut.

- téléphones français, belges et suisses, et tous les numéros au format international (+352 pour le Luxembourg) ;
- plaques d'immatriculation françaises, belges et suisses ;
- IBAN de tous les pays ;
- identifiants d'entreprise : SIRET, numéro d'entreprise belge (BCE, y compris sous la forme d'un numéro de TVA BE), IDE suisse (CHE), numéro de TVA et numéro RCS luxembourgeois ;
- numéros d'identification des personnes : NIR, numéro national belge (et numéro BIS), numéro AVS suisse, matricule national luxembourgeois ;
- adresses e-mail et URL ;
- adresses IPv4 et IPv6 ;
- adresses Bitcoin et Ethereum ;
- montants en euros et en francs suisses ;
- dates.

La clé de contrôle est vérifiée pour tous ces numéros, sauf les téléphones, les plaques et le numéro RCS, qui n'en ont pas. Une clé fausse est signalée comme une erreur de lecture probable.

Trois numéros n'ont pas de préfixe qui les distingue d'un nombre quelconque : le numéro national belge, le matricule luxembourgeois et le numéro d'entreprise belge écrit sans « BE ». Ils sont signalés avec une clé fausse seulement lorsqu'ils sont écrits dans leur présentation habituelle, par exemple 85.07.30-033.28 pour un numéro national belge ou 0403.019.261 pour un numéro d'entreprise. Écrits autrement, par exemple en une suite de chiffres, ils ne sont signalés que si leur clé est juste.

Quelques cas restent ambigus. Un numéro belge comme 0456 789 034 peut être un numéro d'entreprise ou un numéro de GSM : il est alors signalé comme téléphone. Les plaques luxembourgeoises (deux lettres et quatre chiffres) et les numéros de téléphone luxembourgeois écrits sans indicatif ne sont pas signalés, car leur forme est trop courante pour être reconnue sans erreur.

## Traiter une suggestion

Un clic sur une suggestion propose les mêmes choix qu'une sélection : élément (E), propriété (P), événement (V) ou localisation (G). Le tag ou le nom de propriété est prérempli selon le type détecté, par exemple le tag « Téléphone » pour un numéro de téléphone. Ces correspondances se modifient dans les [réglages](reglages.md). « Ignorer » (Suppr) écarte la suggestion.

Pour un nom déjà présent dans le dossier, la barre l'indique (« Déjà dans le dossier : ... »). Lorsque plusieurs éléments portent ce nom, elle en donne le nombre. Le rattachement reste à votre choix, comme pour une sélection manuelle.

Chaque suggestion se traite séparément : il n'existe pas de validation groupée. Les objets créés à partir d'une suggestion gardent l'indication de leur origine (identifiant reconnu ou nom du dossier).

Lorsque la clé de contrôle d'un numéro est fausse, le formulaire signale une erreur de lecture probable. Sur un document numérisé, vérifiez le numéro sur l'image.

## Première lecture

Les suggestions sont masquées à la première ouverture de chaque document, pour permettre une première lecture sans orientation. Votre choix est ensuite conservé pour chaque document.
