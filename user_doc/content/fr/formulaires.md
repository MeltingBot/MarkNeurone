---
title: "Formulaires"
weight: 7
---

# Formulaires

Certains documents sont des formulaires produits par un logiciel : la mise en page est toujours la même, chaque information est rangée sous un libellé fixe, et certaines rubriques se répètent (plusieurs faits, plusieurs personnes, plusieurs objets). Pour ces documents, MarkNeurone lit le formulaire à l'aide d'un modèle et propose, pour chaque fait, personne ou objet, l'élément et ses propriétés.

Rien n'entre dans le graphe sans votre validation. Chaque objet créé garde la référence au passage d'où vient sa valeur, comme un surlignage fait à la main.

La lecture de formulaires s'applique aux PDF qui ont une couche texte. Les pages numérisées ne sont pas lues de cette façon.

## Ouvrir un formulaire

Le bouton formulaire de la barre d'outils du lecteur (icône presse-papiers) ouvre le formulaire lorsqu'un seul modèle correspond à la première page du document. Sinon, il ouvre la [liste des modèles](#gérer-les-modèles), d'où vous choisissez le modèle, en importez un ou en créez un à partir du document.

Le panneau de droite affiche alors :

- **Document** : les informations générales du formulaire (référence, date...), ajoutées comme propriétés de l'élément qui porte le document, et le texte des rubriques que le modèle verse dans sa note ;
- **une section par rubrique** du modèle, avec la liste de ses blocs : un bloc par fait, par personne, par objet.

Les valeurs reconnues sont soulignées dans le document. Un clic sur une valeur soulignée ouvre le bloc correspondant dans le panneau.

En haut du panneau, l'icône liste ouvre la liste des modèles, le crayon ouvre le modèle dans l'éditeur, et la corbeille propose d'[effacer les surlignages du document](#recommencer-un-document).

Un clic sur un passage déjà surligné ferme le formulaire et affiche la fiche de l'élément. Le bouton formulaire le rouvre.

## Valider un bloc

Un clic sur un bloc ouvre sa fiche :

- **Libellé** et **Tags** de l'élément, proposés par le modèle et modifiables ;
- **Éléments existants proches** : lorsque le nom ressemble à celui d'un élément du dossier, les candidats sont affichés avec ce qui les distingue (date de naissance, adresse, éléments liés). La création d'un nouvel élément reste le choix par défaut. Pour rattacher le bloc à un élément existant, sélectionnez-le explicitement ;
- **les champs** du bloc, chacun avec sa case à cocher et sa valeur modifiable. Une période (« Entre le ... et le ... ») devient un événement de l'élément, avec une date de début et de fin. Un libellé absent du modèle est proposé décoché. Une date illisible est signalée et proposée décochée ;
- **Liens** : lorsque le modèle le prévoit, des liens vers les blocs d'une autre rubrique (par exemple d'une personne vers un fait). Un lien est coché d'office lorsque la rubrique visée ne compte qu'un bloc, décoché sinon. Si le modèle le demande, un lien vers l'élément qui porte le document est aussi proposé, coché.

« Créer » (ou « Rattacher ») crée l'élément, les champs cochés et les liens cochés. « Écarter » retire le bloc des propositions pour ce document. Un bloc créé apparaît coché dans la liste, et le bloc suivant s'ouvre.

Les nouveaux éléments sont placés sur le canvas sous l'élément qui porte le document, une ligne par rubrique.

Lorsque le bloc est rattaché à un élément qui a déjà une propriété de même nom et de même valeur, cette propriété n'est pas ajoutée une seconde fois : le passage est seulement ajouté à ses sources.

La ligne **Document** se valide de la même façon : « Ajouter » enregistre les champs cochés sur l'élément qui porte le document. Si plusieurs éléments portent le document, choisissez lequel. Le texte versé dans la note s'ajoute à la suite de la note existante. Un texte déjà présent dans la note n'est pas ajouté une seconde fois.

## Relire puis tout ajouter

Vous pouvez aussi relire tous les blocs avant d'ajouter quoi que ce soit. Un bloc sur lequel vous avez cliqué, ou dont vous avez modifié une valeur, est marqué d'un œil et garde vos corrections. Un bloc ouvert automatiquement après une création ne compte pas comme relu tant que vous n'y avez rien modifié.

« Ajouter les blocs relus », en bas du panneau, crée en une fois les blocs relus, rubrique par rubrique, avec les choix faits dans chaque fiche, puis les informations du document si vous les avez relues. Les blocs que vous n'avez pas ouverts ne sont pas ajoutés.

Un lien coché vers un bloc pas encore créé (par exemple d'une personne vers un fait) est créé en même temps que ce bloc.

Les corrections restent en mémoire si vous fermez le formulaire ou changez de document, jusqu'au rechargement de la page.

## Recommencer un document

La corbeille, en haut du panneau du formulaire ou du panneau « Éléments du document », efface tous les surlignages du document. Une confirmation s'affiche sous la barre d'outils. Une case, cochée par défaut, supprime aussi les éléments et liens créés uniquement depuis ce document. Les blocs du formulaire redeviennent alors à valider. Voir [Retrouver les passages d'origine](retrouver-les-passages.md#effacer-tous-les-surlignages-dun-document).

## Gérer les modèles

La liste « Modèles de formulaire » s'ouvre par le bouton formulaire, ou par l'icône liste en haut du panneau d'un formulaire. Elle présente tous les modèles, ceux qui correspondent au document en premier. Pour chacun :

- un clic sur son nom ouvre le formulaire, si le modèle correspond au document ;
- le crayon l'ouvre dans l'éditeur, appliqué au document ouvert, même s'il ne lui correspond pas ;
- la flèche l'exporte en fichier JSON ;
- la corbeille le supprime, après confirmation.

« Importer un modèle » ajoute un fichier JSON. Un modèle de même identifiant est remplacé. « Créer depuis ce document » ouvre l'éditeur avec un modèle tiré du document.

Les mêmes modèles se gèrent aussi dans l'onglet « Formulaires » des [réglages](reglages.md). Ils sont enregistrés sur le poste, pour tous les dossiers, et ne font pas partie de l'export d'un dossier : pour les utiliser sur un autre poste, exportez-les puis importez-les.

## Créer ou modifier un modèle

« Créer depuis ce document » analyse les polices du document et propose un premier modèle :

- les titres, écrits plus grand, délimitent les rubriques ;
- les libellés, écrits dans une police à part, sont suivis de leur valeur ;
- un libellé qui revient dans une rubrique ouvre des blocs ;
- une rubrique de lignes à puce ou de paires « Clé : valeur » devient une liste ;
- une période devient un événement, et sa date de début est ajoutée au nom des éléments ;
- une valeur qui revient sous plusieurs libellés (« Non renseigné ») est ignorée.

Le nom du modèle reprend le titre du formulaire. Le crayon ouvre de la même façon un modèle existant. Les libellés du document absents du modèle y apparaissent comme ignorés.

L'éditeur occupe le panneau de droite, et le document montre au fur et à mesure les valeurs que le modèle lit. Chaque rubrique en blocs indique le nombre de blocs trouvés.

En haut de l'éditeur se règlent le nom du modèle, les textes de la première page qui permettent de le reconnaître, les valeurs ignorées et le nom du lien de chaque élément vers le document (laissé vide, aucun lien n'est proposé).

Pour chaque rubrique, choisissez son type :

- **Document** : ses champs deviennent des propriétés de l'élément qui porte le document ;
- **Blocs** : un élément par bloc. Choisissez le libellé qui ouvre un bloc, le tag, le nom de l'élément (par exemple `{Qualification} {Période|date}`, les champs disponibles sont rappelés dessous) et, pour chaque champ, le nom de la propriété et son type : texte, date, nombre, événement ou ignoré ;
- **Liste** : un élément par objet de la liste, avec ses paires « Clé : valeur » en propriétés ;
- **Texte** : rien n'est proposé, les suggestions habituelles s'appliquent ;
- **Note du document** : le texte de la rubrique est proposé pour la note de l'élément qui porte le document.

Pour une rubrique en blocs ou en liste, cochez les autres rubriques vers lesquelles un lien sera proposé, et donnez son nom (par exemple « victime de »).

« Enregistrer » ajoute le modèle aux réglages, ou remplace celui qui était modifié, et ouvre le formulaire. « Exporter » produit le fichier JSON. Fermer l'éditeur sans enregistrer abandonne les modifications.

Le modèle des réglages et un fichier exporté sont deux copies distinctes. Importer à nouveau un ancien fichier remplace le modèle des réglages et efface les modifications faites depuis dans l'éditeur.

## Format du fichier de modèle

Un modèle est un fichier JSON. MarkNeurone n'en fournit aucun : chaque service décrit les formulaires qu'il reçoit, avec l'éditeur ou à la main.

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

À l'import, les parties invalides du modèle sont écartées et nommées dans un message.

## Conseils

- **Distinguer les blocs semblables.** Lorsque plusieurs faits portent la même qualification, ajoutez au nom un champ qui les distingue, par exemple la commune ou la date de début : `"{Qualification} {Commune}"` ou `"{Qualification} {Période|date}"`. Sans cela, ils créent des éléments de même nom, et le second proposera le premier comme candidat.
- **Décrire toutes les rubriques.** Une rubrique absente du modèle est en général reconnue à la police de son titre et ignorée. Si le formulaire utilise une seule police, déclarez-la comme rubrique de texte pour qu'elle ne soit pas rattachée au bloc précédent.
- **Libellés imprévus.** Dans un bloc, un libellé absent du modèle est reconnu à sa police (les formulaires écrivent en général les libellés en gras ou en italique) et proposé décoché, sous son propre nom.
- **Plusieurs objets sous un même libellé.** Dans une liste sans puces, les objets sont séparés par l'espace vide que le formulaire laisse entre eux. Si deux objets sont fusionnés en un seul bloc, écartez-le et surlignez chaque objet à la main.
