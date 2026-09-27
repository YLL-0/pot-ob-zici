/**
 * External-maps fallback for "Pelji me tja" — always available, works with
 * geolocation denied, no API key. The in-app ORS walking route is Phase 3;
 * this link must keep working once that exists too.
 */
export function getGoogleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
}

export function getAppleMapsUrl(lat: number, lon: number): string {
  return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=w`;
}
