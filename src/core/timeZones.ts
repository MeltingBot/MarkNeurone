// Source time zone of an event's hours (ZN 2.61, `ElementEvent.timeZone`).
//
// The hours typed in the form are a wall clock in that zone; the stored date
// is the instant. Same computation as ZN's utils/dates.ts, which plugins
// cannot import: no zone means the system zone.

interface WallClock { year: number; month: number; day: number; hour: number; minute: number }

const formatters = new Map<string, Intl.DateTimeFormat>();
const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function zonedWallClock(date: Date, timeZone: string): WallClock {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    formatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** `YYYY-MM-DD` and `HH:mm` of an instant in a zone (system zone when none). */
export function dateInputKeys(date: Date, timeZone?: string): { date: string; time: string } {
  if (!timeZone) {
    return { date: `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
  }
  const w = zonedWallClock(date, timeZone);
  return { date: `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`, time: `${pad(w.hour)}:${pad(w.minute)}` };
}

/** Instant whose wall clock in `timeZone` (system zone when none) is the given date and time. */
export function dateFromInputKeys(dateKey: string, timeKey: string, timeZone?: string): Date {
  if (!timeZone) return new Date(`${dateKey}T${timeKey || '00:00'}`);
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, mi] = (timeKey || '00:00').split(':').map(Number);
  const target = Date.UTC(y, m - 1, d, h, mi);
  // Offset of the zone near that instant; a second pass settles DST edges.
  let instant = target;
  for (let i = 0; i < 2; i++) {
    const wall = zonedWallClock(new Date(instant), timeZone);
    instant += target - Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  }
  return new Date(instant);
}

/** System time zone (IANA). */
export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Short place name of a zone: "Asia/Beirut" gives "Beirut". */
export function timeZoneCity(timeZone: string): string {
  return (timeZone.split('/').pop() || timeZone).replace(/_/g, ' ');
}

/** Every IANA zone the browser knows (a short list on older engines). */
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    if (intl.supportedValuesOf) return intl.supportedValuesOf('timeZone');
  } catch {
    // older engines
  }
  return ['UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'Asia/Beirut', 'Asia/Shanghai', 'Asia/Tokyo'];
}
