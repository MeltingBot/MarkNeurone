---
title: "Documents numérisés et reconnaissance du texte"
weight: 3
---

# Documents numérisés et reconnaissance du texte

Un PDF numérisé ne contient qu'une image de chaque page. MarkNeurone le détecte à l'ouverture et lance la reconnaissance du texte (OCR) avec Tesseract, sur le poste, sans service en ligne.

## Reconnaissance en arrière-plan

Les pages sont traitées l'une après l'autre, dans l'ordre du document. La barre d'outils indique l'avancement (« OCR : 4 / 12 pages ») et la progression de la page en cours. Dès qu'une page est traitée, son texte devient sélectionnable et les suggestions y apparaissent. Vous pouvez travailler sur les pages déjà traitées pendant que les suivantes le sont.

- « Interrompre » arrête la reconnaissance, « Reprendre » la relance là où elle s'est arrêtée.
- Lorsqu'une page n'a pas pu être traitée, « Réessayer » relance ces pages.
- À la fin, la barre d'outils indique le nombre de pages et la confiance moyenne de la lecture.

Le texte reconnu est enregistré avec le dossier. Il n'est calculé qu'une fois par document, même si le document est ajouté plusieurs fois. Sur un poste de développement, le traitement prend environ 3 secondes par page. Ce temps dépend du poste et de la qualité de l'image.

« Effacer le texte reconnu », dans la barre d'outils, supprime le texte reconnu du document après confirmation. Les surlignages sont conservés.

## Corriger la lecture

Lorsqu'un mot du passage sélectionné a été lu avec une faible confiance, le formulaire affiche l'image du passage au-dessus des champs. Comparez le texte proposé avec l'image et corrigez-le avant de valider. Le texte tel que lu par l'OCR reste enregistré à côté du texte validé.

Pour les numéros comportant une clé de contrôle (IBAN, SIRET, NIR, numéros belges, suisses et luxembourgeois), le formulaire signale une clé invalide comme une erreur de lecture probable. Il signale aussi une adresse Bitcoin dont le préfixe a probablement été mal lu (« bcl » pour « bc1 »).

## Relire une sélection

Sur une page numérisée, « Relire la sélection » dans la barre de sélection relit le passage seul, à haute résolution et sans l'encre de couleur. Le résultat est souvent meilleur que celui de la page entière, en particulier pour un numéro ou un nom propre. Le formulaire affiche alors l'image du passage.

## Encadrer un passage

Pour ce qui ne peut pas être sélectionné, comme un passage manuscrit, une mention dans la marge ou une zone sans texte reconnu, choisissez « Encadrer un passage » dans la barre d'outils du lecteur ou dans le menu du clic droit, ou appuyez sur Z, puis entourez la zone à la souris. La zone est lue à haute résolution. Si rien n'est lu, saisissez le texte dans le formulaire en vous aidant de l'image. La référence pointe vers la zone encadrée de la page.

## Tampons et encre de couleur

Avant la reconnaissance, l'encre de couleur (tampons rouges ou bleus) est retirée de l'image, pour qu'elle ne masque pas le texte imprimé en dessous. Un texte imprimé en couleur est retiré de la même façon. Si un document comporte du texte utile en couleur, désactivez cette option dans l'onglet « Reconnaissance » des [réglages](reglages.md).

## Limites

- L'écriture manuscrite n'est pas lue correctement : encadrez le passage et saisissez le texte.
- Les photocopies très dégradées, les pages fortement inclinées et les fonds tramés réduisent la qualité de la lecture. L'image est redressée et nettoyée avant la reconnaissance, mais ce traitement a ses limites.
- Un document volumineux demande un temps de traitement important dans le navigateur. Laissez le lecteur réduit pendant ce temps : la reconnaissance continue.
