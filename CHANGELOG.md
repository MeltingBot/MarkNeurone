# Changelog

## 1.1.1 (2026-10-05)

- Identifiants belges, suisses et luxembourgeois activés pays par pays dans l'onglet « Reconnaissance » des réglages, désactivés par défaut. Les identifiants français restent toujours recherchés.
- Le tableau des tags et propriétés par type de suggestion ne montre que les types des pays cochés.
- Une plaque suisse n'est plus reconnue dans un numéro suivi d'autres chiffres (« LU 150 274 42 », numéro de TVA luxembourgeois).
- Documentation : MarkNeurone est présenté pour tout document rédigé, le procès-verbal étant un cas d'usage parmi d'autres. Le champ « Référence de la pièce » devient « Référence du document ».

## 1.1.0 (2026-10-05)

**Suggestions : Belgique, Suisse, Luxembourg**
- Belgique : numéro national et numéro BIS, numéro d'entreprise BCE (y compris en numéro de TVA BE et sous l'ancienne forme à 9 chiffres), téléphones fixes et GSM, plaques (1-ABC-234 et formes antérieures).
- Suisse : numéro AVS, IDE (CHE), téléphones, plaques (canton et numéro), montants en francs suisses.
- Luxembourg : matricule national, numéro de TVA, numéro RCS. Les téléphones luxembourgeois sont reconnus au format international.
- Clés de contrôle vérifiées pour ces numéros. Un numéro écrit sans sa présentation habituelle n'est signalé que si sa clé est juste.
- Septante, huitante, octante et nonante dans les dates écrites en toutes lettres.
- Numéro de PV belge proposé comme référence de la pièce.
- Les types de suggestion ajoutés par une nouvelle version reçoivent leur tag et leur propriété par défaut, sans modifier les réglages déjà enregistrés.

## 1.0.0 (2026-10-05)

Première version. Documentation utilisateur dans `user_doc/`.

**Lecture**
- Lecteur affiché dans une fenêtre de ZeroNeurone, qui peut être réduite pour revenir au canvas.
- PDF avec PDF.js : couche texte sélectionnable, zoom, ajustement à la largeur.
- PDF numérisés : OCR en arrière-plan avec Tesseract.js et le modèle français `fast` embarqué, interruptible, mis en cache avec le dossier.
- DOCX, ODT, TXT (UTF-8 ou Windows-1252) et Markdown, affichés comme une feuille de texte.
- Recherche dans tout le document (Ctrl+F), texte reconnu compris.
- Relecture d'une sélection à haute résolution, ligne par ligne.
- Passage encadré à la souris (clic droit ou touche Z), relu à haute résolution.
- Encre de couleur (tampons) retirée de l'image avant la reconnaissance.
- Image du passage dans le formulaire lorsque la lecture est douteuse ou que le passage est encadré, pour corriger la lecture ; texte lu par l'OCR conservé à côté du texte validé.
- Correction de la sélection de texte : le passage du pointeur sur un interligne ne sélectionne plus la fin de la page.

**Création d'objets dans le graphe**
- Création d'éléments, de propriétés, d'événements et de localisations à partir d'un passage (touches E, P, V, G ou clic droit).
- Éléments existants de nom proche proposés lors de la création, sans rattachement automatique.
- Propriétés des huit types de ZeroNeurone (texte, numérique, date, date et heure, booléen, choix, pays, lien), avec la saisie propre à chacun ; une nouvelle propriété est enregistrée dans le dossier et associée aux tags de l'élément, comme dans ZeroNeurone. Le pays ou l'option lus dans le passage sont proposés.
- Recherche de l'élément concerné pour une propriété, un événement, une localisation, les extrémités d'un lien ou le rattachement d'un passage orphelin : libellé et valeurs des propriétés, sans tenir compte de la casse ni des accents. L'élément affiché peut être changé pendant la saisie.
- Dates et heures lues dans la phrase, y compris écrites en toutes lettres.
- Événements : description détaillée modifiable à la création (préremplie avec la phrase du passage) et dans la fiche ; propriétés propres à l'événement, comme dans ZeroNeurone. Une propriété lue dans un passage peut être rattachée à l'élément ou à l'un de ses événements.
- Liens entre deux surlignages (Ctrl+clic puis L), avec un libellé saisi par l'utilisateur ; rien n'est déduit du texte qui sépare les deux passages.
- Mode verbe, en option (réglages, onglet « Liens ») : surligner les mots d'une relation puis L propose comme extrémités les éléments surlignés les plus proches avant et après dans la phrase ; les extrémités se corrigent dans le formulaire.
- Liens possibles signalés dans la marge, en option et désactivés par défaut : deux éléments surlignés dans la même phrase ou le même paragraphe et pas encore liés. Un clic ouvre le formulaire de lien prérempli ; « Ne plus proposer » écarte le couple pour ce document.
- Fiche de l'élément sur le modèle du panneau de ZeroNeurone, tags et couleurs de tags compris.
- Sans sélection, la fiche liste les éléments surlignés dans le document, dans l'ordre du texte, avec une recherche ; un clic ouvre l'élément et va à son premier passage.
- Cotation de l'élément ou du lien dans la fiche, selon le modèle d'évaluation du dossier : niveau de confiance, grille Europol ou grille Amirauté / OTAN.
- Localisation avec le sélecteur de carte de ZeroNeurone.

**Suggestions**
- Repérage des noms des éléments du dossier (casse, accents, ordre inversé, initiale) et des motifs : téléphones, plaques, IBAN, SIRET, NIR, e-mails, URL, adresses IP, adresses Bitcoin et Ethereum, montants, dates.
- Traitement une par une (création, propriété, événement, localisation, ou Ignorer), avec tag et clé de propriété proposés selon le type.
- Signalement des clés de contrôle invalides.
- Suggestions masquées à la première ouverture d'un document, choix conservé par document.

**Onglet « Marqueur »**
- Passages de l'élément ou du lien sélectionné, dans tous les documents du dossier, dans le panneau de droite de ZeroNeurone ; un clic ouvre le document sur le passage.

**Réglages**
- Fenêtre de réglages depuis la carte du plugin : tags proposés, ordre et couleur, propriétés lues comme alias, tag et clé proposés par type de suggestion, retrait de l'encre de couleur avant l'OCR, nom des nouveaux éléments proposé en majuscules. Réglages communs à tous les dossiers.

**Traçabilité**
- Référence au passage d'origine enregistrée dans la source des éléments, des liens et des événements.
- Référence de la pièce (par exemple « PV n° 00347/2026, pièce n° 2 ») saisie dans le lecteur et reprise dans la source à la place du nom du fichier. Le plugin propose celle qu'il lit en tête de première page. Après un changement, il propose de mettre à jour les sources déjà écrites, sans toucher à ce que l'utilisateur y a saisi. La référence nomme le document dans le titre du lecteur et dans l'onglet « Marqueur ». Elle est incluse dans l'export.
- Prise en compte des fusions et suppressions d'éléments : les annotations sans élément sont conservées et peuvent être rattachées.
- Annotations et texte reconnu inclus dans l'export ZIP de ZeroNeurone et rattachés à l'import.
- Contrôle des annotations et du texte reconnu à l'import d'une archive : les données mal formées sont écartées, et un fichier de texte reconnu illisible n'empêche plus l'import des annotations.
- Suppression d'un document : son texte reconnu est effacé, ses surlignages sont conservés et un message l'indique. L'onglet « Marqueur » liste les documents supprimés dont des surlignages sont conservés et permet de les effacer. L'export n'inclut que les documents présents dans le dossier.
- Effacement du texte reconnu d'un document depuis le lecteur, avec confirmation.

**Distribution**
- Licence de MarkNeurone et des composants inclus placée en tête du fichier `markneurone.js`, la minification retirant les mentions de licence des bibliothèques.

**Outils**
- Banc d'essai OCR autonome, avec génération de procès-verbaux fictifs dégradés.
