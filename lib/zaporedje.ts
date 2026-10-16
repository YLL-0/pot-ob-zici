/**
 * Default walking order of the points within a stage (`Tocka.zaporedje`).
 *
 * Only a sensible starting point for the routing engine — the editor
 * confirms or fixes the order in the admin. Two passes:
 *
 * 1. Initial order: scalar projection onto the stage's direction (from one
 *    anchor to the next, data/sidrisca.json) — the same ordering
 *    scripts/generate-poti.ts uses, so the stage keeps its walking sense.
 *    Without a direction (a stage created in the admin), ID order.
 * 2. 2-opt on the open path (straight-line distance), which removes the
 *    east–west zig-zag a pure projection produces in dense clusters such
 *    as the old town (stage 8: 1212 m → 1040 m). Endpoints may move.
 *
 * Deterministic: the same input always yields the same order, so
 * re-running the importer never reshuffles anything by itself.
 */

import { haversineMeters } from "@/lib/geo";

export interface ZaporedjeTocka {
  id: string;
  lat: number;
  lon: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

function legMeters(a: ZaporedjeTocka, b: ZaporedjeTocka): number {
  return haversineMeters([a.lon, a.lat], [b.lon, b.lat]);
}

function pathMeters(path: ZaporedjeTocka[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += legMeters(path[i - 1]!, path[i]!);
  return total;
}

export function orderByProjection<T extends ZaporedjeTocka>(points: T[], start: LatLon, end: LatLon): T[] {
  const dx = end.lon - start.lon;
  const dy = end.lat - start.lat;
  const project = (p: T) => (p.lon - start.lon) * dx + (p.lat - start.lat) * dy;
  return [...points].sort((a, b) => project(a) - project(b) || a.id.localeCompare(b.id));
}

/** First-improvement 2-opt for an open path. Fine for ≤ ~50 points. */
function twoOpt<T extends ZaporedjeTocka>(path: T[]): T[] {
  let best = path;
  let bestLen = pathMeters(best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const len = pathMeters(candidate);
        // 1 cm tolerance so floating-point noise can't cause endless swaps.
        if (len < bestLen - 0.01) {
          best = candidate;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Returns the points' IDs in default walking order. */
export function privzetoZaporedje(points: ZaporedjeTocka[], smer?: { start: LatLon; end: LatLon }): string[] {
  const initial = smer
    ? orderByProjection(points, smer.start, smer.end)
    : [...points].sort((a, b) => a.id.localeCompare(b.id));
  return twoOpt(initial).map((p) => p.id);
}
