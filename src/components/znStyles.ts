// Class names copied from ZN's element detail panel, so that the reader's
// sheet looks like ZN's own (and only uses classes present in ZN's CSS build).
// Sources: components/common/Accordion.tsx, components/panels/ElementDetail.tsx,
// PropertiesEditor.tsx, TagsEditor.tsx, EventsEditor.tsx.

export const SECTION = 'border-b border-border-default last:border-b-0';
export const SECTION_HEADER = 'w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-bg-secondary transition-colors';
export const SECTION_TITLE = 'text-xs font-semibold text-text-secondary uppercase tracking-wide flex-1';
export const SECTION_BODY = 'px-4 pb-4 pt-1';
export const SECTION_BADGE = 'text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full';

export const LABEL = 'text-xs font-medium text-text-secondary';
export const INPUT =
  'w-full px-3 py-2 text-sm bg-bg-secondary border border-border-default sketchy-border focus:outline-none focus:border-accent input-focus-glow text-text-primary placeholder:text-text-tertiary';
export const INPUT_COMPACT =
  'w-full px-2 py-1 text-xs bg-bg-secondary border border-border-default rounded focus:outline-none focus:border-accent text-text-primary';
export const INPUT_IN_CARD =
  'w-full px-2 py-1 text-xs bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary';
export const HINT = 'text-[10px] text-text-tertiary';
export const SMALL_LABEL = 'text-[10px] font-medium text-text-tertiary uppercase';

export const TAG_CHIP = 'inline-flex items-center gap-1 px-2 py-0.5 bg-bg-tertiary text-text-secondary text-xs rounded group';
export const TYPE_BADGE = 'text-[10px] text-text-tertiary bg-bg-tertiary px-1 py-0.5 rounded';

export const CARD = 'bg-bg-secondary border border-border-default rounded p-2 space-y-2';
export const ICON_BUTTON = 'p-1 text-text-tertiary hover:text-text-secondary focus:outline-none';
export const ICON_BUTTON_ACCENT = 'p-1 text-text-tertiary hover:text-accent focus:outline-none';
export const ICON_BUTTON_DANGER = 'p-1 text-text-tertiary hover:text-error focus:outline-none';
// ZN's common Button (components/common/Button.tsx), size "sm": one primary
// action per form, right-aligned after Cancel.
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 font-medium sketchy-border transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none px-2 py-1 text-xs';
export const BUTTON_PRIMARY_SMALL = `${BUTTON_BASE} text-white bg-accent hover:bg-accent-hover border border-transparent btn-glow`;
export const BUTTON_SECONDARY_SMALL = `${BUTTON_BASE} text-text-primary bg-bg-primary border border-border-default hover:bg-bg-secondary hover:border-border-strong`;
export const BUTTON_GHOST_SMALL = `${BUTTON_BASE} text-text-secondary bg-transparent border-none hover:text-text-primary hover:bg-bg-tertiary`;
export const BUTTON_ROW = 'flex flex-wrap justify-end gap-2';
