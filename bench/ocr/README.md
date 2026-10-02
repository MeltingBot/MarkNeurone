# Banc d'essai OCR

Mesure locale de Tesseract (modèle français) sur des PDF image, avec et sans prétraitement. Le banc mesure le temps, la confiance et l'erreur de reconnaissance, puis vérifie quelles suggestions du plugin restent trouvées après OCR : noms connus du dossier, téléphones, plaques, IBAN, SIRET, NIR, e-mails, URL, adresses IP, adresses Bitcoin et Ethereum, montants et dates. Rien n'est téléchargé à l'exécution : les modèles sont dans `models/`.

## Utilisation

```bash
npm install
npm run gen                      # corpus fictif dans out/corpus (+ truth.json)
npm run bench                    # rapport dans out/report/report.md et report.json
npm run bench -- --models fast,best_int --filter photocopie --pages 1
npm run bench -- --input data/   # pièces fournies, sans vérité terrain : temps et confiance seulement
npm run bench -- --dump          # écrit aussi le texte de chaque page dans out/report/text/
npm test                         # tests du cœur du plugin et des métriques du banc
```

`data/` et `out/` sont ignorés par git. Les pièces réelles ne vont que dans `data/`.

Le générateur produit, pour chaque PV fictif, un PDF texte et cinq PDF image à 300 dpi : propre, biais, bruit, photocopie (contraste réduit, fond gris, flou), tampon. L'option `--stress` ajoute une variante qui cumule toutes les dégradations, proche d'une qualité fax, hors de la cible.

Chaque PV contient au moins une occurrence de chaque type de suggestion. Les noms de personnes apparaissent parfois en ordre inversé ou avec l'initiale du prénom. La vérité terrain (`truth.json`) liste, page par page, chaque valeur attendue telle qu'elle est écrite. Pour mesurer les noms connus, le banc considère que le dossier contient déjà tous les noms cités dans le document.

Le score passe par la même fonction que le plugin (`buildSuggestions`). Une suggestion est trouvée lorsque sa valeur est identique à la valeur attendue, sans tenir compte des accents, de la casse, des espaces ni de la ponctuation. Une suggestion fausse est une valeur mal lue qui correspond encore au motif, ou un motif reconnu à tort.

## Modèles

| Dossier | Origine | Taille |
| --- | --- | --- |
| `models/fast` | tessdata_fast `fra` | 1,1 Mo |
| `models/best_int` | `@tesseract.js-data/fra` 4.0.0_best_int | 1,2 Mo |

Empreintes dans `models/SHA256SUMS`. Le modèle tessdata_best en virgule flottante n'est pas utilisable : le cœur WASM LSTM de tesseract.js s'arrête dessus (`DotProductSSE` manquant).

## Suggestions après OCR (2 octobre 2026, 2 PV de 2 pages, modèle `fast`)

62 suggestions attendues par variante, dont 14 numéros de téléphone écrits de façons différentes : séparés par des espaces, des points ou des tirets, collés, avec `+33` ou `0033`, et des numéros belges, suisses, espagnols et britanniques.

| Variante | Sans prétraitement | Avec prétraitement |
| --- | --- | --- |
| PDF texte (sans OCR) | 62/62 | |
| Propre | 60/62 | 59/62, 2 fausses |
| Biais | 50/62, 2 fausses | 59/62 |
| Bruit | 48/62, 7 fausses | 58/62, 1 fausse |
| Photocopie | 47/62, 2 fausses | 59/62 |
| Tampon | 53/62, 1 fausse | 52/62, 4 fausses |

Une suggestion fausse est le plus souvent une valeur mal lue mais encore reconnue par le motif. Aucune valeur fausse d'un type à clé de contrôle (IBAN, SIRET, NIR, Bitcoin) n'est passée pour valide.

- **Les règles de détection sont correctes** : sur le PDF texte, toutes les suggestions sont trouvées et aucune n'est fausse. Les écarts viennent de l'OCR.
- **Téléphones** : 14/14 avec prétraitement, sauf sous un tampon, quel que soit le format. Un numéro coupé en fin de ligne après son indicatif (« +41 » puis « 74 647 39 38 ») est reconnu.
- **Noms connus** : 21 ou 22 sur 22 avec prétraitement. Le prétraitement corrige la photocopie (17/22 sans).
- **Identifiants à clé** (IBAN, SIRET, NIR) : bien lus hors tampon. Une valeur mal lue n'est généralement plus reconnue du tout.
- **Adresses Bitcoin** : l'OCR lit presque toujours « bc1 » comme « bcl », et parfois « 0 » comme « O ». Ces confusions sont tolérées et l'adresse est signalée comme probablement mal lue ; la somme de contrôle bech32 dit si la valeur corrigée est juste. Il reste 0 à 1 adresse sur 2 retrouvée exactement, car l'OCR fait souvent une autre erreur sur ces 42 caractères sans mot. L'adresse est alors suggérée avec un avertissement, ou perdue si un caractère devient une ponctuation.
- **Adresses Ethereum** : 0 à 1 sur 2. Une erreur sur 40 caractères hexadécimaux (« 5 » lu « s ») suffit à les perdre.
- **Adresses IP** : sensibles au bruit et au tampon.
- **Le prétraitement** améliore nettement le biais, le bruit et la photocopie, et n'apporte rien sur la page propre ni sous un tampon.

Pour voir ce que l'OCR a lu à l'endroit d'une suggestion manquée : `npm run bench -- --dump` écrit le texte de chaque page dans `out/report/text/`.

## Reconnaissance (1er octobre 2026, 2 PV de 2 pages, Node 24, tesseract.js 7.0.0)

Sur la qualité cible :

- **Temps** : environ 0,9 s d'OCR par page A4 à 300 dpi, plus 0,6 à 1 s de prétraitement. Le rendu pdf.js est négligeable.
- **Le prétraitement est utile et suffit.** Photocopie grisée : CER de 10 % sans prétraitement, de 0 à 0,2 % avec, et les plaques passent de 3/6 à 6/6. Bruit et biais : CER de 0,8 à 1,3 % sans, de 0,1 à 0,2 % avec. Page propre : effet nul. OpenCV.js n'est pas justifié.
- **Redressement** : l'angle estimé est exact à 0,1° près sur toutes les pages en biais.
- **Tampon** : un numéro recouvert par un tampon reste mal lu (30 à 35 % d'erreur par caractère) avec ou sans prétraitement. Le prétraitement dégrade même un peu la page (CER de 2,9 % à 3,5 %). C'est le cas d'usage de la correction manuelle avec l'extrait d'image.
- **fast et best_int sont équivalents.** Le plugin embarque `fast`.
- **Clés de contrôle** : aucun IBAN ni SIRET erroné n'est passé pour valide. En revanche, les IBAN mal lus (un caractère faux) n'ont pas été extraits du tout, donc pas signalés : le motif ne les reconnaît plus. À traiter dans le plugin avec la suggestion de confusions (0/O, 1/l/I, 5/S, 8/B).

Hors cible (`--stress`, qualité fax) : sans prétraitement, Tesseract renvoie du bruit en 40 à 50 s par page. Avec prétraitement, environ 5 % de CER en 2 s.

Décisions pour le plugin :

1. Prétraitement actif par défaut, débrayable dans les réglages.
2. Modèle `fast` embarqué.
3. Toujours fixer `langPath`, `corePath` et `workerPath` de tesseract.js : sans `langPath`, la bibliothèque télécharge le modèle depuis un CDN.
4. Garde-fou de temps par page en OCR complète, pour qu'une page illisible ne bloque pas la file.

Limites : corpus réduit et synthétique, mesures sur une machine de développement. Le temps sur un poste de service se mesure avec `npm run bench -- --input data/` sur des pièces réelles.
