/**
 * QR shortlink derivation. `qr_url` is never stored — it's always a
 * function of the current base URL and the point's ID, so a domain change
 * never leaves stale links behind. Mirrors the Excel "Nastavitve" sheet's
 * "Osnovni URL QR" cell, which is the same kind of single-source setting.
 */

const DEFAULT_BASE_URL = "https://novomestovzici.si";

export function getBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function getQrUrl(id: string): string {
  return `${getBaseUrl()}/${id.toLowerCase()}`;
}
