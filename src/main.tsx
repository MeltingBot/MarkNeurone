// ─── MarkNeurone Entry Point ─────────────────────────────────
//
// Wraps ZN's App: initializes the plugin then mounts the app.
// This is the Vite entry point for MN development.

// Polyfill crypto.randomUUID for non-secure contexts (HTTP LAN dev)
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = () =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: string) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16),
    ) as `${string}-${string}-${string}-${string}-${string}`;
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// ZN's i18n bootstrap (async: the instance only gains addResourceBundle once
// initialised, and every plugin calls it while registering)
import { initI18n } from 'zeroneurone-app/src/i18n.ts';

// Import MN's styles (wraps ZN's CSS + adds @source for Tailwind v4)
import './index.css';

// ZN's App component
import App from 'zeroneurone-app/src/App.tsx';

// External plugin loader (for other plugins; skips a compiled copy of MN)
import { loadExternalPlugins } from 'zeroneurone-app/src/services/pluginLoaderService.ts';

// MN plugin
import { initMarkNeurone } from './plugin.ts';
import { PLUGIN_ID } from './constants.ts';

// i18n first, then MN plugin + external plugins, then mount React
initI18n()
  .then(() => Promise.all([initMarkNeurone(), loadExternalPlugins([PLUGIN_ID])]))
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
