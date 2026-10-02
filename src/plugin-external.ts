// ─── MarkNeurone External Plugin Entry Point ─────────────────
//
// Loaded by ZN's pluginLoaderService from /plugins/markneurone.js.
// ZN calls `register(api)` with its pluginAPI object.
//
// This module:
//   1. Maps the pluginAPI to our MarkHostAPI bridge
//   2. Calls the shared registerSlots()

import { setHostAPI } from './hostAPI.ts';
import type { MarkHostAPI } from './hostAPI.ts';

/**
 * External plugin entry point.
 *
 * Called by ZN's plugin loader: `mod.register(pluginAPI)`.
 */
export async function register(api: any): Promise<void> {
  const hostAPI: MarkHostAPI = {
    registerPlugin: api.registerPlugin,
    registerPlugins: api.registerPlugins,
    unregisterPlugin: api.unregisterPlugin,
    isPluginDisabled: api.isPluginDisabled,
    React: api.React,
    icons: api.icons,
    i18n: api.i18n,
    stores: api.stores,
    repositories: api.repositories,
    services: api.services,
    fileService: api.fileService,
    ui: api.ui,
    events: api.events,
    toast: api.toast,
    pluginData: api.pluginData,
    generateUUID: api.generateUUID,
  };

  setHostAPI(hostAPI);

  const { registerSlots } = await import('./plugin-slots.ts');
  await registerSlots();
}
