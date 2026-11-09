/**
 * Default `zaporedje` for every point that has a stage — shared by
 * scripts/import-xlsx.ts and scripts/apply-koordinate.ts so both produce the
 * same order from the same coordinates.
 *
 * All points of the stage are included (extended-branch points too —
 * client decision, Phase 4). The walking direction of a numbered stage runs
 * from its anchor to the next one (data/sidrisca.json, a closed loop of 8 —
 * same convention as scripts/generate-poti.ts).
 *
 * Node-only (reads a file); used by scripts, never by the app.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ETAPE_SEED } from "@/lib/etape";
import { privzetoZaporedje, type LatLon } from "@/lib/zaporedje";
import type { Tocka } from "@/lib/types";

const SIDRISCA_PATH = join(import.meta.dirname, "..", "data", "sidrisca.json");

/** Overwrites `zaporedje` in place for all points with a known seed stage. */
export function dodeliZaporedje(points: Tocka[]): void {
  const sidrisca = (JSON.parse(readFileSync(SIDRISCA_PATH, "utf-8")) as { sidrisca: LatLon[] }).sidrisca;
  for (const etapa of ETAPE_SEED) {
    const start = sidrisca[etapa.stevilka - 1];
    const end = sidrisca[etapa.stevilka % sidrisca.length];
    const smer = start && end ? { start, end } : undefined;
    const vEtapi = points.filter((p) => p.etapa === etapa.id);
    privzetoZaporedje(vEtapi, smer).forEach((id, i) => {
      vEtapi.find((p) => p.id === id)!.zaporedje = i + 1;
    });
  }
}
