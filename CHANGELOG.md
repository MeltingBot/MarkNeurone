# Changelog

## 0.1.0 (non publiée)

Première version, en cours de développement.

**Lecture**
- Lecteur affiché dans une fenêtre de ZeroNeurone, qui peut être réduite pour revenir au canvas.
- PDF avec PDF.js : couche texte sélectionnable, zoom, ajustement à la largeur.
- PDF numérisés : OCR en arrière-plan avec Tesseract.js et le modèle français `fast` embarqué, interruptible, mis en cache avec le dossier.
- DOCX, ODT, TXT (UTF-8 ou Windows-1252) et Markdown, affichés comme une feuille de texte.
- Recherche dans tout le document (Ctrl+F), texte reconnu compris.
- Passage encadré à la souris (clic droit ou touche Z), relu à haute résolution.
- Image du passage dans le formulaire lorsque la lecture est douteuse ou que le passage est encadré, pour corriger la lecture ; texte lu par l'OCR conservé à côté du texte validé.
- Correction de la sélection de texte : le passage du pointeur sur un interligne ne sélectionne plus la fin de la page.

**Création d'objets dans le graphe**
- Création d'éléments, de propriétés, d'événements et de localisations à partir d'un passage (touches E, P, V, G ou clic droit).
- Éléments existants de nom proche proposés lors de la création, sans rattachement automatique.
- Dates et heures lues dans la phrase, y compris écrites en toutes lettres.
- Liens entre deux surlignages (Ctrl+clic puis L), libellé proposé à partir du texte qui les sépare.
- Fiche de l'élément sur le modèle du panneau de ZeroNeurone, tags et couleurs de tags compris.
- Localisation avec le sélecteur de carte de ZeroNeurone.

**Suggestions**
- Repérage des noms des éléments du dossier (casse, accents, ordre inversé, initiale) et des motifs : téléphones, plaques, IBAN, SIRET, NIR, e-mails, URL, adresses IP, adresses Bitcoin et Ethereum, montants, dates.
- Traitement une par une (création, propriété, événement, localisation, ou Ignorer), avec tag et clé de propriété proposés selon le type.
- Signalement des clés de contrôle invalides.
- Suggestions masquées à la première ouverture d'un document, choix conservé par document.

**Traçabilité**
- Référence au passage d'origine enregistrée dans la source des éléments, des liens et des événements.
- Prise en compte des fusions et suppressions d'éléments : les annotations sans élément sont conservées et peuvent être rattachées.
- Annotations et texte reconnu inclus dans l'export ZIP de ZeroNeurone et rattachés à l'import.

**Outils**
- Banc d'essai OCR autonome, avec génération de procès-verbaux fictifs dégradés.
