// Identifier of the embedded OCR model, recorded with every cached result.
// Kept apart from ocrEngine.ts so that storage and export do not pull the
// engine (WASM core and model, several megabytes) into their imports.

export const OCR_MODEL_ID = 'tesseract-7-fra-fast';
