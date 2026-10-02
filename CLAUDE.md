# CLAUDE.md : plugin MarkNeurone pour ZeroNeurone

## Contexte

Ce dépôt contient le plugin MarkNeurone de ZeroNeurone (ZN). Le plugin permet de lire un PDF dans ZN, de surligner des passages et de les transformer en objets du graphe (éléments, propriétés, événements, liens), avec une ancre vers la source. Il reprend la pratique de prétraitement des procès-verbaux par surlignage utilisée par les analystes criminels de la Gendarmerie.

La spécification fonctionnelle est dans `note-plugin-lecture-pdf-zn.md`. L'analyse des risques est dans `analyse-contradictoire-markneurone.md`. Lis ces deux fichiers avant toute tâche de conception et reporte-toi à eux en cas de doute sur le périmètre.

## Principes non négociables

ZN est local-first. Aucune donnée de document, aucun texte reconnu et aucune annotation ne doit quitter le poste. N'ajoute aucun appel réseau, aucune télémétrie et aucun service d'OCR distant. Les modèles Tesseract sont embarqués avec le plugin et non téléchargés à l'exécution.

ZN n'impose pas d'ontologie. Le plugin propose des types et des tags par défaut, mais l'utilisateur doit toujours pouvoir les modifier. Ne code aucun type d'élément en dur en dehors des profils de configuration.

Rien n'entre dans le graphe sans validation explicite de l'utilisateur. Les pré-surlignages restent au statut `suggested` jusqu'à un geste de validation. N'implémente aucune validation en masse.

Le rattachement d'un passage à un élément existant n'est jamais automatique. Lorsque la correspondance n'est pas exacte, l'action par défaut est la création d'un nouvel élément, avec les candidats proposés à côté. Une fusion abusive d'homonymes est l'erreur la plus grave que le plugin puisse commettre.

Chaque objet créé conserve son origine (`manual`, `pattern`, `dictionary`, `profile`, `oneneurone`) même après validation, et son ancre vers la source.

Dans ZN, les entités du graphe s'appellent des « éléments ». N'utilise pas le terme « neurone » ni « entité » pour désigner ces objets dans l'interface. « Neurone » n'apparaît que dans le nom des produits de la gamme, dont MarkNeurone.

## Avant de coder

Le détail de l'API de plugins de ZN n'est pas documenté dans ce dépôt. Avant d'écrire du code fonctionnel, inspecte le code source de ZN pour établir ce que l'API permet : ouvrir un panneau ou un onglet, lire les éléments et leurs alias, créer éléments, propriétés et liens, écouter la sélection sur le canvas, stocker des données propres au dossier, réagir à une fusion ou une suppression d'élément. Rédige le résultat dans `docs/api-zn.md` et signale chaque capacité manquante au lieu de la contourner par un accès direct aux structures internes.

Aligne-toi sur la pile technique, les conventions de nommage, la gestion d'état et l'outillage de test de ZN tels que tu les trouves dans son code.

## Ordre de travail

1. Banc d'essai OCR autonome dans `bench/ocr/` : script qui passe un dossier de PDF image dans Tesseract (modèle `fra`), avec et sans prétraitement, et produit un rapport du temps par page, de la confiance moyenne et du taux d'erreur sur les identifiants (téléphones, plaques, IBAN, SIRET) par rapport à une vérité terrain fournie en JSON. Ce banc doit fonctionner avant toute interface.
2. Vérification de l'API de plugins de ZN (section précédente).
3. MVP tel que défini dans la section 9 de la note de cadrage, dans l'ordre : affichage PDF, OCR par zone, couche texte issue de l'OCR complète, gestes de qualification, mode lien deux clics, ancres, pré-surlignage, export.

Ne commence pas la V2 sans validation explicite.

## Choix techniques retenus

Rendu PDF avec PDF.js. Détection de l'absence de couche texte à l'ouverture et bascule en mode OCR.

OCR avec Tesseract.js et le modèle français, dans un Web Worker. Deux modes : reconnaissance à la demande sur une zone encadrée, et reconnaissance complète en arrière-plan page par page qui construit une couche texte invisible à partir des boîtes de mots. Résultat mis en cache avec le dossier, indexé par l'empreinte SHA-256 du PDF.

Prétraitement d'image (redressement, binarisation, débruitage) d'abord en canvas simple. N'ajoute OpenCV.js que si le banc d'essai montre un gain mesurable.

Découpage en phrases avec `Intl.Segmenter`, sans dépendance supplémentaire.

Les identifiants à clé de contrôle (IBAN, SIREN, SIRET, NIR) sont vérifiés après reconnaissance, et une clé invalide est signalée comme erreur de lecture probable.

Modèle de données : interface `Annotation` de la section 7 de la note. Les annotations sont exportées dans `annotations.json` à côté de `dossier.json` dans l'archive ZIP, comme champ optionnel rétrocompatible avec la spec d'export v1.1.0.

## Données de test

N'utilise jamais de pièces réelles dans le dépôt. Les jeux de test sont fictifs ou anonymisés, et les PV de test sont générés à partir de textes fictifs puis rendus en image avec des dégradations simulées (biais, bruit, tampons, photocopie). Les fichiers fournis par l'utilisateur pour le banc d'essai restent dans un dossier ignoré par git.

## Rédaction

Les textes d'interface, la documentation et les messages destinés à l'utilisateur sont en français. Pas d'emoji ni de tiret long. Le code, les identifiants et les messages de commit sont en anglais.
