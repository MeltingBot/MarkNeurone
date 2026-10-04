// The bench's own test run: the core validators it shares with the plugin,
// and its metrics. Kept apart from the plugin's Vite config, which needs ZN.

import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    root: resolve(__dirname, '../..'),
    include: ['src/core/**/*.test.ts', 'bench/ocr/*.test.ts'],
  },
});
