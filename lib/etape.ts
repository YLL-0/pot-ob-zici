/**
 * The single source of truth for stage (etapa) colours. Shared by
 * scripts/generate-poti.ts (writes it into each etapa-N.geojson's `barva`
 * property) and, from Phase 1, the map markers, trail lines and side-panel
 * rows — one colour per stage, not one per story theme, so the map stays
 * readable (see project decision log: colour = etapa, icon = vrsta).
 *
 * Hues deliberately avoid the red band (~340°–20°): muted red is the UI's
 * one interactive accent (app/globals.css --color-accent-red) and must
 * stay visually unambiguous from a stage colour.
 */

export const ETAPA_BARVE: Record<number, string> = {
  1: "#96582c",
  2: "#84962c",
  3: "#2c9661",
  4: "#2c7c96",
  5: "#2c4f96",
  6: "#582c96",
  7: "#962c96",
  8: "#967c2c",
};

export const ETAPA_ODSEKI: Record<number, string> = {
  1: "Loka – Bršljin",
  2: "Bršljin – Bučna vas",
  3: "Bučna vas – Ragovo",
  4: "Ragovo – Žabja vas",
  5: "Žabja vas – Gotna vas",
  6: "Gotna vas – Šmihel",
  7: "Šmihel – Drska",
  8: "Drska – Loka",
};

export function getEtapaBarva(etapa: number): string {
  return ETAPA_BARVE[etapa] ?? "#888888";
}
