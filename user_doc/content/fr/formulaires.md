---
title: "Formulaires"
weight: 7
---

# Formulaires

Certains documents sont des formulaires produits par un logiciel : la mise en page est toujours la même, et chaque information est rangée sous un libellé fixe, avec des rubriques qui peuvent se répéter (plusieurs faits, plusieurs personnes, plusieurs objets). Pour ces documents, MarkNeurone peut lire le formulaire à partir d'un modèle et proposer d'un coup l'élément et les propriétés de chaque rubrique.

Rien n'entre dans le graphe sans votre validation. Chaque objet créé garde la référence au passage d'où vient sa valeur, comme un surlignage fait à la main.

La lecture de formulaires s'applique aux PDF qui ont une couche texte. Les pages numérisées ne sont pas lues de cette façon.

## Lire un formulaire

Le bouton formulaire de la barre d'outils du lecteur (icône presse-papiers) ouvre le formulaire lorsqu'un seul modèle correspond à la première page du document. Sinon, il ouvre la liste des modèles.

## Gérer les modèles depuis le lecteur

La liste « Modèles de formulaire » s'ouvre par le bouton formulaire, ou par l'icône liste en haut du panneau d'un formulaire. Elle présente tous les modèles, ceux qui correspondent au document en premier. Pour chacun :

- un clic sur son nom ouvre le formulaire (seulement si le modèle correspond au document) ;
- le crayon l'ouvre dans l'éditeur, appliqué au document ouvert ;
- la flèche l'exporte en JSON ;
- la corbeille le supprime, après confirmation.

« Importer un modèle » ajoute un fichier JSON. « Créer depuis ce document » ouvre l'éditeur avec un modèle tiré du document. Les mêmes modèles se gèrent aussi dans l'onglet « Formulaires » des [réglages](reglages.md).

Le panneau de droite affiche alors :

- **Document** : les informations générales du formulaire (référence, date...), ajoutées comme propriétés de l'élément qui porte le document, et le texte des rubriques que le modèle verse dans sa note. Un texte déjà présent dans la note n'est pas ajouté une seconde fois. Si plusieurs éléments portent le document, choisissez lequel ;
- **une section par rubrique** du modèle, avec la liste de ses blocs : un bloc par fait, par personne, par objet.

Les valeurs reconnues sont soulignées dans le document. Un clic sur une valeur soulignée ouvre le bloc correspondant dans le panneau.

## Valider un bloc

Un clic sur un bloc ouvre sa fiche :

- **Libellé** et **Tags** de l'élément, proposés par le modèle et modifiables ;
- **Éléments existants proches** : lorsque le nom ressemble à celui d'un élément du dossier, les candidats sont affichés avec ce qui les distingue (date de naissance, adresse, éléments liés). La création d'un nouvel élément reste le choix par défaut. Pour rattacher le bloc à un élément existant, sélectionnez-le explicitement ;
- **les champs** du bloc, chacun avec sa case à cocher et sa valeur modifiable. Une période (« Entre le ... et le ... ») devient un événement de l'élément, avec une date de début et de fin. Un libellé absent du modèle est proposé décoché. Une date illisible est signalée et proposée décochée ;
- **Liens** : lorsque le modèle le prévoit, des liens vers les blocs d'une autre rubrique (par exemple d'une personne vers un fait). Un lien est coché d'office lorsque la rubrique visée ne compte qu'un bloc, décoché sinon. Si le modèle le demande, un lien vers l'élément qui porte le document est aussi proposé, coché.

« Créer » (ou « Rattacher ») crée l'élément et les champs cochés. « Écarter » retire le bloc des propositions pour ce document.

Un bloc créé apparaît coché dans la liste et le bloc suivant s'ouvre. Les nouveaux éléments sont placés sous l'élément qui porte le document, une ligne par rubrique.

## Relire puis tout ajouter

Vous pouvez aussi relire tous les blocs avant d'ajouter quoi que ce soit. Un bloc sur lequel vous avez cliqué, ou dont vous avez modifié une valeur, est marqué d'un œil et garde vos corrections. Un bloc ouvert automatiquement après une création ne compte pas comme relu tant que vous n'y avez rien modifié.

« Ajouter les blocs relus », en bas du panneau, crée en une fois les blocs relus, rubrique par rubrique, avec les choix faits dans chaque fiche, puis les informations du document si vous les avez relues. Les blocs que vous n'avez pas ouverts ne sont pas ajoutés.

Un lien coché vers un bloc pas encore créé (par exemple d'une personne vers un fait) est créé en même temps que ce bloc.

Les corrections restent en mémoire si vous fermez le formulaire ou changez de document, jusqu'au rechargement de la page.

Lorsque le bloc est rattaché à un élément qui a déjà une propriété de même nom et de même valeur, cette propriété n'est pas ajoutée une seconde fois : le passage est seulement ajouté à ses sources.

Un clic sur un passage déjà surligné ferme le formulaire et affiche la fiche de l'élément. Le bouton formulaire de la barre d'outils le rouvre.

## Créer un modèle depuis un document

« Créer depuis ce document », dans la liste des modèles, analyse les polices du document et propose un premier modèle : les titres (plus grands) délimitent les rubriques, les libellés (dans une police à part) sont suivis de leur valeur, un libellé qui revient dans une rubrique ouvre des blocs, et une rubrique de lignes à puce ou de paires « Clé : valeur » devient une liste.

Le panneau de droite affiche ce modèle, rubrique par rubrique, et le document montre au fur et à mesure les valeurs qu'il lit. Pour chaque rubrique, choisissez son type :

- **Document** : ses champs deviennent des propriétés de l'élément qui porte le document ;
- **Blocs** : un élément par bloc. Choisissez le libellé qui ouvre un bloc, le tag, le nom de l'élément (par exemple `{Qualification} {Période|date}`) et, pour chaque champ, le nom de la propriété et son type (texte, date, nombre, événement ou ignoré) ;
- **Liste** : un élément par objet de la liste ;
- **Texte** : rien n'est proposé ;
- **Note du document** : le texte de la rubrique est ajouté à la note de l'élément qui porte le document.

Les liens entre rubriques (par exemple d'une personne vers un fait) et le lien de chaque élément vers le document se règlent aussi dans ce panneau. « Enregistrer » ajoute le modèle aux réglages et ouvre le formulaire. « Exporter » produit le fichier JSON, à partager avec d'autres postes.

Le crayon, en haut du panneau d'un formulaire, rouvre son modèle dans cet éditeur. Les libellés du document absents du modèle y apparaissent comme ignorés.

Le modèle des réglages et un fichier exporté sont deux copies distinctes : importer à nouveau un ancien fichier remplace le modèle des réglages et efface les modifications faites depuis dans l'éditeur.

## Le modèle de formulaire

Un modèle est un fichier JSON, importé dans l'onglet « Formulaires » des [réglages](reglages.md), ou créé depuis un document comme ci-dessus. MarkNeurone n'en fournit aucun : chaque service décrit les formulaires qu'il reçoit.

Les libellés sont comparés sans tenir compte des majuscules, des accents, des espaces en trop ni des deux-points finaux. La valeur peut se trouver sous son libellé ou sur la même ligne après deux-points (« Nom : Camille ARNOUX »), y compris dans une liste à tirets (« - Date du dépôt : 21/09/2026 »).

Exemple :

```json
{
  "id": "fiche-signalement",
  "name": "Fiche de signalement",
  "signature": ["Fiche de signalement", "Faits signalés"],
  "documentLink": "mentionné dans",
  "empty": ["Non renseigné", "Sans objet"],
  "document": {
    "fields": [
      { "label": "Référence", "property": "Référence" },
      { "label": "Date de la fiche", "property": "Date", "type": "date" }
    ]
  },
  "sections": [
    {
      "id": "faits",
      "title": "Faits signalés",
      "block": {
        "startsWith": "Qualification",
        "element": { "tag": "Fait", "label": "{Qualification} {Période|date}" },
        "fields": [
          { "label": "Qualification", "property": "Qualification" },
          { "label": "Période", "event": "{Qualification}" },
          { "label": ["Adresse", "Lieu"], "property": "Adresse" }
        ]
      }
    },
    {
      "id": "personnes",
      "title": "Personnes concernées",
      "block": {
        "startsWith": "Nom",
        "element": { "tag": "Personne", "label": "{Nom}" },
        "fields": [
          { "label": "Date de naissance", "property": "Date de naissance", "type": "date" },
          { "label": "Téléphone", "property": "Téléphone" }
        ],
        "links": [{ "to": "faits", "label": "concernée par" }]
      }
    },
    {
      "id": "objets",
      "title": "Objets",
      "block": { "startsWith": "*", "element": { "tag": null, "label": null }, "free": true }
    },
    { "id": "recit", "title": "Récit", "text": true, "note": true }
  ]
}
```

| Clé | Rôle |
| --- | --- |
| `id`, `name` | Identifiant et nom du modèle. Importer un modèle de même identifiant remplace le précédent |
| `signature` | Textes qui doivent tous figurer sur la première page pour que le modèle soit proposé |
| `empty` | Valeurs ignorées. Une valeur faite seulement de X (texte masqué) l'est aussi |
| `document.fields` | Informations générales, ajoutées comme propriétés de l'élément qui porte le document. Elles sont lues partout hors des blocs à libellés, y compris dans une rubrique de texte ou entre les objets d'un bloc libre |
| `sections[].title` | Titre de la rubrique, tel qu'il figure dans le document. Une liste est acceptée pour plusieurs formulations |
| `block.startsWith` | Libellé qui ouvre un nouveau bloc. `*` ouvre un bloc à chaque ligne commençant par un astérisque ou un tiret |
| `block.element` | Tag et nom proposés pour l'élément du bloc. `{Libellé}` reprend la valeur d'un champ. `{Libellé\|date}` ne garde que la première date de la valeur |
| `fields[].label` | Libellé du champ, ou liste de formulations |
| `fields[].property` | Nom de la propriété créée. `type` vaut `text` (par défaut), `date` ou `number` |
| `fields[].event` | La valeur est une date ou une période : elle devient un événement de l'élément, nommé selon ce modèle de nom |
| `block.free` | Bloc sans libellés : son texte est proposé comme nom d'élément, et les paires « Clé : valeur » qu'il contient comme propriétés. Un bloc commence à chaque ligne à puce, à la première ligne sous un libellé (« Objets perdus ») et à chaque ligne précédée d'un espace vide. Une ligne qui suit directement la précédente continue le même bloc |
| `block.links` | Liens proposés vers les éléments créés depuis la rubrique indiquée par `to` |
| `text` | Rubrique de texte libre : rien n'y est proposé, les suggestions habituelles s'y appliquent. Avec `"note": true`, tout son texte est proposé pour la note de l'élément qui porte le document. Avec `property`, comme propriété du document sous ce nom |
| `documentLink` | Nom du lien proposé de chaque élément créé vers l'élément qui porte le document |

Quelques conseils :

- **Distinguer les blocs semblables.** Lorsque plusieurs faits portent la même qualification, ajoutez au nom un champ qui les distingue, par exemple la commune ou la date de début : `"{Qualification} {Commune}"` ou `"{Qualification} {Période|date}"`. Sans cela, ils créent des éléments de même nom, et le second proposera le premier comme candidat.
- **Décrire toutes les rubriques.** Une rubrique absente du modèle est en général reconnue à la police de son titre et ignorée. Si le formulaire utilise une seule police, déclarez-la avec `"text": true` pour qu'elle ne soit pas rattachée au bloc précédent.
- **Libellés imprévus.** Dans un bloc, un libellé absent du modèle est reconnu à sa police (les formulaires écrivent en général les libellés en gras ou en italique) et proposé décoché, sous son propre nom.

À l'import, les parties invalides du modèle sont écartées et nommées dans un message.
