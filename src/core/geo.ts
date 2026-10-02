// Coordinates typed by the user. No geocoding: the plugin makes no network call.

export interface LatLng {
  lat: number;
  lng: number;
}

/** Decimal degrees; a French decimal comma is accepted. Null when empty or out of range. */
export function parseCoordinate(text: string, limit: 90 | 180): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^-?\d{1,3}(?:\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Math.abs(n) <= limit ? n : null;
}

export function parseLatLng(lat: string, lng: string): LatLng | null {
  const la = parseCoordinate(lat, 90);
  const lo = parseCoordinate(lng, 180);
  return la === null || lo === null ? null : { lat: la, lng: lo };
}

/** Short display, 6 decimals (about 10 cm). */
export function formatCoordinate(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}
