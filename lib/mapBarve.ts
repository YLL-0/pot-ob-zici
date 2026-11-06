"use client";

/**
 * Design-token colours for MapLibre paint properties. MapLibre can't read
 * CSS variables, so the map resolves them once from app/globals.css at
 * runtime instead of keeping its own hex copies (CLAUDE.md: no arbitrary
 * hex values in components). `@theme static` there guarantees every token
 * is emitted, used by a class or not.
 *
 * Stage colours never come from here — they are data (`etape.barva`).
 */

export type MapZeton = "papir" | "povrsina" | "crnilo" | "poudarek" | "historical";

/** Reads `--color-<ime>` from :root. Call only in the browser (map setup). */
export function barvaZetona(ime: MapZeton): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-${ime}`).trim();
    if (value) return value;
  } catch {
    // Not in a browser — fall through.
  }
  // A missing token is a stylesheet bug; render visibly rather than invisibly.
  return "black";
}
