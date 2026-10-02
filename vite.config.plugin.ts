// ─── Vite config: MarkNeurone External Plugin Build ──────────
//
// Produces a single ESM file (dist-plugin/markneurone.js) that can
// be dropped into ZN's plugins/ directory.
//
// Usage:  vite build --config vite.config.plugin.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isDev = process.argv.includes('--minify') && process.argv.includes('false');

export default defineConfig({
  plugins: [react()],

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
      mangle: {
        properties: {
          regex: /^_/,
        },
      },
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
