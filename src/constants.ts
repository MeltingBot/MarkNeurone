// ─── MarkNeurone Constants ───────────────────────────────────

export const PLUGIN_ID = 'mark-neurone';
export const I18N_NS = 'markNeurone';

declare const __MN_VERSION__: string;
export const MN_PLUGIN_VERSION: string =
  typeof __MN_VERSION__ !== 'undefined' ? __MN_VERSION__ : '0.1.0';
