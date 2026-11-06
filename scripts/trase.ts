/**
 * Routed trails from the command line — the routing service before any
 * admin UI exists.
 *
 *   npm run trase                         state of every stage route and connector, no ORS calls
 *   npm run trase -- --preracunaj         recompute stale / missing / failed routes
 *   npm run trase -- --preracunaj --vse   recompute everything ("Ponovno izračunaj trase")
 *   npm run trase -- --etapa=etapa-6      limit to one stage (+ connectors touching it); repeatable
 *   npm run trase -- --brez-povezav       stage routes only, skip connectors
 *   npm run trase -- --preracunaj --zapisi-v-repo
 *                                         write results to data/trase/ (committed files)
 *
 * Flags also work without the `--` separator (`npm run trase --preracunaj`):
 * npm then passes them as npm_config_* variables, which are read too.
 *
 * Reads ORS_API_KEY (and Supabase settings, if any) from .env.local. Results
 * go to Supabase when configured; with --zapisi-v-repo they go to
 * data/trase/ instead. Without Supabase, --zapisi-v-repo is required — there
 * is no other durable store (see lib/traseRepo.ts).
 */

import { preracunajTrase, stanjeTras, type StanjeGradnika } from "../lib/trasiranje";
import { getRepoDatoteke, getTraseRepo } from "../lib/traseRepo";
import { diagnozaTras } from "../lib/traseDiagnoza";
import { isSupabaseConfigured } from "../lib/supabase";
import { formatDistance, formatMinutes } from "../lib/geo";

const OZNAKE: Record<StanjeGradnika["stanje"], string> = {
  izracunano: "✓ izračunano",
  ni_uspelo: "✗ ni uspelo",
  zastarelo: "↻ zastarelo",
  ni_izracunano: "· ni izračunano",
};

function vrstica(s: StanjeGradnika): string {
  const ime = s.vrsta === "etapa" ? s.etapaIds[0]! : `${s.etapaIds[0]} → ${s.etapaIds[1]}`;
  const dolzina =
    s.dolzina_m !== null && s.trajanje_s !== null
      ? `${formatDistance(s.dolzina_m)}, ${formatMinutes(Math.round(s.trajanje_s / 60))}`
      : "";
  const lines = [`  ${ime.padEnd(20)} ${OZNAKE[s.stanje].padEnd(16)} ${dolzina}`];
  if (s.razlog) lines.push(`      razlog: ${s.razlog}`);
  for (const o of s.opozorila) lines.push(`      ⚠ ${o}`);
  return lines.join("\n");
}

function povzetek(stanja: StanjeGradnika[]): void {
  const etape = stanja.filter((s) => s.vrsta === "etapa");
  const povezave = stanja.filter((s) => s.vrsta === "povezava");
  console.log("\nEtape:");
  etape.forEach((s) => console.log(vrstica(s)));
  if (povezave.length > 0) {
    const poStanju = (st: StanjeGradnika["stanje"]) => povezave.filter((s) => s.stanje === st).length;
    console.log(
      `\nPovezave med etapami (${povezave.length}): ${poStanju("izracunano")} izračunanih, ` +
        `${poStanju("zastarelo")} zastarelih, ${poStanju("ni_izracunano")} neizračunanih, ${poStanju("ni_uspelo")} neuspelih.`,
    );
    povezave
      .filter((s) => s.stanje === "ni_uspelo" || s.stanje === "zastarelo" || s.opozorila.length > 0)
      .forEach((s) => console.log(vrstica(s)));
  }
}

const args = process.argv.slice(2);

/** A boolean flag, given as `-- --ime` or as `npm run trase --ime` (npm_config_ime). */
function zastavica(ime: string): boolean {
  const env = process.env[`npm_config_${ime.replace(/-/g, "_")}`];
  return args.includes(`--${ime}`) || (env !== undefined && env !== "" && env !== "false");
}

async function main() {
  const etapaIds = args.filter((a) => a.startsWith("--etapa=")).map((a) => a.slice("--etapa=".length));
  if (etapaIds.length === 0 && process.env.npm_config_etapa) etapaIds.push(process.env.npm_config_etapa);
  const vRepo = zastavica("zapisi-v-repo");
  const repo = vRepo ? getRepoDatoteke() : getTraseRepo();
  const preracunaj = zastavica("preracunaj");
  const moznosti = {
    etapaIds: etapaIds.length > 0 ? etapaIds : undefined,
    vse: zastavica("vse"),
    brezPovezav: zastavica("brez-povezav"),
    repo,
  };

  console.log(`Shramba: ${repo.ime}`);
  const pogoji = diagnozaTras();
  for (const p of pogoji) console.log(`⚠ ${p.koda}: ${p.sporocilo}`);
  if (pogoji.length === 0) console.log("✓ ORS ključ je nastavljen, trajna shramba obstaja.");

  if (preracunaj && !vRepo && !isSupabaseConfigured()) {
    console.error(
      "\n✗ Supabase ni nastavljen, zato rezultatov ni kam trajno shraniti. " +
        "Dodaj --zapisi-v-repo (zapiše v data/trase/, nato commit) ali nastavi Supabase.",
    );
    process.exit(1);
  }
  if (preracunaj && pogoji.some((p) => p.koda === "NI_ORS_KLJUCA")) {
    console.error("\n✗ Brez ORS_API_KEY ni mogoče računati. Nastavi ga v .env.local.");
    process.exit(1);
  }

  if (!preracunaj) {
    let stanja = await stanjeTras({ repo });
    if (moznosti.etapaIds) stanja = stanja.filter((s) => s.etapaIds.some((id) => moznosti.etapaIds!.includes(id)));
    if (moznosti.brezPovezav) stanja = stanja.filter((s) => s.vrsta === "etapa");
    povzetek(stanja);
    return;
  }

  let obdelani = 0;
  const stanja = await preracunajTrase({
    ...moznosti,
    onNapredek: () => {
      obdelani++;
      process.stdout.write(`\r  ${obdelani} obdelanih …`);
    },
  });
  process.stdout.write("\n");
  povzetek(stanja);
  if (vRepo) console.log("\nZapisano v data/trase/. Preglej in commitaj te datoteke, da jih dobi objavljena stran.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
