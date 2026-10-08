# Changelog

## 1.4.0 (2026-10-08)

- Événement : date de fin (« De » et « À »), à la création comme dans la fiche d'un événement existant. Lorsque le passage contient deux dates, la seconde, si elle est postérieure, remplit la fin.
- Événement : fuseau horaire des heures, comme dans ZeroNeurone 2.61, à la création comme dans la fiche. Les heures se saisissent telles qu'elles sont écrites dans le document ; le fuseau vaut pour le début et la fin et reste enregistré avec l'événement.
- Événement : une date sans heure est enregistrée à 00:00, que ZeroNeurone lit comme la journée entière, au lieu de midi.
- Dates : une date en chiffres est reconnue même lorsque la couche texte du PDF place des espaces autour des barres (« 07 / 07 / 2004 ») ou utilise des barres, tirets, chiffres ou caractères invisibles Unicode.
- Choix d'un élément : sans élément actif, la liste occupe la hauteur du panneau et montre plus de résultats. Les éléments de même nom indiquent combien d'autres le portent et affichent ce qui les distingue : propriétés dont la valeur diffère et éléments auxquels ils sont liés. Les candidats au rattachement font de même.
- Liens : utiliser la barre de défilement du document ne vide plus la sélection, ce qui empêchait de lier deux passages éloignés de plusieurs pages.
- Lecteur : Ctrl+molette, ou le pincement sur un pavé tactile, agrandit ou réduit le document en gardant en place le point sous le pointeur.
- Lecteur : le document se déplace en faisant glisser la marge grise autour des pages ou avec le bouton du milieu. Le bouton « Main » permet de le faire glisser n'importe où, sans sélectionner de texte.
- Lecteur : masquage du texte (bouton œil ou touche M) pour la confidentialité, sans rien enregistrer ; les pages deviennent des aplats gris non sélectionnables.
- Lecteur : la fiche se réduit en un bandeau, comme le panneau de ZeroNeurone, et se rouvre d'elle-même lorsqu'un formulaire s'affiche.
- Lecteur : ouverture dans une fenêtre séparée, pour travailler sur deux écrans ; zoom et position de lecture conservés, ZeroNeurone reste utilisable dans sa fenêtre.
- Lecteur : la ligne en haut de l'écran reste en place quand l'échelle change (loupe, ajustement à la largeur, fenêtre redimensionnée).
- Firefox : un mot sélectionné par double-clic garde toute sa sélection (la première lettre, voire tout le mot, se désélectionnait à l'apparition de la barre de gestes).
- Propriété date et heure : la fiche affiche et permet de modifier l'heure, qui n'apparaissait pas.
- Propriété date et heure : fuseau horaire de l'heure, comme pour les événements, à la création et dans la fiche (ZeroNeurone 2.62.4).
- Propriété, événement ou localisation sans élément choisi : sélectionner un autre passage abandonne le premier, dont le surlignage restait affiché.
- Choix d'un élément : les éléments du document ouvert viennent en premier. La recherche par référence (« 00347/2026 ») liste tous les documents qui portent cette référence, puis les éléments surlignés dans ces documents ; le survol affiche ces références.
- Événement : seul l'élément affiché est coché dans « Éléments concernés ». Les éléments surlignés dans la même phrase restent proposés, non cochés.
- Événement : la description n'est plus préremplie avec la phrase, qui dans un procès-verbal de forme tabulaire peut couvrir tout un bloc de texte. « Reprendre la phrase » l'insère sur demande.

## 1.3.1 (2026-10-07)

- Retirer le surlignage d'un événement, ou d'une propriété d'événement, retire aussi son lien de la source de l'événement, et plus seulement de celle de l'élément.

## 1.3.0 (2026-10-07)

- Propriété : un passage peut être rattaché à une propriété que l'élément, ou l'un de ses événements, a déjà (« Existante »), sans en modifier la valeur. Une propriété de même valeur que le passage est proposée d'emblée ; le rattachement attend la validation.

## 1.2.0 (2026-10-07)

- La source des objets créés est un lien : `[PV n° 00347/2026 p.3](mn:1a2b3c4d)`. Dans ZeroNeurone 2.62 et suivantes, le champ Source affiche la référence et la page, et un clic ouvre le lecteur sur le passage. Après une fusion d'éléments, chaque passage reste accessible depuis la source de l'élément résultant. Un lien vers un passage dont le surlignage ou le document a disparu est grisé.
- Une source par ligne : chaque passage ajouté à un élément, un lien ou un événement occupe sa propre ligne du champ Source, comme les sources réunies par une fusion dans ZeroNeurone. Retirer un surlignage ne retire que sa ligne, y compris dans une source écrite sur plusieurs lignes ; les sources séparées par « ; » restent lues.
- L'ancienne forme de source (`PV p.3 [mn:1a2b3c4d]`) n'est plus reconnue.
- Avant ZeroNeurone 2.62, le lien s'affiche en texte brut et le retour au passage passe par l'onglet « Marqueur ».

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
