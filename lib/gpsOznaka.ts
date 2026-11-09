/**
 * The honest location caveat for a point, by `gps_zanesljivost`
 * (POPRAVKI_2 §1). One place for the wording, so the map page and the
 * point page cannot drift apart. Never presents a position as surveyed
 * unless the data says it was (CLAUDE.md rule 5).
 */

import type { GpsZanesljivost, Tocka } from "@/lib/types";

type GpsPolja = Pick<Tocka, "gps_zanesljivost" | "gps_vir" | "gps_vir_url" | "gps_opomba">;

export interface GpsOznaka {
  besedilo: string;
  /** Link to the source record, shown next to the text. */
  povezava: { href: string; besedilo: string } | null;
  /** The match to the source record is itself uncertain (gps_opomba set). */
  ujemanjeNepotrjeno: boolean;
}

/** Stronger caveat, kept only for points still on the Excel's approximation. */
export const BESEDILO_PRIBLIZEK = "Lokacija je izhodiščni približek in ni terensko izmerjena.";

export function gpsOznaka(t: GpsPolja): GpsOznaka {
  const ujemanjeNepotrjeno = t.gps_opomba !== null && t.gps_opomba !== undefined;
  switch (t.gps_zanesljivost) {
    case "zunanji_vir":
      return {
        besedilo: `Lokacija iz registra ${t.gps_vir ?? "partizanstvo.si"} — terensko še ni preverjena`,
        povezava: t.gps_vir_url ? { href: t.gps_vir_url, besedilo: "Zapis v registru" } : null,
        ujemanjeNepotrjeno,
      };
    case "terensko-izmerjeno":
      return { besedilo: "Lokacija je terensko izmerjena.", povezava: null, ujemanjeNepotrjeno };
    case "preverjeno-v-gis":
      return { besedilo: "Lokacija je preverjena v GIS.", povezava: null, ujemanjeNepotrjeno };
    case "priblizek":
    default:
      return { besedilo: BESEDILO_PRIBLIZEK, povezava: null, ujemanjeNepotrjeno };
  }
}

/** How many points have each reliability — for the map page notice. */
export function steviloPoZanesljivosti(tocke: Pick<Tocka, "gps_zanesljivost">[]): Record<GpsZanesljivost, number> {
  const out: Record<GpsZanesljivost, number> = {
    priblizek: 0,
    zunanji_vir: 0,
    "terensko-izmerjeno": 0,
    "preverjeno-v-gis": 0,
  };
  for (const t of tocke) out[t.gps_zanesljivost] = (out[t.gps_zanesljivost] ?? 0) + 1;
  return out;
}
