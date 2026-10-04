# Changelog

## 0.1.0 (non publiée)

Première version, en cours de développement.

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
- Dates et heures lues dans la phrase, y compris écrites en toutes lettres.
- Liens entre deux surlignages (Ctrl+clic puis L), libellé proposé à partir du texte qui les sépare.
- Fiche de l'élément sur le modèle du panneau de ZeroNeurone, tags et couleurs de tags compris.
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
- Référence de la pièce (par exemple « PV n° 00347/2026, pièce n° 2 ») saisie dans le lecteur et reprise dans la source à la place du nom du fichier. Le plugin propose celle qu'il lit en tête de première page. Après un changement, il propose de mettre à jour les sources déjà écrites, sans toucher à ce que l'utilisateur y a saisi. La référence est incluse dans l'export.
- Prise en compte des fusions et suppressions d'éléments : les annotations sans élément sont conservées et peuvent être rattachées.
- Annotations et texte reconnu inclus dans l'export ZIP de ZeroNeurone et rattachés à l'import.
- Contrôle des annotations et du texte reconnu à l'import d'une archive : les données mal formées sont écartées, et un fichier de texte reconnu illisible n'empêche plus l'import des annotations.

**Outils**
- Banc d'essai OCR autonome, avec génération de procès-verbaux fictifs dégradés.
