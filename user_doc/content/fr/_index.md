---
title: "Documentation MarkNeurone"
type: docs
---

# Documentation de MarkNeurone

MarkNeurone est un plugin de ZeroNeurone. Il affiche un document dans ZeroNeurone et permet de créer, à partir d'un passage surligné, des éléments, des propriétés, des événements, des localisations et des liens dans le graphe. Chaque objet créé garde une référence vers le passage d'origine, ce qui permet de revenir au texte à tout moment.

MarkNeurone s'utilise avec tout document rédigé : rapport, article de presse, statuts de société, décision de justice, courriel, procès-verbal d'audition. Les PDF numérisés, fréquents pour les procès-verbaux, sont pris en charge par la reconnaissance du texte.

Cette documentation s'adresse aux utilisateurs du plugin. Les informations destinées aux développeurs se trouvent dans le [README du dépôt](https://github.com/MeltingBot/MarkNeurone#readme).

## Sommaire

1. [Installation](installation.md)
2. [Ouvrir et lire un document](lecture.md)
3. [Documents numérisés et reconnaissance du texte](documents-numerises.md)
4. [Créer des objets à partir d'un passage](creer-des-objets.md)
5. [Créer des liens](liens.md)
6. [Suggestions](suggestions.md)
7. [Retrouver les passages d'origine](retrouver-les-passages.md)
8. [Export, import et suppression](export-import.md)
9. [Réglages](reglages.md)
10. [Raccourcis clavier](raccourcis.md)

## Principes de fonctionnement

- **Traitement local.** Les documents, le texte reconnu et les surlignages restent sur le poste. Le plugin n'effectue aucun appel réseau : le moteur de reconnaissance du texte et le modèle de langue française sont inclus dans le plugin. Seule la recherche d'adresse du sélecteur de carte, qui appartient à ZeroNeurone, utilise un service en ligne.
- **Rien n'entre dans le graphe sans votre action.** Chaque objet est créé par une action explicite. Les suggestions se traitent une par une, sans validation groupée.
- **Pas de rattachement automatique.** Lorsqu'un élément du dossier porte un nom proche du passage, il est proposé, mais l'action par défaut reste la création d'un nouvel élément. Rattacher un passage à un élément existant est toujours votre choix, pour éviter de confondre deux homonymes.
- **Vous choisissez les catégories.** Les tags proposés par défaut (Personne, Entreprise, Lieu...) se modifient dans les réglages.
- **Origine conservée.** Chaque objet indique s'il a été créé à partir d'une sélection manuelle ou d'une suggestion, et conserve la référence au passage source.

## Ce que MarkNeurone ne fait pas

- Il ne lit pas l'écriture manuscrite. Un passage manuscrit peut être encadré et son texte saisi à la main, avec l'image sous les yeux.
- Il n'est pas conçu pour les tableaux (fadettes, relevés bancaires). La sélection et l'ordre de lecture y sont peu fiables : ces données relèvent d'un import structuré.
- Il ne reconnaît pas automatiquement les noms de personnes, de lieux ou d'organisations. Seuls les noms déjà présents dans le dossier et les identifiants de forme connue (téléphones, IBAN, plaques...) sont signalés.
- Il ne modifie pas le fichier d'origine. Les surlignages sont enregistrés dans le dossier ZeroNeurone, pas dans le PDF.
- La référence au passage permet de vérifier d'où vient un objet et de contrôler que le fichier n'a pas changé. Elle ne garantit pas que l'interprétation du passage est juste.
