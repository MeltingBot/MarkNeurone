// ─── Time zone button ────────────────────────────────────────
//
// Discreet zone picker next to a time input, as ZN's TimeZoneButton:
// "Paris" opens a searchable list of IANA zones. No zone means the system
// zone, which is not stored.

import type * as ReactTypes from 'react';
import { getHostAPI } from '../hostAPI.ts';
import { I18N_NS } from '../constants.ts';
import { listTimeZones, systemTimeZone, timeZoneCity } from '../core/timeZones.ts';

const MAX_RESULTS = 60;
const WIDTH = 224;
/** Search field and list (max-h-56). */
const HEIGHT = 272;

export function TimeZoneButton(p: { value: string | undefined; onChange: (timeZone: string | undefined) => void }) {
  const api = getHostAPI();
  const React = api.React as typeof ReactTypes;
  const h = React.createElement;
  const t = (key: string, opts?: Record<string, unknown>) => api.i18n.t(key, { ns: I18N_NS, ...opts });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [query, setQuery] = React.useState('');
  const system = systemTimeZone();
  const current = p.value ?? system;

  const zones = React.useMemo(() => (rect ? listTimeZones() : []), [rect !== null]);
  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '_');
    return (q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones).slice(0, MAX_RESULTS);
  }, [zones, query]);

  const close = () => {
    setRect(null);
    setQuery('');
  };
  const pick = (zone: string | undefined) => {
    p.onChange(zone === system ? undefined : zone);
    close();
  };
  const row = (key: string, label: string, active: boolean, zone: string | undefined) =>
    h('button', {
      key,
      type: 'button',
      onClick: () => pick(zone),
      className: `w-full px-2 py-1 text-left text-xs hover:bg-bg-secondary ${active ? 'text-accent' : 'text-text-primary'}`,
    }, label);

  return h(React.Fragment, null,
    h('button', {
      ref: buttonRef,
      type: 'button',
      onClick: () => (rect ? close() : setRect(buttonRef.current?.getBoundingClientRect() ?? null)),
      className: `shrink-0 px-1 text-[10px] rounded hover:bg-bg-tertiary ${p.value ? 'text-accent' : 'text-text-tertiary'}`,
      title: `${t('time_zone_title')} : ${current}`,
    }, timeZoneCity(current)),
    rect
      ? h(React.Fragment, null,
          h('div', { className: 'fixed inset-0 z-[9998]', onMouseDown: close }),
          h('div', {
            className: 'fixed bg-bg-primary border border-border-default rounded shadow-lg z-[9999]',
            style: {
              // Opens upwards when the list would leave the window.
              ...(rect.bottom + 4 + HEIGHT > window.innerHeight ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
              left: Math.max(8, Math.min(rect.right - WIDTH, window.innerWidth - WIDTH - 8)),
              width: WIDTH,
            },
            onKeyDown: (e: ReactTypes.KeyboardEvent) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                close();
              }
            },
          },
          h('div', { className: 'p-1.5 border-b border-border-default' },
            h('input', {
              autoFocus: true,
              value: query,
              onChange: (e: ReactTypes.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
              placeholder: t('time_zone_search'),
              'aria-label': t('time_zone_search'),
              className: 'w-full px-2 py-1 text-xs rounded border border-border-default bg-bg-primary text-text-primary focus:outline-none focus:border-accent',
            })),
          h('div', { className: 'max-h-56 overflow-y-auto py-1' },
            row('system', t('time_zone_system', { city: timeZoneCity(system) }), !p.value, undefined),
            matches.map((zone) => row(zone, zone.replace(/_/g, ' '), zone === p.value, zone)))))
      : null);
}
