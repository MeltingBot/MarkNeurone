# Changelog

## 0.1.0 (non publiée)

Première version, en cours de développement.

**Lecture**
- Lecteur dans une grande modale de ZeroNeurone, réductible en pastille.
- PDF avec PDF.js : couche texte sélectionnable, zoom, ajustement à la largeur.
- PDF numérisés : OCR en arrière-plan avec Tesseract.js et le modèle français `fast` embarqué, interruptible, mis en cache avec le dossier.
- DOCX, ODT, TXT (UTF-8 ou Windows-1252) et Markdown, affichés comme une feuille de texte.
- Recherche dans tout le document (Ctrl+F), texte reconnu compris.
- Sélection protégée : passer sur un interligne ne prolonge plus la sélection jusqu'à la fin de la page.

**Qualification**
- Gestes élément, propriété, événement et localisation (E, P, V, G, ou clic droit).
- Éléments existants proches proposés à la création, jamais rattachés automatiquement.
- Dates et heures lues dans la phrase, y compris écrites en toutes lettres.
- Liens entre deux surlignages (Ctrl+clic puis L), libellé proposé à partir du texte qui les sépare.
- Fiche de l'élément sur le modèle du panneau de ZeroNeurone, tags et couleurs de tags compris.
- Localisation avec le sélecteur de carte de ZeroNeurone.

**Ancres et intégrité**
- Jeton d'ancre dans la source des éléments, des liens et des événements.
- Suivi des fusions et suppressions d'éléments, annotations orphelines rattachables.
- Annotations et texte reconnu inclus dans l'export ZIP de ZeroNeurone et rattachés à l'import.

**Outils**
- Banc d'essai OCR autonome sur des PV fictifs dégradés.
