// ─── Vite config: MarkNeurone Dev Mode ───────────────────────
//
// Launches ZN as a full app with the MN plugin pre-loaded.
// Entry: src/main.tsx → imports ZN's App + initializes MN plugin.
//
// Usage:  npm run dev  (or: vite)

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const znPkg = JSON.parse(readFileSync('../zeroneurone/package.json', 'utf-8'));
const mnPkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  publicDir: resolve(__dirname, '../zeroneurone/public'),

  // Tesseract's model, inlined in the bundle (?inline): never downloaded.
  assetsInclude: ['**/*.traineddata'],

  // pdf.js' worker is an ES module.
  worker: {
    format: 'es',
  },

  server: {
    port: 5179,
  },

  define: {
    __APP_VERSION__: JSON.stringify(`${znPkg.version}+mn${mnPkg.version}`),
    __MN_VERSION__: JSON.stringify(mnPkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify('dev'),
  },

  test: {
    // The OCR bench has its own dependencies and test run (bench/ocr).
    include: ['src/**/*.test.ts'],
  },
});
