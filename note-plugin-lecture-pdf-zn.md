# Plugin ZeroNeurone : lecture annotée de documents PDF

Note de cadrage pour développement. Nom de travail : **MarkNeurone**.

## 1. Intention

OneNeurone extrait automatiquement les éléments d'un document par IA. Ce plugin propose une voie manuelle et gratuite : l'enquêteur lit le PDF dans ZN, surligne ce qui l'intéresse et chaque surlignage devient un objet du graphe (élément, propriété, événement ou lien). L'analyste garde la main sur chaque décision, ce qui colle à la philosophie du projet et facilite la justification des choix devant un magistrat ou un client.

Un mécanisme de pré-surlignage automatique, sans IA, repère les motifs évidents (dates, téléphones, IBAN...) et les éléments déjà présents dans le dossier. Ces pré-surlignages restent des suggestions tant que l'utilisateur ne les a pas validés.

Le plugin reprend une pratique existante. En Gendarmerie, les analystes criminels (Anacrim) prétraitent les procès-verbaux par surlignage selon un code couleur, puis ressaisissent les entités dans leur outil de graphe. MarkNeurone numérise ce geste et supprime la ressaisie. Les PV circulant désormais sous forme de PDF image, sans couche texte, l'OCR locale fait partie du socle de la V1 (section 8).

## 2. Parcours utilisateur

L'utilisateur importe un PDF dans le dossier, qui s'ouvre dans un panneau latéral ou un onglet dédié à côté du canvas. Les pré-surlignages apparaissent en couleur atténuée. L'utilisateur sélectionne un passage, un menu contextuel lui propose de le qualifier, et l'objet correspondant apparaît sur le canvas. Un clic sur un objet du graphe créé de cette façon ramène au passage source dans le PDF, et inversement.

## 3. Les quatre gestes de qualification

| Geste | Résultat dans ZN | Exemple |
|---|---|---|
| Surligner comme **élément** | Création d'un élément, ou rattachement à un élément existant | « Société Arvalis Trading » |
| Surligner comme **propriété** | Ajout d'une propriété à un élément choisi (ou à l'élément actif) | « immatriculée le 12/03/2019 » sur Arvalis |
| Surligner comme **événement** | Élément de type événement avec date extraite, rattaché aux éléments de la même phrase sur validation | « réunion du 4 mai à Lyon » |
| Surligner comme **lien** | Relation entre deux éléments, voir section 4 | « a versé 15 000 € à » |

Chaque geste ouvre un petit formulaire prérempli (libellé, tags, type de propriété) que l'utilisateur corrige ou valide d'un appui sur Entrée. Le but est de rester sous les deux secondes par annotation, sinon personne ne l'utilisera sur un document de quarante pages.

## 4. La création de liens

C'est la partie la moins évidente. Je propose trois modes complémentaires, du plus manuel au plus assisté. Le premier suffit pour une V1.

### 4.1 Mode « deux clics »

L'utilisateur clique sur un surlignage déjà qualifié (élément A), active le mode lien (raccourci `L`), puis clique sur un second surlignage (élément B). Le texte situé entre les deux, s'ils sont dans la même phrase, est proposé comme libellé de la relation. Sinon le libellé reste vide et l'utilisateur le saisit. Le sens de la relation suit l'ordre des clics, avec un bouton pour l'inverser.

### 4.2 Mode « verbe »

L'utilisateur surligne directement la locution qui porte la relation (« a cédé ses parts à », « est le gérant de »). Le plugin cherche l'élément qualifié le plus proche à gauche et à droite dans la phrase, les propose comme extrémités, et l'utilisateur confirme ou corrige chaque extrémité par un clic. C'est le mode le plus naturel à la lecture, car on surligne ce qu'on lit dans l'ordre.

### 4.3 Suggestions par cooccurrence

Lorsque deux éléments qualifiés apparaissent dans la même phrase (ou le même paragraphe, réglable), le plugin affiche un trait discret dans la marge. Un clic sur ce trait ouvre la création de lien préremplie. Aucune relation n'est créée sans validation, et l'utilisateur peut masquer ces suggestions. Ce mode sert surtout à ne pas rater un lien en relecture.

### 4.4 Liens vers des éléments hors document

Une partie des liens utiles concerne un élément du texte et un élément déjà présent sur le canvas mais absent du PDF. Le mode deux clics doit donc accepter un second clic sur le canvas, pas uniquement dans le PDF.

## 5. Pré-surlignage automatique

Trois sources, toutes déterministes et explicables.

**Motifs génériques** par expressions régulières : dates (formats français et ISO), téléphones FR et internationaux, e-mails, URL, IBAN avec contrôle de clé, SIREN/SIRET avec contrôle Luhn, plaques d'immatriculation FR, IPv4/IPv6, adresses Bitcoin et Ethereum, montants en euros.

**Dictionnaire du dossier** : libellés et alias des éléments déjà présents dans le graphe. Un nom déjà connu est surligné dans la couleur de son tag, ce qui fait apparaître immédiatement les recoupements entre pièces. La correspondance doit tolérer la casse, les accents et les variantes simples (initiales, inversion nom/prénom) sans aller jusqu'au flou agressif qui produirait du bruit.

**Profils GoNeurone** : un profil métier peut embarquer ses propres motifs (numéro de procédure, référence de contrat d'assurance, numéro de sinistre) et proposer les tags par défaut associés. C'est un bon argument pour la marketplace.

**Grille de couleurs** : le profil définit aussi la correspondance entre couleurs de surlignage et types d'objets ZN (par exemple personnes, lieux, véhicules, téléphones, dates). Un profil « prétraitement PV » reproduirait la grille utilisée par les Anacrim, pour que l'analyste retrouve ses habitudes sans réapprentissage. La grille réelle doit être récupérée auprès d'analystes en poste, car elle peut varier selon les unités.

Le pré-surlignage par NER (noms de personnes, lieux, organisations) reste hors périmètre de ce plugin. Il relève de OneNeurone ou d'un module optionnel ultérieur.

## 6. Traçabilité

Chaque objet créé conserve une ancre vers sa source : identifiant du document, empreinte SHA-256 du fichier, numéro de page, coordonnées du passage et texte exact. Une propriété système « source » apparaît sur l'élément avec un lien cliquable. Cette ancre permet trois choses : revenir au passage d'un clic, générer dans un rapport une citation avec référence de page, et prouver que le document n'a pas changé depuis l'annotation grâce à l'empreinte.

Un même élément peut cumuler plusieurs ancres issues de plusieurs documents. Le panneau de l'élément liste alors toutes ses occurrences, ce qui transforme le plugin en outil de recoupement entre pièces.

## 7. Modèle de données proposé

```ts
interface Annotation {
  id: string;
  documentId: string;        // asset du dossier
  documentHash: string;      // SHA-256 du PDF
  page: number;
  quads: number[][];         // rectangles du surlignage (coordonnées PDF.js)
  text: string;              // texte surligné exact
  context?: string;          // phrase complète, utile aux liens
  kind: 'element' | 'property' | 'event' | 'link' | 'suggestion';
  status: 'suggested' | 'validated' | 'rejected';
  origin: 'manual' | 'pattern' | 'dictionary' | 'profile' | 'oneneurone';
  targetId?: string;         // id de l'élément, du lien ou de la propriété dans ZN
  ocr?: {
    rawText: string;         // texte tel que reconnu par l'OCR
    confidence: number;      // confiance moyenne du moteur sur la zone (0 à 100)
    corrected: boolean;      // true si l'utilisateur a modifié le texte
  };
  createdAt: string;
}
```

Lorsque le passage provient de l'OCR, `text` contient le texte validé par l'utilisateur et `ocr.rawText` le texte reconnu. Cette double conservation permet de montrer ce que la machine a lu et ce que l'analyste a corrigé.

Le champ `origin` accepte `oneneurone` à dessein. Si OneNeurone produit ses extractions dans ce même format, avec le statut `suggested`, MarkNeurone devient l'interface de relecture et de validation des sorties IA. Les deux plugins se complètent alors au lieu de se concurrencer, et l'humain valide chaque extraction de la machine dans le contexte du texte.

Les annotations sont stockées localement avec le dossier et incluses dans l'export ZIP, dans un fichier `annotations.json` à côté de `dossier.json`. Il faudra faire évoluer la spec d'export en conséquence (champ optionnel, rétrocompatible).

## 8. Choix techniques

Le rendu s'appuie sur PDF.js, qui fournit la couche texte nécessaire à la sélection et au calcul des coordonnées. La sélection native du navigateur sur cette couche texte suffit pour une V1. Le découpage en phrases peut utiliser `Intl.Segmenter`, disponible dans les navigateurs récents, ce qui évite une dépendance.

### 8.1 OCR des PDF image

Les PV et une bonne partie des pièces de procédure sont des PDF image. Le plugin détecte à l'ouverture l'absence de couche texte et bascule en mode OCR. Le traitement reste entièrement local, via Tesseract.js (WASM) avec le modèle français, exécuté dans un Web Worker pour ne pas figer l'interface. Aucune pièce ne sort du poste, ce qui est une condition d'usage pour des documents judiciaires et un argument différenciant face à un service d'OCR en ligne.

Deux stratégies se combinent. L'OCR à la demande s'applique à la zone que l'utilisateur encadre à la souris sur l'image : la reconnaissance porte sur quelques lignes, elle répond en une fraction de seconde et l'analyste peut commencer à travailler immédiatement. L'OCR complète tourne en arrière-plan page par page, dans l'ordre de lecture, et construit une couche texte invisible superposée à l'image à partir des boîtes de mots fournies par Tesseract. Une fois une page traitée, la sélection de texte, la recherche et le pré-surlignage y deviennent disponibles. Le résultat est mis en cache avec le dossier, indexé par l'empreinte du PDF, pour ne pas relancer l'OCR à chaque ouverture.

Un prétraitement de l'image améliore nettement les résultats sur des PV photocopiés ou numérisés en biais : redressement, binarisation adaptative et suppression du bruit. OpenCV.js est une option, plus lourde, et un prétraitement simple sur canvas suffit peut-être pour des PV dactylographiés. Le test sur pièces réelles tranchera.

### 8.2 Gestion des erreurs de reconnaissance

Une erreur d'OCR sur un numéro de téléphone ou une plaque crée un faux élément ou rate un recoupement. Le formulaire de qualification affiche donc toujours l'extrait d'image à côté du texte reconnu, avec les caractères de faible confiance mis en évidence, et l'utilisateur corrige avant validation. Les identifiants à clé de contrôle (IBAN, SIREN, SIRET, numéro de sécurité sociale) servent de vérification automatique : une clé invalide signale une erreur de lecture probable. Pour les numéros sans clé, le plugin peut proposer les confusions classiques (0/O, 1/l/I, 5/S, 8/B) lorsque le motif attendu n'est pas respecté.

Les éléments manuscrits (annotations en marge, signatures, mentions ajoutées à la main) ne seront pas lus correctement par Tesseract. Le mode zone permet alors de saisir le texte à la main tout en conservant l'ancre sur l'image.

Hypothèse à vérifier côté architecture : je ne connais pas le détail de l'API de plugins actuelle de ZN. Le plugin a besoin de pouvoir ouvrir un panneau, lire les éléments et alias du dossier, créer éléments, propriétés et liens, écouter la sélection sur le canvas et stocker des données propres au dossier. Si l'un de ces points manque, c'est le premier chantier.

## 9. Découpage proposé

**V1 (MVP)** : ouverture d'un PDF texte ou image, OCR locale à la demande par zone et complète en arrière-plan, correction du texte reconnu avant validation, surlignage manuel avec les quatre gestes, grille de couleurs configurable, mode lien deux clics, ancres de traçabilité avec retour au passage, pré-surlignage par motifs génériques et dictionnaire du dossier, export dans le ZIP.

**V2** : mode verbe, suggestions par cooccurrence, liens vers éléments du canvas, motifs et grilles fournis par les profils GoNeurone (dont un profil « prétraitement PV »), prétraitement d'image avancé, raccourcis clavier complets, vue « occurrences » multi-documents.

**V3** : import des suggestions OneNeurone dans le format commun, export compatible Analyst's Notebook, extension à d'autres formats (DOCX, HTML, e-mails `.eml`, exports texte de messageries).

## 10. Questions ouvertes

Faut-il annoter le PDF lui-même (export d'un PDF surligné à joindre au rapport) ou seulement garder les annotations dans ZN ? L'export d'un PDF annoté a une vraie valeur en procédure, mais ajoute une dépendance comme pdf-lib.

Que se passe-t-il quand un élément est supprimé du graphe ? Je propose de conserver l'annotation en statut orphelin plutôt que de l'effacer, pour ne pas perdre le travail de lecture.

Comment gérer la fusion de deux éléments créés depuis deux documents différents ? Les ancres doivent suivre la fusion, ce qui suppose que la fonction de fusion de ZN expose un événement aux plugins.

Les Anacrim travaillent sous Analyst's Notebook. Un export vers ce format, en s'appuyant sur l'analyse déjà faite du format .anb, conditionne peut-être l'adoption par ce public, qui ne changera pas d'outil de graphe principal pour un plugin de prétraitement. Il faut le vérifier auprès d'analystes avant de figer la V3.

Quel volume de pages l'OCR complète doit-elle absorber sur un poste de service standard ? Une procédure de plusieurs centaines de pages peut demander de longues minutes de traitement en navigateur, et il faudra mesurer ce temps sur le matériel réellement utilisé en unité.

Le plugin est-il gratuit et intégré au cœur, ou distribué à part ? Vu son rôle de porte d'entrée vers OneNeurone, le laisser gratuit et sous MIT paraît cohérent.
