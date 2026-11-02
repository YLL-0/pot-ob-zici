/**
 * The stage ring as the map draws it — client-safe types and pure helpers
 * (no node:crypto, no I/O). The server builds the ring (lib/trase.ts
 * sestaviObroc) and hands it to the map; the map only picks which
 * sections to show.
 *
 * Model: the stages are consecutive sections of one closed loop. A
 * section belongs to one stage and runs from that stage's first point to
 * the FIRST POINT OF THE NEXT STAGE (the last stage closes back to the
 * first). So stage n always ends exactly where stage n+1 begins, every
 * section is drawn in its own stage's colour, and any run of consecutive
 * selected stages is one unbroken line.
 */

export const SPOROCILO_IZRACUNANO = "Trasa je izračunana po dejanskih poteh. Ni uradno označena pot.";
export const SPOROCILO_SHEMATSKO = "Trase ni bilo mogoče izračunati po poteh — prikazana je shematska povezava.";
export const SPOROCILO_ZICA = "Obroč 1942–43 je ročno postavljen za ponazoritev in ni zgodovinsko potrjen.";

export interface DelTrase {
  /** "shematsko" parts must be drawn dashed and labelled as such. */
  vrsta: "izracunano" | "shematsko";
  coordinates: [number, number][];
}

/** One stage's section of the ring, from its first point to the next stage's first point. */
export interface OdsekObroca {
  etapaId: string;
  /** Contiguous: each part starts exactly where the previous one ends. */
  deli: DelTrase[];
}

/** Sections in ring order (`stevilka`); the last one ends where the first begins. */
export interface Obroc {
  odseki: OdsekObroca[];
}

export type StatusTrase = "izracunano" | "delno" | "shematsko";

/**
 * The sections to draw: all of them with no stage filter, otherwise only
 * the selected stages' sections. Consecutive selected stages stay joined
 * because each section already reaches the next stage's start.
 */
export function vidniOdseki(obroc: Obroc, izbraneEtapaIds: string[] | null): OdsekObroca[] {
  if (!izbraneEtapaIds || izbraneEtapaIds.length === 0) return obroc.odseki;
  return obroc.odseki.filter((o) => izbraneEtapaIds.includes(o.etapaId));
}

/** "delno" = some parts routed, some schematic — labelled with the schematic warning. */
export function statusOdsekov(odseki: OdsekObroca[]): { status: StatusTrase; sporocilo: string } | null {
  const deli = odseki.flatMap((o) => o.deli);
  if (deli.length === 0) return null;
  const imaIzracunano = deli.some((d) => d.vrsta === "izracunano");
  const imaShematsko = deli.some((d) => d.vrsta === "shematsko");
  const status: StatusTrase = imaIzracunano && !imaShematsko ? "izracunano" : imaIzracunano ? "delno" : "shematsko";
  return { status, sporocilo: status === "izracunano" ? SPOROCILO_IZRACUNANO : SPOROCILO_SHEMATSKO };
}

/** All coordinates of these sections, in order (for bounds, length). */
export function koordinateOdsekov(odseki: OdsekObroca[]): [number, number][] {
  return odseki.flatMap((o) => o.deli.flatMap((d) => d.coordinates));
}
