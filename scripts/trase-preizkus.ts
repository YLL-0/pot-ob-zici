/**
 * Self-check for the routing service (Phase 4 step 2) — the brief's
 * acceptance criteria that can be tested before any UI exists:
 *
 * - a stale route is never served; moving a point or changing the order
 *   makes the stage stale, and recomputing produces different geometry;
 * - several stages compose into one continuous route, in stage order;
 * - a routing failure is cached with a reason and falls back to the
 *   schematic line, marked as such — never a silent straight line;
 * - a missing key writes nothing.
 *
 *   npm run trase:preizkus
 *
 * Works on an in-memory copy of the current cache (run `npm run trase --
 * --preracunaj` first), so the real cache is never touched. Costs 3 ORS
 * requests. Exits 1 on the first failed check.
 */

import { getEtape, getPoints, getPoti } from "../lib/data";
import { preracunajTrase } from "../lib/trasiranje";
import { gradnikEtape, sestaviTraso, stanjeGradnika, SPOROCILO_IZRACUNANO, SPOROCILO_SHEMATSKO } from "../lib/trase";
import { getTraseRepo, type TraseRepo } from "../lib/traseRepo";
import { haversineMeters } from "../lib/geo";
import { randomUUID } from "node:crypto";
import type { Tocka, Trasa } from "../lib/types";

let stevilo = 0;
function preveri(pogoj: boolean, opis: string): void {
  stevilo++;
  if (!pogoj) {
    console.error(`✗ ${opis}`);
    process.exit(1);
  }
  console.log(`✓ ${opis}`);
}

function pomnilniskiRepo(zacetek: Trasa[]): TraseRepo & { vrstice: Trasa[] } {
  const repo = {
    ime: "pomnilnik",
    vrstice: structuredClone(zacetek),
    async vse() {
      return structuredClone(repo.vrstice);
    },
    async shrani(t: Omit<Trasa, "id">) {
      const ista = (v: Trasa) => v.etapa_ids.join() === t.etapa_ids.join();
      repo.vrstice = [...repo.vrstice.filter((v) => v.kljuc !== t.kljuc && !ista(v)), { id: randomUUID(), ...t }];
    },
  };
  return repo;
}

const geometrija = (repo: { vrstice: Trasa[] }, etapaId: string) =>
  JSON.stringify(repo.vrstice.find((v) => v.etapa_ids.join() === etapaId)?.geometry ?? null);

function premakni(points: Tocka[], id: string, lat: number, lon: number): Tocka[] {
  return points.map((p) => (p.id === id ? { ...p, lat, lon } : p));
}

async function main() {
  const [etape, points, poti, vrstice] = await Promise.all([getEtape(), getPoints(), getPoti(), getTraseRepo().vse()]);
  const potrebne = ["etapa-2", "etapa-3", "etapa-4", "etapa-5", "etapa-6", "etapa-8"];
  if (!potrebne.every((id) => vrstice.some((v) => v.etapa_ids.join() === id && v.status === "izracunano"))) {
    console.error("Najprej izračunaj trase: npm run trase -- --preracunaj");
    process.exit(1);
  }

  console.log("\n— Ključi (brez zahtevkov)");
  const k = (pts: Tocka[]) => gradnikEtape("etapa-5", pts).kljuc;
  const osnova = k(points);
  preveri(k(premakni(points, "NMZ-006", 45.797, 15.157)) !== osnova, "premik točke spremeni ključ etape");
  preveri(
    k(points.map((p) => (p.id === "NMZ-005" ? { ...p, zaporedje: 4 } : p.id === "NMZ-006" ? { ...p, zaporedje: 3 } : p))) !== osnova,
    "sprememba vrstnega reda spremeni ključ",
  );
  preveri(k(points.map((p) => (p.id === "NMZ-006" ? { ...p, etapa: "etapa-6" } : p))) !== osnova, "sprememba etape spremeni ključ");
  preveri(k(points.map((p) => (p.id === "NMZ-006" ? { ...p, status: "osnutek" } : p))) !== osnova, "umik objave spremeni ključ");
  preveri(k(premakni(points, "NMZ-001", 45.79, 15.16)) === osnova, "premik točke druge etape ključa ne spremeni");

  console.log("\n— Sestavljanje (brez zahtevkov)");
  const e5 = sestaviTraso(["etapa-5"], etape, points, vrstice, poti);
  preveri(e5.status === "izracunano" && e5.sporocilo === SPOROCILO_IZRACUNANO, "etapa 5: izračunana, z oznako »ni uradno označena pot«");

  const tri = sestaviTraso(["etapa-4", "etapa-2", "etapa-3"], etape, points, vrstice, poti);
  preveri(tri.status === "izracunano" && tri.deli.length === 1, "etape 2+3+4: ena neprekinjena izračunana črta");
  preveri(tri.etapaIds.join() === "etapa-2,etapa-3,etapa-4", "etape so v vrstnem redu po številki, ne po izbiri");
  const prva = points.filter((p) => p.etapa === "etapa-2").sort((a, b) => a.zaporedje! - b.zaporedje!)[0]!;
  const zadnja = points.filter((p) => p.etapa === "etapa-4").sort((a, b) => b.zaporedje! - a.zaporedje!)[0]!;
  const crta = tri.deli[0]!.coordinates;
  preveri(
    haversineMeters([prva.lon, prva.lat], crta[0]!) < 400 && haversineMeters([zadnja.lon, zadnja.lat], crta.at(-1)!) < 400,
    `začne pri ${prva.id} in konča pri ${zadnja.id}`,
  );
  const vsota = ["etapa-2", "etapa-2,etapa-3", "etapa-3", "etapa-3,etapa-4", "etapa-4"]
    .map((id) => vrstice.find((v) => v.etapa_ids.join() === id)!.dolzina_m!)
    .reduce((a, b) => a + b, 0);
  preveri(Math.abs((tri.dolzina_m ?? 0) - vsota) < 1, "dolžina = 3 etape + 2 povezavi");

  const e7 = sestaviTraso(["etapa-7"], etape, points, vrstice, poti);
  preveri(e7.status === "shematsko" && e7.sporocilo === SPOROCILO_SHEMATSKO && e7.dolzina_m === null, "etapa 7 sama: shematska, s sporočilom, brez dolžine");
  const e678 = sestaviTraso(["etapa-6", "etapa-7", "etapa-8"], etape, points, vrstice, poti);
  preveri(e678.status === "izracunano" && e678.deli.length === 1, "etape 6+7+8: etapo 7 (ena točka) dosežeta povezavi");

  console.log("\n— Zastarelost in ponovni izračun (2 zahtevka)");
  const repo = pomnilniskiRepo(vrstice);
  const premaknjene = premakni(points, "NMZ-006", 45.7975, 15.1545); // ~150 m from its seed position
  const g5 = gradnikEtape("etapa-5", premaknjene);
  preveri(stanjeGradnika(g5, repo.vrstice) === "zastarelo", "po premiku je etapa 5 zastarela");
  const zast = sestaviTraso(["etapa-5"], etape, premaknjene, repo.vrstice, poti);
  preveri(zast.status === "shematsko", "zastarela trasa se javno ne prikaže — namesto nje shematska");
  const prej = geometrija(repo, "etapa-5");
  await preracunajTrase({ etape, points: premaknjene, repo, etapaIds: ["etapa-5"], brezPovezav: true });
  preveri(stanjeGradnika(g5, repo.vrstice) === "izracunano", "po ponovnem izračunu je etapa 5 izračunana");
  preveri(geometrija(repo, "etapa-5") !== prej, "nova geometrija se razlikuje od prejšnje");
  preveri(repo.vrstice.filter((v) => v.etapa_ids.join() === "etapa-5").length === 1, "stara vrstica etape je odstranjena");

  const zamenjane = points.map((p) =>
    p.id === "NMZ-004" ? { ...p, zaporedje: 1 } : p.id === "NMZ-007" ? { ...p, zaporedje: 2 } : p,
  );
  const repo2 = pomnilniskiRepo(vrstice);
  const prej2 = geometrija(repo2, "etapa-5");
  await preracunajTrase({ etape, points: zamenjane, repo: repo2, etapaIds: ["etapa-5"], brezPovezav: true });
  preveri(geometrija(repo2, "etapa-5") !== prej2, "sprememba vrstnega reda (NMZ-004 ↔ NMZ-007) da drugačno traso");

  console.log("\n— Neuspeh (1 zahtevek)");
  const repo3 = pomnilniskiRepo(vrstice);
  const vMorju = premakni(points, "NMZ-006", 45.3, 13.2); // Adriatic — no path within 350 m
  const [r] = await preracunajTrase({ etape, points: vMorju, repo: repo3, etapaIds: ["etapa-5"], brezPovezav: true });
  preveri(r?.stanje === "ni_uspelo" && (r.razlog ?? "").includes("NMZ-006"), `neuspeh je shranjen z razlogom: »${r?.razlog}«`);
  const pad = sestaviTraso(["etapa-5"], etape, vMorju, repo3.vrstice, poti);
  preveri(pad.status === "shematsko" && pad.deli.every((d) => d.vrsta === "shematsko"), "ob neuspehu: shematska črta, označena kot shematska");

  console.log("\n— Brez ključa (brez zahtevkov)");
  const kljuc = process.env.ORS_API_KEY;
  delete process.env.ORS_API_KEY;
  const repo4 = pomnilniskiRepo(vrstice);
  const [r4] = await preracunajTrase({ etape, points: premaknjene, repo: repo4, etapaIds: ["etapa-5"], brezPovezav: true });
  process.env.ORS_API_KEY = kljuc;
  preveri(JSON.stringify(repo4.vrstice) === JSON.stringify(vrstice) && r4?.stanje === "zastarelo", "brez ključa se nič ne zapiše, etapa ostane zastarela");

  console.log(`\nVseh ${stevilo} preverjanj uspešnih.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
