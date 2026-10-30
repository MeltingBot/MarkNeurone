// ─── Vite config: MarkNeurone External Plugin Build ──────────
//
// Produces a single ESM file (dist-plugin/markneurone.js) that can
// be dropped into ZN's plugins/ directory.
//
// Usage:  vite build --config vite.config.plugin.ts

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isDev = process.argv.includes('--minify') && process.argv.includes('false');

// ─── Licence notices ─────────────────────────────────────────
//
// Terser drops every comment, including the licence headers of the
// bundled libraries. Apache-2.0 and MIT require their notices to travel
// with the distributed file, so they are written at its head once
// minification is done (generateBundle runs after renderChunk).

function licenseBanner(): string {
  const read = (path: string) => readFileSync(path, 'utf-8').trim();
  // JSZip is used under MIT: keep that part of its dual licence only.
  const jszipMit = read('LICENSES/jszip.md').split(/\n\s*GPL version 3/)[0].trim();
  const body = [
    `MarkNeurone ${pkg.version}\n\n${read('LICENSE')}`,
    [
      'Third-party components bundled in this file (details in THIRD-PARTY-LICENSES.md):',
      '- PDF.js (pdfjs-dist), Mozilla Foundation: Apache-2.0',
      '- Tesseract.js and Tesseract.js Core: Apache-2.0',
      '- Tesseract OCR and the "fra" fast model (tesseract-ocr/tessdata_fast): Apache-2.0',
      '- JSZip, Stuart Knightley and contributors: MIT',
      '- pako, regenerator-runtime, buffer, base64-js, zlib.js: MIT',
      '- ieee754: BSD-3-Clause',
      '- Compiled into the Tesseract.js Core WebAssembly: Leptonica (BSD-2-Clause), zlib (Zlib),',
      '  libpng (PNG Reference Library License), libjpeg (IJG), libtiff (libtiff License), libwebp (BSD-3-Clause)',
      'This software is based in part on the work of the Independent JPEG Group.',
    ].join('\n'),
    `Apache License 2.0 (PDF.js, Tesseract.js, Tesseract.js Core, Tesseract OCR, fra model)\n\n${read('LICENSES/Apache-2.0.txt')}`,
    `JSZip\n\n${jszipMit}`,
    `pako\n\n${read('LICENSES/pako.txt')}`,
    `regenerator-runtime\n\n${read('LICENSES/regenerator-runtime.txt')}`,
    `buffer\n\n${read('LICENSES/buffer.txt')}`,
    `base64-js\n\n${read('LICENSES/base64-js.txt')}`,
    `ieee754\n\n${read('LICENSES/ieee754.txt')}`,
  ].join('\n\n----------------------------------------------------------------\n\n');
  return `/*!\n${body.replace(/\*\//g, '* /')}\n*/\n`;
}

function licenseNotices(): Plugin {
  return {
    name: 'markneurone-license-notices',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const banner = licenseBanner();
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.isEntry) file.code = banner + file.code;
      }
    },
  };
}

export default defineConfig({
  // Unminified builds keep the libraries' own headers; the banner would only shift their source map.
  plugins: [react(), tailwindcss(), ...(isDev ? [] : [licenseNotices()])],

  // Tesseract's model, inlined in the bundle (?inline): never downloaded.
  assetsInclude: ['**/*.traineddata'],

  // pdf.js' worker is an ES module.
  worker: {
    format: 'es',
  },

  build: {
    outDir: 'dist-plugin',
    emptyOutDir: true,

    lib: {
      entry: 'src/plugin-external.ts',
      formats: ['es'],
      fileName: () => 'markneurone.js',
    },

    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'dexie',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },

    assetsInlineLimit: 200 * 1024,

    minify: isDev ? false : 'terser',
    sourcemap: isDev,

    terserOptions: isDev ? undefined : {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      // No property renaming: the bundled pdf.js reads some of its "_" properties
      // by name, and renaming them left the fields of PDF forms empty.
      format: {
        comments: false,
      },
    },
  },

  define: {
    __MN_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
