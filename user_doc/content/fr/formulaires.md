---
title: "Formulaires"
weight: 7
---

# Formulaires

Certains documents sont des formulaires produits par un logiciel : la mise en page est toujours la même, et chaque information est rangée sous un libellé fixe, avec des rubriques qui peuvent se répéter (plusieurs faits, plusieurs personnes, plusieurs objets). Pour ces documents, MarkNeurone peut lire le formulaire à partir d'un modèle et proposer d'un coup l'élément et les propriétés de chaque rubrique.

Rien n'entre dans le graphe sans votre validation. Chaque objet créé garde la référence au passage d'où vient sa valeur, comme un surlignage fait à la main.

La lecture de formulaires s'applique aux PDF qui ont une couche texte. Les pages numérisées ne sont pas lues de cette façon.

## Lire un formulaire

Lorsque la première page d'un document correspond à un modèle importé dans les [réglages](reglages.md), le bouton « Lire comme formulaire » apparaît dans la barre d'outils du lecteur. Si plusieurs modèles correspondent, le bouton propose de choisir.

Le panneau de droite affiche alors :

- **Document** : les informations générales du formulaire (référence, date...), ajoutées comme propriétés de l'élément qui porte le document. Si plusieurs éléments portent le document, choisissez lequel ;
- **une section par rubrique** du modèle, avec la liste de ses blocs : un bloc par fait, par personne, par objet.

Les valeurs reconnues sont soulignées dans le document. Un clic sur une valeur soulignée ouvre le bloc correspondant dans le panneau.

## Valider un bloc

Un clic sur un bloc ouvre sa fiche :

- **Libellé** et **Tags** de l'élément, proposés par le modèle et modifiables ;
- **Éléments existants proches** : lorsque le nom ressemble à celui d'un élément du dossier, les candidats sont affichés avec ce qui les distingue (date de naissance, adresse, éléments liés). La création d'un nouvel élément reste le choix par défaut. Pour rattacher le bloc à un élément existant, sélectionnez-le explicitement ;
- **les champs** du bloc, chacun avec sa case à cocher et sa valeur modifiable. Une période (« Entre le ... et le ... ») devient un événement de l'élément, avec une date de début et de fin. Un libellé absent du modèle est proposé décoché. Une date illisible est signalée et proposée décochée ;
- **Liens** : lorsque le modèle le prévoit, des liens vers les éléments créés ou relus depuis une autre rubrique (par exemple d'une personne vers un fait), décochés par défaut.

« Créer » (ou « Rattacher ») crée l'élément et les champs cochés. « Écarter » retire le bloc des propositions pour ce document.

Un bloc créé apparaît coché dans la liste et le bloc suivant s'ouvre.

## Relire puis tout ajouter

Vous pouvez aussi relire tous les blocs avant d'ajouter quoi que ce soit. Un bloc sur lequel vous avez cliqué, ou dont vous avez modifié une valeur, est marqué « Relu » et garde vos corrections. Un bloc ouvert automatiquement après une création ne compte pas comme relu tant que vous n'y avez rien modifié.

« Ajouter les blocs relus », en bas du panneau, crée en une fois les blocs relus, rubrique par rubrique, avec les choix faits dans chaque fiche, puis les informations du document si vous les avez relues. Les blocs que vous n'avez pas ouverts ne sont pas ajoutés.

Un lien coché vers un bloc relu mais pas encore créé (par exemple d'une personne vers un fait) est créé en même temps que ce bloc.

Les corrections restent en mémoire si vous fermez le formulaire ou changez de document, jusqu'au rechargement de la page.

Lorsque le bloc est rattaché à un élément qui a déjà une propriété de même nom et de même valeur, cette propriété n'est pas ajoutée une seconde fois : le passage est seulement ajouté à ses sources.

Un clic sur un passage déjà surligné ferme le formulaire et affiche la fiche de l'élément. Le bouton « Lire comme formulaire » le rouvre.

## Le modèle de formulaire

Un modèle est un fichier JSON, importé dans l'onglet « Formulaires » des [réglages](reglages.md). MarkNeurone n'en fournit aucun : chaque service décrit les formulaires qu'il reçoit.

Les libellés sont comparés sans tenir compte des majuscules, des accents, des espaces en trop ni des deux-points finaux. La valeur peut se trouver sous son libellé ou sur la même ligne après deux-points (« Nom : Camille ARNOUX »), y compris dans une liste à tirets (« - Date du dépôt : 21/09/2026 »).

Exemple :

```json
{
  "id": "fiche-signalement",
  "name": "Fiche de signalement",
  "signature": ["Fiche de signalement", "Faits signalés"],
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
    { "id": "recit", "title": "Récit", "text": true }
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
| `text` | Rubrique de texte libre : rien n'y est proposé, les suggestions habituelles s'y appliquent |

Quelques conseils :

- **Distinguer les blocs semblables.** Lorsque plusieurs faits portent la même qualification, ajoutez au nom un champ qui les distingue, par exemple la commune ou la date de début : `"{Qualification} {Commune}"` ou `"{Qualification} {Période|date}"`. Sans cela, ils créent des éléments de même nom, et le second proposera le premier comme candidat.
- **Décrire toutes les rubriques.** Une rubrique absente du modèle est en général reconnue à la police de son titre et ignorée. Si le formulaire utilise une seule police, déclarez-la avec `"text": true` pour qu'elle ne soit pas rattachée au bloc précédent.
- **Libellés imprévus.** Dans un bloc, un libellé absent du modèle est reconnu à sa police (les formulaires écrivent en général les libellés en gras ou en italique) et proposé décoché, sous son propre nom.

À l'import, les parties invalides du modèle sont écartées et nommées dans un message.
