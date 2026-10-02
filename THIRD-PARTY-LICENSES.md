# Licences des composants tiers

MarkNeurone inclut ou utilise les logiciels libres suivants. Les textes de licence fournis par les projets sont copiés sans modification dans le dossier [`LICENSES/`](LICENSES/).

## Inclus dans le bundle du plugin

Ces composants sont intégrés au fichier `markneurone.js` distribué.

| Composant | Version | Licence | Auteurs | Texte |
|---|---|---|---|---|
| [PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) | 6.2.108 | Apache-2.0 | Mozilla Foundation | [Apache-2.0.txt](LICENSES/Apache-2.0.txt) |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 7.0.0 | Apache-2.0 | Projet Tesseract.js | [Apache-2.0.txt](LICENSES/Apache-2.0.txt) |
| [Tesseract.js Core](https://github.com/naptha/tesseract.js-core) | 7.0.0 | Apache-2.0 | Projet Tesseract.js | [Apache-2.0.txt](LICENSES/Apache-2.0.txt) |
| [JSZip](https://github.com/Stuk/jszip) | 3.10.1 | MIT ou GPL-3.0-or-later, utilisé sous MIT | Stuart Knightley et contributeurs | [jszip.md](LICENSES/jszip.md) |
| [regenerator-runtime](https://github.com/facebook/regenerator) | 0.13.11 | MIT | Facebook, Inc. | [regenerator-runtime.txt](LICENSES/regenerator-runtime.txt) |

### Composants intégrés à ces bibliothèques

Le fichier distribué de JSZip contient :

| Composant | Licence | Texte |
|---|---|---|
| [pako](https://github.com/nodeca/pako) | MIT (et Zlib pour le code porté de zlib) | [pako.txt](LICENSES/pako.txt) |

Le worker de Tesseract.js (`worker.min.js`) contient :

| Composant | Licence | Texte |
|---|---|---|
| [buffer](https://github.com/feross/buffer) | MIT | [buffer.txt](LICENSES/buffer.txt) |
| [ieee754](https://github.com/feross/ieee754) | BSD-3-Clause | [ieee754.txt](LICENSES/ieee754.txt) |
| [base64-js](https://github.com/beatgammit/base64-js) | MIT | [base64-js.txt](LICENSES/base64-js.txt) |
| [zlib.js](https://github.com/imaya/zlib.js) | MIT | [Licence du projet](https://github.com/imaya/zlib.js/blob/develop/LICENSE) |
| regenerator-runtime | MIT | [regenerator-runtime.txt](LICENSES/regenerator-runtime.txt) |

Le cœur WebAssembly de Tesseract.js Core est compilé à partir de :

| Composant | Version | Licence |
|---|---|---|
| [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) | 5.1.0 (développement) | [Apache-2.0](LICENSES/Apache-2.0.txt) |
| [Leptonica](http://www.leptonica.org/) | | [BSD-2-Clause](https://github.com/DanBloomberg/leptonica/blob/master/leptonica-license.txt) |
| [zlib](https://zlib.net/) | 1.2.12 | [Zlib](https://zlib.net/zlib_license.html) |
| [libpng](http://www.libpng.org/pub/png/libpng.html) | | [PNG Reference Library License](http://www.libpng.org/pub/png/src/libpng-LICENSE.txt) |
| [libjpeg](https://ijg.org/) | | [Licence IJG](https://jpegclub.org/reference/libjpeg-license/) |
| [libtiff](https://libtiff.gitlab.io/libtiff/) | | [Licence libtiff](https://gitlab.com/libtiff/libtiff/-/blob/master/LICENSE.md) |
| [libwebp](https://chromium.googlesource.com/webm/libwebp) | | [BSD-3-Clause](https://chromium.googlesource.com/webm/libwebp/+/refs/heads/main/COPYING) |

This software is based in part on the work of the Independent JPEG Group.

## Modèle de reconnaissance embarqué

| Fichier | Source | Licence |
|---|---|---|
| `assets/models/fra_fast.traineddata` | [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast), modèle français | [Apache-2.0](LICENSES/Apache-2.0.txt) |

Empreinte SHA-256 et choix du modèle : [`assets/models/NOTICE.md`](assets/models/NOTICE.md).

## Fournis par ZeroNeurone

Ces bibliothèques ne sont pas incluses dans le plugin : ZeroNeurone les fournit à l'exécution par son API de plugins.

| Composant | Licence |
|---|---|
| [React](https://github.com/facebook/react) et React DOM | MIT |
| [Zustand](https://github.com/pmndrs/zustand) | MIT |
| [i18next](https://github.com/i18next/i18next) | MIT |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC |

## Banc d'essai OCR (non distribué)

Le banc `bench/ocr/` n'est pas inclus dans le plugin. Il utilise en plus :

| Composant | Licence |
|---|---|
| [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) | MIT |
| [tsx](https://github.com/privatenumber/tsx) | MIT |
| Modèles `fra` de [@tesseract.js-data](https://github.com/naptha/tessdata) (`bench/ocr/models/`) | Apache-2.0 |

## Outils de développement (non distribués)

Vite, Vitest, TypeScript, Tailwind CSS et jsdom servent au développement et aux tests. Ils ne sont pas inclus dans le plugin.
