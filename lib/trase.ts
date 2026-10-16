/**
 * Routed trails — pure logic, no I/O: which points a route goes through,
 * cache keys, staleness, quality warnings, and composing a route across
 * several selected stages. Server-only (node:crypto).
 *
 * Building blocks (see Trasa in lib/types.ts): each stage's own route, and
 * a connector for every ordered pair of stages (last point of the earlier
 * stage → first point of the later one, by `stevilka`). Any selection of
 * stages is then stage + connector + stage + …, composed on read — 8 stage
 * requests + at most 28 connector requests cover every one of the 255
 * possible selections, and the public map never triggers a routing call.
 *
 * Honesty rule: a part that has no current routed geometry is drawn from
 * the schematic fallback and marked "shematsko" — never passed off as a
 * route.
 */

import { createHash } from "node:crypto";
import { haversineMeters } from "@/lib/geo";
import { ORS_PROFIL } from "@/lib/ors";
import { sortEtape } from "@/lib/etape";
import type { Etapa, Pot, Tocka, Trasa } from "@/lib/types";

export const SPOROCILO_IZRACUNANO = "Trasa je izračunana po dejanskih poteh. Ni uradno označena pot.";
export const SPOROCILO_SHEMATSKO = "Trase ni bilo mogoče izračunati po poteh — prikazana je shematska povezava.";

/** Quality thresholds from the Phase 4 brief. */
export const MEJA_RAZMERJE = 2.5;
export const MEJA_KRAK_M = 3000;
/** Legs shorter than this (straight-line) skip the ratio check — snapping noise dominates. */
const MIN_ZRACNA_ZA_RAZMERJE_M = 50;
/** A point snapped further than this from its coordinates gets a "check the coordinates" warning. */
export const MEJA_ODMIK_M = 100;

type Waypoint = Pick<Tocka, "id" | "lat" | "lon">;

// ---------------------------------------------------------------------------
// Which points, and the cache key
// ---------------------------------------------------------------------------

/**
 * The points a stage's route visits, in walking order: published points
 * only (a route must not lead to a stop the public can't see), ordered by
 * `zaporedje`, points without one last by ID.
 */
export function tockeTrase(etapaId: string, points: Tocka[]): Tocka[] {
  return points
    .filter((t) => t.etapa === etapaId && t.status === "objavljeno")
    .sort(
      (a, b) =>
        (a.zaporedje ?? Number.MAX_SAFE_INTEGER) - (b.zaporedje ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id),
    );
}

/**
 * Hash of everything that determines a route: kind, routing profile, stage
 * IDs and the ordered (id, lat, lon) waypoints. Moving a point, changing
 * its stage or its order, or (un)publishing it changes the key — which is
 * exactly what makes a cached route stale.
 */
function kljuc(vrsta: "etapa" | "povezava", etapaIds: string[], waypoints: Waypoint[]): string {
  const payload = JSON.stringify([1, ORS_PROFIL, vrsta, etapaIds, waypoints.map((p) => [p.id, p.lat, p.lon])]);
  return createHash("sha256").update(payload).digest("hex");
}

export interface Gradnik {
  vrsta: "etapa" | "povezava";
  etapaIds: string[];
  waypoints: Tocka[];
  kljuc: string;
  /**
   * Connectors only: true when the two stages are consecutive in display
   * order. Only those are part of the "natural" walk, so only they get
   * quality warnings — a connector from stage 1 to stage 6 is long by
   * definition.
   */
  sosednji?: boolean;
}

export function gradnikEtape(etapaId: string, points: Tocka[]): Gradnik {
  const waypoints = tockeTrase(etapaId, points);
  return { vrsta: "etapa", etapaIds: [etapaId], waypoints, kljuc: kljuc("etapa", [etapaId], waypoints) };
}

/** Connector from stage `odId` to stage `doId`, or null if either has no points. */
export function gradnikPovezave(odId: string, doId: string, points: Tocka[]): Gradnik | null {
  const od = tockeTrase(odId, points).at(-1);
  const doT = tockeTrase(doId, points)[0];
  if (!od || !doT) return null;
  const waypoints = [od, doT];
  return { vrsta: "povezava", etapaIds: [odId, doId], waypoints, kljuc: kljuc("povezava", [odId, doId], waypoints) };
}

/**
 * Every building block for these stages: each stage's route plus a
 * connector for every ordered pair (by `stevilka`) where both stages have
 * points. With `samoEtape`, connectors are limited to pairs involving one
 * of those stages.
 */
export function vsiGradniki(etape: Etapa[], points: Tocka[], samoEtape?: string[]): Gradnik[] {
  const sorted = sortEtape(etape);
  const zadeva = (id: string) => !samoEtape || samoEtape.includes(id);
  const gradniki: Gradnik[] = sorted.filter((e) => zadeva(e.id)).map((e) => gradnikEtape(e.id, points));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!.id;
      const b = sorted[j]!.id;
      if (!zadeva(a) && !zadeva(b)) continue;
      const g = gradnikPovezave(a, b, points);
      if (g) gradniki.push({ ...g, sosednji: j === i + 1 });
    }
  }
  return gradniki;
}

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------

export type StanjeTrase = "izracunano" | "ni_uspelo" | "zastarelo" | "ni_izracunano";

export function istiEtapaIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** The cached row for this building block's stage list, current or not. */
export function vrsticaZa(gradnik: Pick<Gradnik, "etapaIds">, vrstice: Trasa[]): Trasa | undefined {
  return vrstice
    .filter((v) => istiEtapaIds(v.etapa_ids, gradnik.etapaIds))
    .sort((a, b) => b.izracunano_ob.localeCompare(a.izracunano_ob))[0];
}

export function stanjeGradnika(gradnik: Gradnik, vrstice: Trasa[]): StanjeTrase {
  const vrstica = vrsticaZa(gradnik, vrstice);
  if (!vrstica) return "ni_izracunano";
  if (vrstica.kljuc !== gradnik.kljuc) return "zastarelo";
  return vrstica.status;
}

/** A routed row is usable only if its key matches the current points. */
function veljavnaGeometrija(gradnik: Gradnik | null, vrstice: Trasa[]): Trasa | null {
  if (!gradnik) return null;
  const vrstica = vrstice.find((v) => v.kljuc === gradnik.kljuc);
  return vrstica?.status === "izracunano" && vrstica.geometry ? vrstica : null;
}

// ---------------------------------------------------------------------------
// Quality warnings (for the editor, not the public)
// ---------------------------------------------------------------------------

function fmtM(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`;
}

/**
 * Legs worth a look before anyone walks them: much longer than the
 * straight line (a detour the editor may not expect), longer than 3 km
 * (likely along a road without pavement), or ends that had to be moved far
 * to reach a mapped path (approximate coordinates).
 */
export function opozorilaTrase(trasa: Pick<Trasa, "kraki">): string[] {
  const opozorila: string[] = [];
  const odmiki = new Map<string, number>();
  for (const k of trasa.kraki ?? []) {
    const razmerje = k.dolzina_m / Math.max(k.zracna_m, 1);
    if (k.zracna_m >= MIN_ZRACNA_ZA_RAZMERJE_M && razmerje > MEJA_RAZMERJE) {
      opozorila.push(
        `${k.od_id} → ${k.do_id}: ${fmtM(k.dolzina_m)} po poteh za ${fmtM(k.zracna_m)} zračne razdalje ` +
          `(${razmerje.toFixed(1).replace(".", ",")}×) — preveri vrstni red ali lego točk.`,
      );
    }
    if (k.dolzina_m > MEJA_KRAK_M) {
      opozorila.push(`${k.od_id} → ${k.do_id}: krak je dolg ${fmtM(k.dolzina_m)} — preveri, ali poteka ob cesti brez pločnika.`);
    }
    odmiki.set(k.od_id, Math.max(odmiki.get(k.od_id) ?? 0, k.odmik_od_m));
    odmiki.set(k.do_id, Math.max(odmiki.get(k.do_id) ?? 0, k.odmik_do_m));
  }
  for (const [id, odmik] of odmiki) {
    if (odmik > MEJA_ODMIK_M) {
      opozorila.push(`${id}: najbližja mapirana pot je ${fmtM(odmik)} od koordinat — trasa se konča ob poti, ne pri obeležju.`);
    }
  }
  return opozorila;
}

// ---------------------------------------------------------------------------
// Composing the public route for a selection of stages
// ---------------------------------------------------------------------------

export interface DelTrase {
  /** "shematsko" parts must be drawn dashed and labelled as such. */
  vrsta: "izracunano" | "shematsko";
  coordinates: [number, number][];
}

export interface SestavljenaTrasa {
  etapaIds: string[];
  deli: DelTrase[];
  /** "delno" = some parts routed, some schematic. */
  status: "izracunano" | "delno" | "shematsko";
  sporocilo: string;
  /** Only reported when the whole route is routed — never for schematic geometry. */
  dolzina_m: number | null;
  trajanje_s: number | null;
}

function dodajDel(deli: DelTrase[], del: DelTrase): void {
  if (del.coordinates.length < 2) return;
  const zadnji = deli.at(-1);
  if (zadnji && zadnji.vrsta === del.vrsta) {
    const [first, ...rest] = del.coordinates;
    const konec = zadnji.coordinates.at(-1)!;
    zadnji.coordinates.push(...(konec[0] === first![0] && konec[1] === first![1] ? rest : del.coordinates));
    return;
  }
  deli.push({ vrsta: del.vrsta, coordinates: [...del.coordinates] });
}

function shematskaEtapa(etapaId: string, waypoints: Tocka[], poti: Pot[]): [number, number][] {
  const pot = poti.find((p) => p.slug === etapaId);
  if (pot) return pot.geometry.coordinates;
  // A stage created in the admin has no committed schematic file: connect
  // its points directly. Still marked "shematsko", so never passed off as a route.
  return waypoints.map((p): [number, number] => [p.lon, p.lat]);
}

/**
 * One continuous line across the selected stages, in `stevilka` order:
 * stage, connector, stage, … Parts with a current routed row use it; the
 * rest fall back to the committed schematic line (stages) or a straight
 * connection (connectors), marked "shematsko".
 */
export function sestaviTraso(
  etapaIds: string[],
  etape: Etapa[],
  points: Tocka[],
  vrstice: Trasa[],
  poti: Pot[],
): SestavljenaTrasa {
  const izbrane = sortEtape(etape.filter((e) => etapaIds.includes(e.id)));
  const deli: DelTrase[] = [];
  let dolzina = 0;
  let trajanje = 0;
  let prejsnja: Etapa | null = null;

  for (const etapa of izbrane) {
    const gradnik = gradnikEtape(etapa.id, points);
    if (gradnik.waypoints.length === 0) continue;

    if (prejsnja) {
      const povezava = gradnikPovezave(prejsnja.id, etapa.id, points);
      const vrstica = veljavnaGeometrija(povezava, vrstice);
      if (vrstica) {
        dodajDel(deli, { vrsta: "izracunano", coordinates: vrstica.geometry!.coordinates });
        dolzina += vrstica.dolzina_m ?? 0;
        trajanje += vrstica.trajanje_s ?? 0;
      } else if (povezava) {
        const [a, b] = povezava.waypoints;
        dodajDel(deli, { vrsta: "shematsko", coordinates: [[a!.lon, a!.lat], [b!.lon, b!.lat]] });
      }
    }

    // A single-point stage has nothing to route on its own; inside a
    // multi-stage selection the connectors on either side reach it.
    if (gradnik.waypoints.length >= 2 || izbrane.length === 1) {
      const vrstica = veljavnaGeometrija(gradnik, vrstice);
      if (vrstica) {
        dodajDel(deli, { vrsta: "izracunano", coordinates: vrstica.geometry!.coordinates });
        dolzina += vrstica.dolzina_m ?? 0;
        trajanje += vrstica.trajanje_s ?? 0;
      } else {
        dodajDel(deli, { vrsta: "shematsko", coordinates: shematskaEtapa(etapa.id, gradnik.waypoints, poti) });
      }
    }
    prejsnja = etapa;
  }

  const imaIzracunano = deli.some((d) => d.vrsta === "izracunano");
  const imaShematsko = deli.some((d) => d.vrsta === "shematsko");
  const status = imaIzracunano && !imaShematsko ? "izracunano" : imaIzracunano ? "delno" : "shematsko";
  return {
    etapaIds: izbrane.map((e) => e.id),
    deli,
    status,
    sporocilo: status === "izracunano" ? SPOROCILO_IZRACUNANO : SPOROCILO_SHEMATSKO,
    dolzina_m: status === "izracunano" ? dolzina : null,
    trajanje_s: status === "izracunano" ? trajanje : null,
  };
}

// ---------------------------------------------------------------------------
// Building a row from a routing result
// ---------------------------------------------------------------------------

/** Per-leg figures from a routing result, for storage in `trase.kraki`. */
export function krakiIzRezultata(
  waypoints: Waypoint[],
  segments: { distance: number; duration: number }[],
  geometry: [number, number][],
  wayPoints: number[],
): Trasa["kraki"] {
  const odmik = (i: number) => {
    const snapped = geometry[wayPoints[i] ?? -1];
    const p = waypoints[i]!;
    return snapped ? Math.round(haversineMeters([p.lon, p.lat], snapped)) : 0;
  };
  return segments.map((s, i) => {
    const od = waypoints[i]!;
    const doT = waypoints[i + 1]!;
    return {
      od_id: od.id,
      do_id: doT.id,
      dolzina_m: s.distance,
      trajanje_s: s.duration,
      zracna_m: Math.round(haversineMeters([od.lon, od.lat], [doT.lon, doT.lat])),
      odmik_od_m: odmik(i),
      odmik_do_m: odmik(i + 1),
    };
  });
}
