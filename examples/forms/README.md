# Exemples de modèles de formulaire

Modèles de formulaire prêts à importer dans MarkNeurone, chacun accompagné d'un exemplaire rempli avec des données fictives pour l'essayer.

| Modèle | Formulaire | Lecture |
| --- | --- | --- |
| `cerfa-13750.model.json` | Cerfa 13750*07, demande de certificat d'immatriculation d'un véhicule | Formulaire à cases : valeurs écrites dans les cases, libellés imprimés dessous |
| `cerfa-15459.model.json` | Cerfa 15459*02, autorisation de travaux sur monuments historiques et demande de subvention | PDF à champs : valeurs rangées dans les champs du formulaire |
| `pappers-extrait-rne.model.json` | Extrait Pappers du registre national des entreprises (personne morale) | Formulaire à libellés : libellé et valeur côte à côte, une rubrique par rôle de dirigeant |

Pour essayer un modèle :

1. ajoutez l'exemplaire fictif (`cerfa-13750-exemple-fictif.pdf` ou `cerfa-15459-exemple-fictif.pdf`) à un élément d'un dossier ZeroNeurone et ouvrez-le avec MarkNeurone ;
2. dans le lecteur, le bouton formulaire ouvre la liste des modèles : « Importer un modèle », puis choisissez le fichier JSON ;
3. ouvrez le formulaire et validez les blocs proposés.

Les noms de propriétés, les tags et les liens de ces modèles sont des choix d'exemple : adaptez-les dans l'éditeur de modèle (crayon en haut du panneau du formulaire). Voir la page [Formulaires](../../user_doc/content/fr/formulaires.md) de la documentation.

Le modèle Pappers n'a pas d'exemplaire fourni : il se lit sur n'importe quel extrait téléchargé depuis pappers.fr. Il propose la société, puis chaque dirigeant, associé ou commissaire aux comptes lié à la société par son rôle (« Administrateur », « Directeur général »...) ; l'adresse de l'établissement et les mentions du greffe vont dans la note de l'élément qui porte le document. Un rôle absent du modèle est ignoré : ajoutez sa rubrique dans l'éditeur.

Les personnes, sociétés, adresses et numéros des exemplaires sont fictifs.
