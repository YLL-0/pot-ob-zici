/**
 * Stage (etapa) helpers and the seed list of stages.
 *
 * Stages are editable data: the live list comes from lib/data.ts
 * getEtape() (Payload `etape`, or ETAPE_SEED below when no .env is set).
 * Components receive that list as a prop and resolve colours through
 * getEtapaBarva() — never index ETAPE_SEED directly at runtime, or an
 * editor's rename/recolour would be ignored.
 *
 * ETAPE_SEED is etape.seed.json: the no-.env fallback, and what
 * scripts/generate-poti.ts colours the schematic fallback trails with.
 * Like tocke.seed.json it is generated, never hand-edited — since the
 * Payload phase by scripts/export-seed.ts from the database (the original
 * eight stages were moved into Payload by scripts/migrate-to-payload.ts).
 *
 * The UI accent (app/(frontend)/globals.css --color-poudarek) is a very dark green,
 * used for emphasis only; stage colours are mid-tone and never that dark,
 * so a stage chip never reads as the accent.
 */

import etapeSeed from "@/etape.seed.json";
import type { Etapa } from "@/lib/types";

/** Colour for a point with no (visible) stage. */
export const BARVA_BREZ_ETAPE = "#888888";

export const ETAPE_SEED: Etapa[] = etapeSeed;

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

/** "Etapa 2, Etapa 3 in Etapa 5" */
function nastej(deli: string[]): string {
  return deli.length < 2 ? (deli[0] ?? "") : `${deli.slice(0, -1).join(", ")} in ${deli[deli.length - 1]}`;
}

/**
 * The stage selection in words, above the list (POPRAVKI_3 §3), with the
 * verb agreeing in number: "Prikazana je Etapa 3: Bučna vas – Ragovo
 * (7 obeležij)", "Prikazani sta …", "Prikazane so …", "Prikazanih je 5 etap: …".
 * `izbrane` in stage order; `steviloTock` = points shown.
 */
export function opisIzbireEtap(izbrane: Etapa[], steviloTock: number): string {
  const n = izbrane.length;
  const tock = `(${stevnikObelezij(steviloTock)})`;
  const e = izbrane[0];
  if (n === 1 && e) {
    return `Prikazana je ${e.naziv}${e.odsek ? `: ${e.odsek}` : ""} ${tock}`;
  }
  const imena = nastej(izbrane.map((e) => e.naziv));
  if (n === 2) return `Prikazani sta ${imena} ${tock}`;
  if (n <= 4) return `Prikazane so ${imena} ${tock}`;
  return `Prikazanih je ${n} etap: ${imena} ${tock}`;
}
