/**
 * Stage (etapa) helpers and the seed definition of the original 8 stages.
 *
 * Since Phase 4 stages are editable data: the live list comes from
 * lib/data.ts getEtape() (Supabase `etape`, or ETAPE_SEED below when no
 * .env is set). Components receive that list as a prop and resolve colours
 * through getEtapaBarva() — never index ETAPE_SEED directly at runtime,
 * or an editor's rename/recolour would be ignored.
 *
 * ETAPE_SEED is the no-.env fallback, the source scripts/seed.ts inserts
 * from, and what scripts/generate-poti.ts colours the schematic fallback
 * trails with. supabase/migrations/0002_etape_trase.sql inserts the same
 * eight rows once; after that Supabase is the source of truth.
 *
 * Colour hues deliberately avoid the red band (~340°–20°): muted red is the
 * UI's one interactive accent (app/globals.css --color-accent-red) and must
 * stay visually unambiguous from a stage colour.
 */

import type { Etapa } from "@/lib/types";

/** Colour for a point with no (visible) stage. */
export const BARVA_BREZ_ETAPE = "#888888";

const SEED_ROWS: [stevilka: number, odsek: string, barva: string][] = [
  [1, "Loka – Bršljin", "#96582c"],
  [2, "Bršljin – Bučna vas", "#84962c"],
  [3, "Bučna vas – Ragovo", "#2c9661"],
  [4, "Ragovo – Žabja vas", "#2c7c96"],
  [5, "Žabja vas – Gotna vas", "#2c4f96"],
  [6, "Gotna vas – Šmihel", "#582c96"],
  [7, "Šmihel – Drska", "#962c96"],
  [8, "Drska – Loka", "#967c2c"],
];

export const ETAPE_SEED: Etapa[] = SEED_ROWS.map(([stevilka, odsek, barva]) => ({
  id: etapaIdIzStevilke(stevilka),
  stevilka,
  naziv: `Etapa ${stevilka}`,
  odsek,
  barva,
  // Left empty on purpose: a stage description is content, and content is
  // written by the association, never invented (CLAUDE.md rule 1).
  opis: null,
  vidna: true,
  updated_at: null,
  updated_by: null,
}));

/**
 * Stable ID for one of the original numbered stages. Only used to map the
 * Excel's numeric "Etapa" column and legacy `?etapa=3` URLs; stages created
 * in the admin get a slug from their name instead.
 */
export function etapaIdIzStevilke(stevilka: number): string {
  return `etapa-${stevilka}`;
}

export function findEtapa(etape: Etapa[], id: string | null): Etapa | undefined {
  if (id === null) return undefined;
  return etape.find((e) => e.id === id);
}

export function getEtapaBarva(etape: Etapa[], id: string | null): string {
  return findEtapa(etape, id)?.barva ?? BARVA_BREZ_ETAPE;
}

export function sortEtape(etape: Etapa[]): Etapa[] {
  return [...etape].sort((a, b) => a.stevilka - b.stevilka);
}
