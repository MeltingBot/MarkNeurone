# Banc d'essai OCR

Mesure locale de Tesseract (modèle français) sur des PDF image, avec et sans prétraitement, avant toute interface. Rien n'est téléchargé à l'exécution : les modèles sont dans `models/`.

## Utilisation

```bash
npm install
npm run gen                      # corpus fictif dans out/corpus (+ truth.json)
npm run bench                    # rapport dans out/report/report.md et report.json
npm run bench -- --models fast,best_int --filter photocopie --pages 1
npm run bench -- --input data/   # pièces fournies, sans vérité terrain : temps et confiance seulement
npm test                         # tests des validateurs, du prétraitement et des métriques
```

`data/` et `out/` sont ignorés par git. Les pièces réelles ne vont que dans `data/`.

Le générateur produit, pour chaque PV fictif, un PDF texte et cinq PDF image à 300 dpi : propre, biais, bruit, photocopie (contraste réduit, fond gris, flou), tampon. L'option `--stress` ajoute une variante qui cumule toutes les dégradations, proche d'une qualité fax, hors de la cible.

## Modèles

| Dossier | Origine | Taille |
| --- | --- | --- |
| `models/fast` | tessdata_fast `fra` | 1,1 Mo |
| `models/best_int` | `@tesseract.js-data/fra` 4.0.0_best_int | 1,2 Mo |

Empreintes dans `models/SHA256SUMS`. Le modèle tessdata_best en virgule flottante n'est pas utilisable : le cœur WASM LSTM de tesseract.js s'arrête dessus (`DotProductSSE` manquant).

## Résultats (1er octobre 2026, 2 PV de 2 pages, Node 24, tesseract.js 7.0.0)

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
