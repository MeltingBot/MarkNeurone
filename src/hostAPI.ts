// ─── Host API Bridge ──────────────────────────────────────────
//
// Provides access to ZN APIs at runtime. Populated by register(api)
// in plugin-external.ts (external mode) or by initMarkNeurone()
// (workspace mode). MN source files import from here instead of
// ZN directly. Type-only imports from ZN are kept as-is
// (stripped at build).

import type { i18n as I18nInstance } from 'i18next';

/**
 * Runtime contract: what MarkNeurone needs from ZeroNeurone.
 *
 * Stores are Zustand hooks (callable as React hooks + .getState() / .subscribe()).
 * Repositories expose async query methods.
 */
export interface MarkHostAPI {
  // ─── Plugin registration ──────────────────────────────────
  registerPlugin: (slot: string, extension: any, pluginId?: string) => void;
  registerPlugins: (slot: string, extensions: any[], pluginId?: string) => void;
  unregisterPlugin: (slot: string, predicate: (ext: any) => boolean) => void;
  isPluginDisabled: (id: string) => boolean;

  // ─── Host version and capabilities (ZN 2.62 and later) ────
  version?: string;
  features?: {
    /** Source fields show Markdown links */
    sourceLinks?: boolean;
    /** Slot `source:scheme` */
    sourceSchemes?: boolean;
    /** pluginData.shareKeys / list / onRemoteChange (ZN 2.63 and later) */
    sharedPluginData?: boolean;
  };

  // ─── i18n ─────────────────────────────────────────────────
  i18n: I18nInstance;

  // ─── React & Icons ────────────────────────────────────────
  React: any;
  icons: any;

  // ─── Zustand stores ───────────────────────────────────────
  stores: {
    useDossierStore: any;
    useSelectionStore: any;
    useViewStore: any;
    useReportStore: any;
    useTagSetStore: any;
    useTabStore: any;
    useUIStore: any;
  };

  // ─── Dexie repositories ───────────────────────────────────
  repositories: {
    dossierRepository: any;
    elementRepository: any;
    linkRepository: any;
  };

  // ─── Services ─────────────────────────────────────────────
  services: {
    exportDossier: (dossierId: string) => Promise<Blob>;
    importDossier: (blob: Blob, options?: ImportDossierOptions) => Promise<ImportDossierResult>;
    importJSON: (jsonString: string, targetDossierId: string) => Promise<ImportJSONResult>;
    navigateTo: (path: string) => void;
  };

  // ─── ZN components (absent from ZN versions before the 'ui' API) ──
  ui?: {
    openGeoPicker: (
      initial?: { lat: number; lng: number },
      options?: { query?: string },
    ) => Promise<{ lat: number; lng: number } | null>;
  };

  // ─── Files ────────────────────────────────────────────────
  fileService: {
    /** Decrypted content of a dossier asset. */
    getAssetFile: (asset: { id: string; hash: string; filename: string; mimeType: string }) => Promise<File>;
    /** Assets of any dossier, open or not (import hook). */
    getAssetsByDossier: (dossierId: string) => Promise<{ id: string; hash: string; filename: string }[]>;
  };

  // ─── Event bus ────────────────────────────────────────────
  events: {
    on: (type: string, cb: (event: PluginEvent) => void) => () => void;
  };

  // ─── Toast notifications ──────────────────────────────────
  toast: {
    success: (msg: string, options?: ToastOptions) => string;
    error: (msg: string, options?: ToastOptions) => string;
    warning: (msg: string, options?: ToastOptions) => string;
    info: (msg: string, options?: ToastOptions) => string;
    dismiss: (id: string) => void;
  };

  // ─── Plugin data persistence ──────────────────────────────
  pluginData: {
    get: (dossierId: string, key: string) => Promise<any>;
    set: (dossierId: string, key: string, value: any) => Promise<void>;
    remove: (dossierId: string, key: string) => Promise<void>;
    getGlobal: (key: string) => Promise<any>;
    setGlobal: (key: string, value: any) => Promise<void>;
    removeGlobal: (key: string) => Promise<void>;
    /** Entries of a dossier whose key starts with `prefix` (ZN 2.63 and later). */
    list?: (dossierId: string, prefix: string) => Promise<{ key: string; value: any }[]>;
    /** Keys with these prefixes are shared with the dossier's members (ZN 2.63 and later). */
    shareKeys?: (prefixes: string[]) => void;
    /** A member changed a shared key; Dexie is already up to date (ZN 2.63 and later). */
    onRemoteChange?: (cb: (change: { dossierId: string; key: string; deleted: boolean }) => void) => () => void;
  };

  // ─── Utilities ────────────────────────────────────────────
  generateUUID: () => string;
}

// ─── Supporting types ─────────────────────────────────────────

export interface ImportDossierOptions {
  targetDossierId?: string;
  positionOffset?: { x: number; y: number };
  suffix?: string;
  replace?: boolean;
}

export interface ImportDossierResult {
  success: boolean;
  elementsImported: number;
  linksImported: number;
  assetsImported: number;
  errors: string[];
  warnings: string[];
  dossierId: string;
}

export interface ImportJSONResult {
  success: boolean;
  elementsImported: number;
  linksImported: number;
  assetsImported: number;
  errors: string[];
  warnings: string[];
}

export interface PluginEvent {
  type: string;
  dossierId: string;
  entityId?: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface ToastOptions {
  duration?: number;
  id?: string;
}

// ─── Singleton ──────────────────────────────────────────────

let _api: MarkHostAPI | null = null;

/** Set the host API reference. Must be called once before any MN code runs. */
export function setHostAPI(api: MarkHostAPI): void {
  _api = api;
}

/** Get the host API. Throws if not yet initialized. */
export function getHostAPI(): MarkHostAPI {
  if (!_api) throw new Error('MarkNeurone: hostAPI not initialized. Call setHostAPI() first.');
  return _api;
}
