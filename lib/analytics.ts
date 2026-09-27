/**
 * Analytics seam. Currently just console.debug — no analytics provider is
 * wired up yet. The client's grant reporting depends on QR-scan counts, so
 * these calls must exist from day one even though they don't send anywhere.
 *
 * Swap the bodies for a real provider later without touching call sites:
 * app/nmz-[id] redirect calls trackQrScan(id), /tocka/[slug] calls
 * trackPointView(slug).
 */

export function trackQrScan(id: string): void {
  console.debug("[analytics] qr_scan", { id, at: new Date().toISOString() });
}

export function trackPointView(slug: string): void {
  console.debug("[analytics] point_view", { slug, at: new Date().toISOString() });
}
