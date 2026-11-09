/**
 * Applies the register coordinates from koordinate_partizanstvo.json to
 * tocke.seed.json, in place (POPRAVKI_2 §1).
 *
 *   npm run apply:koordinate
 *
 * - Matches on `id` only. The register's own name (`vir_naziv`) is printed
 *   for verification, never used for matching.
 * - Refuses to run (writes nothing) if any seed point is missing from the
 *   file, the file names an unknown point, or an id appears twice.
 * - Sets lat/lon, gps_zanesljivost and the gps_vir* source fields, and the
 *   field-verification note (gps_opomba) for the uncertain matches below.
 * - Recomputes the default walking order (`zaporedje`) from the new
 *   positions — the same function the importer uses (lib/zaporedjeEtap.ts),
 *   so a later `npm run import:xlsx` produces the identical file.
 * - Idempotent: a second run reports "brez sprememb" and writes nothing.
 *
 * This is the one sanctioned exception to "tocke.seed.json is written only
 * by the importer": the importer keeps these coordinates from then on (it
 * never overwrites `zunanji_vir` / surveyed positions with the Excel's).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { haversineMeters, formatDistance } from "../lib/geo";
import { dodeliZaporedje } from "../lib/zaporedjeEtap";
import type { GpsZanesljivost, Tocka } from "../lib/types";

const ROOT = join(import.meta.dirname, "..");
const SEED_PATH = join(ROOT, "tocke.seed.json");
const KOORDINATE_PATH = join(ROOT, "koordinate_partizanstvo.json");

interface RegisterZapis {
  id: string;
  naziv: string;
  lat: number;
  lon: number;
  gps_zanesljivost: GpsZanesljivost;
  vir: string;
  vir_id: number;
  vir_url: string;
  vir_naziv: string;
}

/**
 * Matches where the register name does not exactly match the client's
 * name — probable, not certain. Must be checked on site before
 * publication (POPRAVKI_2 §1). These are verification tasks, not
 * historical claims.
 */
const GPS_OPOMBE: Record<string, string> = {
  "NMZ-030":
    "Terensko preveriti: zapis v registru (»Novo mesto, gasilcem«) leži ob pokopališču Ločna, " +
    "naša opomba navaja gasilski dom na Seidlovi cesti. Eno od obojega je napačno.",
  "NMZ-033":
    "Terensko preveriti: na pokopališču Šmihel je več ločenih zapisov v registru tik drug ob drugem. " +
    "Potrditi, da je ta (»Šmihel pokopališče«) skupno obeležje in ne posamezen grob.",
  "NMZ-034":
    "Terensko preveriti: zapis »Valantič, Šmihel« je na pokopališču Šmihel, 45 m od NMZ-033, in ločen " +
    "od NMZ-004 (Valantičeva družina, Kandija). Potrditi, da gre za tri različna obeležja.",
};

const GPS_POLJA = ["gps_vir", "gps_vir_id", "gps_vir_url", "gps_opomba"] as const;

/**
 * Rebuilds a point with the gps_* fields placed right after
 * gps_zanesljivost — the key order the importer writes, so the file does
 * not churn between the two scripts.
 */
function vUrejenemVrstnemRedu(t: Tocka): Tocka {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t)) {
    if ((GPS_POLJA as readonly string[]).includes(k)) continue;
    out[k] = v;
    if (k === "gps_zanesljivost") for (const g of GPS_POLJA) out[g] = t[g] ?? null;
  }
  return out as unknown as Tocka;
}

function main() {
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as Tocka[];
  const zapisi = JSON.parse(readFileSync(KOORDINATE_PATH, "utf-8")) as RegisterZapis[];

  // --- Refuse on any id mismatch --------------------------------------------
  const napake: string[] = [];
  const poId = new Map<string, RegisterZapis>();
  for (const z of zapisi) {
    if (poId.has(z.id)) napake.push(`podvojen ID v ${KOORDINATE_PATH}: ${z.id}`);
    poId.set(z.id, z);
    if (!Number.isFinite(z.lat) || !Number.isFinite(z.lon)) napake.push(`${z.id}: neveljaven lat/lon`);
  }
  const seedIds = new Set(seed.map((t) => t.id));
  for (const t of seed) if (!poId.has(t.id)) napake.push(`${t.id} (${t.naziv}) manjka v koordinate_partizanstvo.json`);
  for (const id of poId.keys()) if (!seedIds.has(id)) napake.push(`${id} ni znana točka v tocke.seed.json`);
  for (const id of Object.keys(GPS_OPOMBE)) if (!seedIds.has(id)) napake.push(`GPS_OPOMBE: neznan ID ${id}`);
  if (napake.length > 0) {
    console.error("✗ Prekinjeno, nič ni zapisano:");
    napake.forEach((n) => console.error(`  - ${n}`));
    process.exit(1);
  }

  // --- Apply -------------------------------------------------------------------
  const prej = new Map(seed.map((t) => [t.id, structuredClone(t)]));
  const nove = seed.map((t) => {
    const z = poId.get(t.id)!;
    return vUrejenemVrstnemRedu({
      ...t,
      lat: z.lat,
      lon: z.lon,
      gps_zanesljivost: z.gps_zanesljivost,
      gps_vir: z.vir,
      gps_vir_id: z.vir_id,
      gps_vir_url: z.vir_url,
      gps_opomba: GPS_OPOMBE[t.id] ?? null,
    });
  });
  dodeliZaporedje(nove);

  // --- Report ------------------------------------------------------------------
  const premiki: string[] = [];
  const ostalo: string[] = [];
  for (const t of nove) {
    const p = prej.get(t.id)!;
    if (p.lat !== t.lat || p.lon !== t.lon) {
      const m = haversineMeters([p.lon, p.lat], [t.lon, t.lat]);
      const register = poId.get(t.id)!.vir_naziv;
      premiki.push(`  ${t.id} · ${t.naziv} · ${formatDistance(m)}${register !== t.naziv ? `   [register: »${register}«]` : ""}`);
    }
    for (const k of ["gps_zanesljivost", ...GPS_POLJA] as const) {
      if (JSON.stringify(p[k] ?? null) !== JSON.stringify(t[k])) ostalo.push(`  ${t.id}.${k}: ${JSON.stringify(p[k] ?? null)} -> ${JSON.stringify(t[k])}`);
    }
  }

  const etapeIds = [...new Set(nove.map((t) => t.etapa).filter((e): e is string => e !== null))].sort();
  const vrstniRedi: string[] = [];
  for (const e of etapeIds) {
    const red = (list: Tocka[]) =>
      list.filter((t) => t.etapa === e).sort((a, b) => (a.zaporedje ?? 0) - (b.zaporedje ?? 0)).map((t) => t.id);
    const a = red([...prej.values()]);
    const b = red(nove);
    if (a.join() !== b.join()) vrstniRedi.push(`  ${e}: ${a.join(" → ")}\n  ${" ".repeat(e.length)}  ${b.join(" → ")}`);
  }

  const kanonicno = JSON.stringify(nove, null, 2) + "\n";
  if (kanonicno === readFileSync(SEED_PATH, "utf-8")) {
    console.log("✓ Brez sprememb — tocke.seed.json že vsebuje koordinate iz registra.");
    return;
  }

  console.log(`Premiki koordinat (${premiki.length}):`);
  premiki.forEach((l) => console.log(l));
  if (vrstniRedi.length > 0) {
    console.log(`\nSpremenjen privzeti vrstni red (zaporedje), ${vrstniRedi.length} etap — prej / zdaj:`);
    vrstniRedi.forEach((l) => console.log(l));
  }
  console.log(`\nOstale spremembe polj: ${ostalo.length}`);
  console.log("\nZa terensko preverjanje (gps_opomba):");
  for (const id of Object.keys(GPS_OPOMBE)) console.log(`  ${id} · ${nove.find((t) => t.id === id)!.naziv}`);

  writeFileSync(SEED_PATH, kanonicno, "utf-8");
  console.log(`\n✓ Zapisano ${nove.length} točk v tocke.seed.json.`);
}

main();
