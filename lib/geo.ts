/**
 * Small geo helpers. Distances computed here are for display only (trail
 * length, "approximate walking time") — never presented as surveyed, same
 * rule as the coordinates themselves.
 */

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** Total length of a LineString, in metres. */
export function lineLengthMeters(coordinates: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += haversineMeters(coordinates[i - 1]!, coordinates[i]!);
  }
  return total;
}

/** "1,2 km" / "850 m" — Slovenian decimal comma. */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(meters)} m`;
}

/** Rough walking-time estimate at ~4.5 km/h, rounded to 5 minutes. */
export function estimateWalkingMinutes(meters: number): number {
  const minutes = (meters / 1000 / 4.5) * 60;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
