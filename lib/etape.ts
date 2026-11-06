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
 * The UI accent (app/globals.css --color-poudarek) is a very dark green,
 * used for emphasis only; stage colours are mid-tone and never that dark,
 * so a stage chip never reads as the accent.
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
  [8, "Drska – Loka", "#836d26"],
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

function relativnaSvetlost(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const kanal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255);
}

/**
 * Text colour for a label on a stage-coloured fill (an active stage chip):
 * whichever of white or the ink token gives the higher WCAG contrast, so
 * any colour an editor picks stays readable.
 */
export function besediloNaBarvi(barva: string): "svetlo" | "temno" {
  const L = relativnaSvetlost(barva);
  const zBelo = 1.05 / (L + 0.05);
  const zCrnilom = (L + 0.05) / 0.0619; // --color-crnilo, L ≈ 0.0119
  return zBelo >= zCrnilom ? "svetlo" : "temno";
}

/** Slovenian plural: 1 obeležje, 2 obeležji, 3–4 obeležja, 5+ obeležij. */
export function stevnikObelezij(n: number): string {
  const ostanek = n % 100;
  if (ostanek === 1) return `${n} obeležje`;
  if (ostanek === 2) return `${n} obeležji`;
  if (ostanek === 3 || ostanek === 4) return `${n} obeležja`;
  return `${n} obeležij`;
}
