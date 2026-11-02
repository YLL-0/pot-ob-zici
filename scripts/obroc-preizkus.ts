/**
 * Offline self-check of the stage ring (Phase 4.3): no ORS key, no cache,
 * no network. Routed rows are synthesised from the points themselves (with
 * a few metres of "snap" offset, as a real routing engine produces), so the
 * construction in lib/trase.ts sestaviObroc can be checked for:
 *
 * - stage n ends exactly where stage n+1 begins, and the last stage closes
 *   onto the first — for schematic, routed and mixed rings;
 * - a run of consecutive selected stages is one unbroken line;
 * - extended-branch points are not stops on a stage's line;
 * - the honest status: routed / partly / schematic.
 *
 *   npm run trase:obroc
 *
 * Exits 1 on the first failed check.
 */

import { getEtape, getPoints, getPoti } from "../lib/data";
import { gradnikEtape, obrocEtap, sestaviObroc, tockeTrase, vsiGradniki, type Gradnik } from "../lib/trase";
import { statusOdsekov, vidniOdseki, type Obroc, type OdsekObroca } from "../lib/trasaIzris";
import { isRazsirjeniKrak } from "../lib/filters";
import type { Trasa } from "../lib/types";

let stevilo = 0;
function preveri(pogoj: boolean, opis: string): void {
  stevilo++;
  if (!pogoj) {
    console.error(`✗ ${opis}`);
    process.exit(1);
  }
  console.log(`✓ ${opis}`);
}

const enaka = (a: [number, number] | undefined, b: [number, number] | undefined) =>
  Boolean(a && b && a[0] === b[0] && a[1] === b[1]);
const zacetek = (o: OdsekObroca) => o.deli[0]?.coordinates[0];
const konec = (o: OdsekObroca) => o.deli.at(-1)?.coordinates.at(-1);

/** Every section non-empty, internally unbroken, and ending where the next begins (closing the loop if `sklenjen`). */
function neprekinjeno(odseki: OdsekObroca[], sklenjen: boolean): boolean {
  for (const o of odseki) {
    if (o.deli.length === 0) return false;
    for (let i = 1; i < o.deli.length; i++) {
      if (!enaka(o.deli[i - 1]!.coordinates.at(-1), o.deli[i]!.coordinates[0])) return false;
    }
  }
  for (let i = 0; i < odseki.length; i++) {
    const nasl = odseki[i + 1] ?? (sklenjen ? odseki[0] : undefined);
    if (nasl && !enaka(konec(odseki[i]!), zacetek(nasl))) return false;
  }
  return true;
}

/** A routed row as an engine would return it: through the waypoints, ends snapped by `odmik` degrees. */
function vrstica(g: Gradnik, odmik: number): Trasa {
  const c = g.waypoints.map((p): [number, number] => [p.lon + odmik, p.lat + odmik]);
  const vmes = c.flatMap((p, i) => (i === 0 ? [p] : [[(c[i - 1]![0] + p[0]) / 2, (c[i - 1]![1] + p[1]) / 2 + 0.0004] as [number, number], p]));
  return {
    id: g.kljuc,
    kljuc: g.kljuc,
    etapa_ids: g.etapaIds,
    geometry: { type: "LineString", coordinates: vmes },
    dolzina_m: 1000,
    trajanje_s: 700,
    engine: "preizkus",
    izracunano_ob: new Date().toISOString(),
    status: "izracunano",
    razlog: null,
    kraki: null,
  };
}

async function main() {
  const [etape, points, poti] = await Promise.all([getEtape(), getPoints(), getPoti()]);
  const obroc = obrocEtap(etape, points);
  const n = obroc.length;

  console.log("\n— Gradniki");
  const naTrasi = etape.flatMap((e) => tockeTrase(e.id, points));
  preveri(naTrasi.every((t) => !isRazsirjeniKrak(t)), "točke razširjenih krakov niso postaje na črti etape");
  preveri(
    points.some((t) => isRazsirjeniKrak(t) && t.etapa !== null),
    "kraki ostanejo točke svoje etape (markerji), le ne na črti",
  );
  const gradniki = vsiGradniki(etape, points);
  const povezave = gradniki.filter((g) => g.vrsta === "povezava");
  preveri(povezave.length === n, `ena povezava na etapo obroča (${povezave.length}/${n}), brez nesosednjih parov`);
  preveri(
    povezave.some((g) => g.etapaIds.join() === `${obroc.at(-1)!.id},${obroc[0]!.id}`),
    `obroč je sklenjen: povezava ${obroc.at(-1)!.id} → ${obroc[0]!.id}`,
  );

  console.log("\n— Brez predpomnilnika (svež klon)");
  const shem = sestaviObroc(etape, points, [], poti);
  preveri(shem.odseki.length === n, `${n} odsekov, en na etapo`);
  preveri(neprekinjeno(shem.odseki, true), "shematski obroč: vsaka etapa se konča, kjer se začne naslednja, 8 → 1 sklenjeno");
  preveri(statusOdsekov(shem.odseki)?.status === "shematsko", "status: shematsko (s sporočilom o shematski povezavi)");

  console.log("\n— Vse izračunano (sintetične vrstice, ~5 m odmika pri pripenjanju)");
  const vse: Trasa[] = gradniki.filter((g) => g.waypoints.length >= 2).map((g) => vrstica(g, g.vrsta === "etapa" ? 0.00003 : 0.00006));
  const izr = sestaviObroc(etape, points, vse, poti);
  preveri(neprekinjeno(izr.odseki, true), "izračunan obroč brez vrzeli, sklenjen");
  preveri(statusOdsekov(izr.odseki)?.status === "izracunano", "status: izračunano (šum pripenjanja ni označen kot shematski)");
  const enoTocko = obroc.find((e) => tockeTrase(e.id, points).length === 1);
  if (enoTocko) {
    const o = izr.odseki.find((x) => x.etapaId === enoTocko.id)!;
    preveri(o.deli.length > 0 && o.deli.every((d) => d.vrsta === "izracunano"), `${enoTocko.id} (ena točka) ima svoj odsek — povezavo do naslednje etape`);
  }

  console.log("\n— Izbira etap 2, 3, 4");
  const izbira = (o: Obroc, ids: string[]) => vidniOdseki(o, ids);
  for (const [ime, o] of [["shematsko", shem], ["izračunano", izr]] as const) {
    const v = izbira(o, ["etapa-4", "etapa-2", "etapa-3"]);
    preveri(v.map((x) => x.etapaId).join() === "etapa-2,etapa-3,etapa-4", `${ime}: trije odseki v vrstnem redu etap, vsak v svoji barvi`);
    preveri(neprekinjeno(v, false), `${ime}: ena neprekinjena črta skozi 2, 3, 4`);
  }
  preveri(vidniOdseki(izr, null).length === n && vidniOdseki(izr, []).length === n, "brez izbire: vse etape");
  preveri(vidniOdseki(izr, ["etapa-2", "etapa-5"]).length === 2, "nesosednji etapi: dva ločena odseka, brez navidezne povezave");

  console.log("\n— Mešano (etapa 3 brez izračuna)");
  const brez3 = vse.filter((v) => !v.etapa_ids.includes("etapa-3"));
  const mes = sestaviObroc(etape, points, brez3, poti);
  preveri(neprekinjeno(mes.odseki, true), "mešan obroč: shematska etapa 3 se stika z izračunanima sosedama");
  preveri(statusOdsekov(vidniOdseki(mes, ["etapa-3"]))?.status === "shematsko", "etapa 3 sama: shematsko");
  preveri(statusOdsekov(vidniOdseki(mes, ["etapa-5"]))?.status === "izracunano", "etapa 5 sama: izračunano");
  preveri(statusOdsekov(mes.odseki)?.status === "delno", "cel obroč: delno (z opozorilom o shematski povezavi)");

  console.log("\n— Zastarela vrstica se ne uporabi");
  const premaknjene = points.map((p) => (p.id === tockeTrase("etapa-5", points)[1]?.id ? { ...p, lat: p.lat + 0.002 } : p));
  const zast = sestaviObroc(etape, premaknjene, vse, poti);
  preveri(gradnikEtape("etapa-5", premaknjene).kljuc !== gradnikEtape("etapa-5", points).kljuc, "premik točke spremeni ključ");
  preveri(statusOdsekov(vidniOdseki(zast, ["etapa-5"]))?.status !== "izracunano", "etapa 5 po premiku ni prikazana kot izračunana");
  preveri(neprekinjeno(zast.odseki, true), "obroč ostane sklenjen");

  console.log(`\nVseh ${stevilo} preverjanj uspešnih.`);
}

void main();
