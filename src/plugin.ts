// ─── MarkNeurone Plugin Entry Point (Workspace Mode) ─────────
//
// Workspace-mode entry point for development:
//   1. Imports ZN APIs directly (available in monorepo)
//   2. Populates the hostAPI bridge
//   3. Calls the shared registerSlots()
//
// For external plugin mode, see plugin-external.ts.

import { pluginAPI as _pluginAPI } from 'zeroneurone-app/src/plugins/pluginAPI.ts';
import {
  registerPlugin as _registerPlugin,
  registerPlugins as _registerPlugins,
  unregisterPlugin as _unregisterPlugin,
} from 'zeroneurone-app/src/plugins/pluginRegistry.ts';
import _i18n from 'zeroneurone-app/src/i18n.ts';
import { useDossierStore as _useDossierStore } from 'zeroneurone-app/src/stores/index.ts';
import { useSelectionStore as _useSelectionStore } from 'zeroneurone-app/src/stores/index.ts';
import { useViewStore as _useViewStore } from 'zeroneurone-app/src/stores/index.ts';
import {
  dossierRepository as _dossierRepository,
  elementRepository as _elementRepository,
  linkRepository as _linkRepository,
} from 'zeroneurone-app/src/db/repositories/index.ts';
import { generateUUID as _generateUUID } from 'zeroneurone-app/src/utils/index.ts';

import { setHostAPI } from './hostAPI.ts';
import { PLUGIN_ID } from './constants.ts';
import { registerSlots } from './plugin-slots.ts';

export async function initMarkNeurone(): Promise<void> {
  // In workspace mode, pluginAPI.pluginData uses the raw (unscoped)
  // signature: get(pluginId, dossierId, key). Our hostAPI expects
  // the scoped signature: get(dossierId, key). Adapter below.
  const rawPD = _pluginAPI.pluginData;
  const scopedPluginData = {
    get: (dossierId: string, key: string) => rawPD.get(PLUGIN_ID, dossierId, key),
    set: (dossierId: string, key: string, value: any) => rawPD.set(PLUGIN_ID, dossierId, key, value),
    remove: (dossierId: string, key: string) => rawPD.remove(PLUGIN_ID, dossierId, key),
    getGlobal: (key: string) => rawPD.getGlobal(PLUGIN_ID, key),
    setGlobal: (key: string, value: any) => rawPD.setGlobal(PLUGIN_ID, key, value),
    removeGlobal: (key: string) => rawPD.removeGlobal(PLUGIN_ID, key),
  };

  setHostAPI({
    registerPlugin: _registerPlugin as any,
    registerPlugins: _registerPlugins as any,
    unregisterPlugin: _unregisterPlugin as any,
    isPluginDisabled: _pluginAPI.isPluginDisabled,
    version: _pluginAPI.version,
    features: _pluginAPI.features,
    i18n: _i18n,
    React: _pluginAPI.React,
    icons: _pluginAPI.icons,
    stores: {
      useDossierStore: _useDossierStore,
      useSelectionStore: _useSelectionStore,
      useViewStore: _useViewStore,
      useReportStore: _pluginAPI.stores?.useReportStore,
      useTagSetStore: _pluginAPI.stores?.useTagSetStore,
      useTabStore: _pluginAPI.stores?.useTabStore,
      useUIStore: _pluginAPI.stores?.useUIStore,
    },
    repositories: {
      dossierRepository: _dossierRepository,
      elementRepository: _elementRepository,
      linkRepository: _linkRepository,
    },
    services: _pluginAPI.services,
    fileService: _pluginAPI.fileService as any,
    ui: _pluginAPI.ui,
    events: _pluginAPI.events as any,
    toast: _pluginAPI.toast,
    pluginData: scopedPluginData,
    generateUUID: _generateUUID,
  });

  await registerSlots();
}
