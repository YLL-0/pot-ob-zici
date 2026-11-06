/**
 * Routed trails — pure logic, no I/O: which points a route goes through,
 * cache keys, staleness, quality warnings, and building the stage ring the
 * public map draws. Server-only (node:crypto).
 *
 * Building blocks (see Trasa in lib/types.ts): each stage's own route, and
 * a connector from each stage's last point to the next stage's first point
 * around the loop (by `stevilka`, the last stage closing back to the
 * first). That is 2 × stages requests for the whole ring; the public map
 * never triggers a routing call.
 *
 * Honesty rule: a part that has no current routed geometry is drawn from
 * the schematic fallback and marked "shematsko" — never passed off as a
 * route.
 */

import { createHash } from "node:crypto";
import { haversineMeters } from "@/lib/geo";
import { ORS_PROFIL } from "@/lib/ors";
import { sortEtape } from "@/lib/etape";
import { isRazsirjeniKrak } from "@/lib/filters";
import type { DelTrase, Obroc, OdsekObroca } from "@/lib/trasaIzris";
import type { Etapa, Pot, Tocka, Trasa } from "@/lib/types";

export { SPOROCILO_IZRACUNANO, SPOROCILO_SHEMATSKO } from "@/lib/trasaIzris";

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
 * only (a route must not lead to a stop the public can't see), and not the
 * "Razširjeni … krak" extended-branch points — those sit kilometres off the
 * loop and stay markers in their stage's colour, not stops on its line
 * (the schematic fallback leaves them out too). Ordered by `zaporedje`,
 * points without one last by ID.
 */
export function tockeTrase(etapaId: string, points: Tocka[]): Tocka[] {
  return points
    .filter((t) => t.etapa === etapaId && t.status === "objavljeno" && !isRazsirjeniKrak(t))
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
 * The stages that make up the loop, in `stevilka` order: those with at
 * least one point on their line. A stage with none has nothing to draw and
 * is stepped over — its neighbours join each other directly.
 */
export function obrocEtap(etape: Etapa[], points: Tocka[]): Etapa[] {
  return sortEtape(etape).filter((e) => tockeTrase(e.id, points).length > 0);
}

/** The stage after `index` around the loop, or null for a loop of one. */
function naslednja<T>(obroc: T[], index: number): T | null {
  return obroc.length < 2 ? null : obroc[(index + 1) % obroc.length]!;
}

/**
 * Every building block for these stages: each stage's own route, plus the
 * connector from each stage to the next one around the loop (the last
 * closing back to the first). With `samoEtape`, limited to those stages
 * and the connectors touching them.
 */
export function vsiGradniki(etape: Etapa[], points: Tocka[], samoEtape?: string[]): Gradnik[] {
  const zadeva = (id: string) => !samoEtape || samoEtape.includes(id);
  const gradniki: Gradnik[] = sortEtape(etape)
    .filter((e) => zadeva(e.id))
    .map((e) => gradnikEtape(e.id, points));
  const obroc = obrocEtap(etape, points);
  obroc.forEach((etapa, i) => {
    const nasl = naslednja(obroc, i);
    if (!nasl || (!zadeva(etapa.id) && !zadeva(nasl.id))) return;
    const g = gradnikPovezave(etapa.id, nasl.id, points);
    if (g) gradniki.push(g);
  });
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
// The ring the public map draws
// ---------------------------------------------------------------------------

/**
 * Gaps up to this size between consecutive parts are routing snap noise
 * (both ends were snapped from the same point): closed in place. Anything
 * larger is bridged with a straight part marked "shematsko".
 */
const STIK_M = 30;

type Coord = [number, number];

const enaka = (a: Coord, b: Coord) => a[0] === b[0] && a[1] === b[1];

function dodaj(deli: DelTrase[], del: DelTrase): void {
  const zadnji = deli.at(-1);
  if (zadnji && zadnji.vrsta === del.vrsta && enaka(zadnji.coordinates.at(-1)!, del.coordinates[0]!)) {
    zadnji.coordinates.push(...del.coordinates.slice(1));
    return;
  }
  deli.push({ vrsta: del.vrsta, coordinates: [...del.coordinates] });
}

/**
 * Appends `del` so that the line stays unbroken from `kazalec` (its
 * current end), and returns the new end.
 */
function prikljuci(deli: DelTrase[], kazalec: Coord, del: DelTrase): Coord {
  const [first] = del.coordinates;
  if (!first) return kazalec;
  let coordinates = del.coordinates;
  if (!enaka(kazalec, first)) {
    const zadnji = deli.at(-1);
    if (haversineMeters(kazalec, first) > STIK_M) {
      dodaj(deli, { vrsta: "shematsko", coordinates: [kazalec, first] });
    } else if (zadnji) {
      // Snap noise: the previous part (whatever its kind) just reaches over.
      zadnji.coordinates.push(first);
    } else {
      coordinates = [kazalec, ...coordinates];
    }
  }
  if (coordinates.length >= 2) dodaj(deli, { vrsta: del.vrsta, coordinates });
  return coordinates.at(-1)!;
}

/** How one stage's own part is drawn, and where it starts and ends. */
interface LastniDel {
  del: DelTrase | null;
  zacetek: Coord;
  konec: Coord;
  /** Starts and ends at the stage's own first/last point, not at a schematic anchor — so a connector fits. */
  priTockah: boolean;
}

function lastniDel(etapa: Etapa, points: Tocka[], vrstice: Trasa[], poti: Pot[], imaPovezavo: boolean): LastniDel {
  const gradnik = gradnikEtape(etapa.id, points);
  const wp = gradnik.waypoints;
  const prva: Coord = [wp[0]!.lon, wp[0]!.lat];
  const pot = poti.find((p) => p.slug === etapa.id);
  const izDatoteke = (c: Coord[]): LastniDel => ({
    del: { vrsta: "shematsko", coordinates: c },
    zacetek: c[0]!,
    konec: c.at(-1)!,
    priTockah: false,
  });

  if (wp.length < 2) {
    // A single-point stage has nothing to route on its own: routed
    // connectors on either side reach the point. With none, its committed
    // schematic file reads better than two straight bridges.
    if (!imaPovezavo && pot) return izDatoteke(pot.geometry.coordinates);
    return { del: null, zacetek: prva, konec: prva, priTockah: true };
  }
  const vrstica = veljavnaGeometrija(gradnik, vrstice);
  if (vrstica) {
    const c = vrstica.geometry!.coordinates;
    return { del: { vrsta: "izracunano", coordinates: c }, zacetek: c[0]!, konec: c.at(-1)!, priTockah: true };
  }
  if (pot) return izDatoteke(pot.geometry.coordinates);
  // A stage created in the admin has no committed schematic file: connect
  // its points directly. Still "shematsko", so never passed off as a route.
  const c = wp.map((p): Coord => [p.lon, p.lat]);
  return { del: { vrsta: "shematsko", coordinates: c }, zacetek: c[0]!, konec: c.at(-1)!, priTockah: true };
}

/**
 * The whole loop, one section per stage. Section n runs from stage n's
 * start to stage n+1's start — its own route, then the way to the next
 * stage — so consecutive sections share their joint exactly and the last
 * closes onto the first. Gaps are closed here, by construction, never in
 * the renderer:
 *
 * - routed stage → routed connector → routed stage: joints are the snapped
 *   positions of the same points; leftover snap noise is closed in place;
 * - a stage drawn from its committed schematic file starts and ends at its
 *   anchors, so it meets its neighbours through straight "shematsko"
 *   bridges instead of a connector (a connector ends at the wrong place).
 */
export function sestaviObroc(etape: Etapa[], points: Tocka[], vrstice: Trasa[], poti: Pot[]): Obroc {
  const obroc = obrocEtap(etape, points);
  const povezava = (od: Etapa | null, doE: Etapa | null) =>
    od && doE ? veljavnaGeometrija(gradnikPovezave(od.id, doE.id, points), vrstice) : null;

  const lastni = obroc.map((etapa, i) => {
    const prejsnja = obroc.length < 2 ? null : obroc[(i - 1 + obroc.length) % obroc.length]!;
    const imaPovezavo = Boolean(povezava(prejsnja, etapa) || povezava(etapa, naslednja(obroc, i)));
    return lastniDel(etapa, points, vrstice, poti, imaPovezavo);
  });

  // A single-point stage has no geometry of its own, so its joint would be
  // the raw point — off the path when the point lies away from it. When the
  // incoming connector is routed, start at that connector's (snapped) end
  // instead, so routed connectors on both sides meet without a bridge.
  lastni.forEach((ta, i) => {
    if (ta.del || obroc.length < 2) return;
    const prejsnja = obroc[(i - 1 + obroc.length) % obroc.length]!;
    if (!lastni[(i - 1 + obroc.length) % obroc.length]!.priTockah) return;
    const konec = povezava(prejsnja, obroc[i]!)?.geometry?.coordinates.at(-1);
    if (konec) {
      ta.zacetek = konec;
      ta.konec = konec;
    }
  });

  const odseki: OdsekObroca[] = obroc.map((etapa, i) => {
    const ta = lastni[i]!;
    const deli: DelTrase[] = [];
    let kazalec = ta.zacetek;
    if (ta.del) kazalec = prikljuci(deli, kazalec, ta.del);

    const nasl = naslednja(obroc, i);
    if (nasl) {
      const naslednji = lastni[(i + 1) % obroc.length]!;
      const vrstica = ta.priTockah && naslednji.priTockah ? povezava(etapa, nasl) : null;
      if (vrstica) kazalec = prikljuci(deli, kazalec, { vrsta: "izracunano", coordinates: vrstica.geometry!.coordinates });
      // End exactly where the next section starts.
      if (!enaka(kazalec, naslednji.zacetek)) {
        prikljuci(deli, kazalec, { vrsta: "shematsko", coordinates: [naslednji.zacetek] });
      }
    }
    return { etapaId: etapa.id, deli };
  });
  return { odseki };
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
