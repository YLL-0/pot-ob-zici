/**
 * Routed trails from the command line — the routing service before any
 * admin UI exists (Phase 4 step 2).
 *
 *   npm run trase                         state of every stage route and connector, no ORS calls
 *   npm run trase -- --preracunaj         recompute stale / missing / failed routes
 *   npm run trase -- --preracunaj --vse   recompute everything ("Ponovno izračunaj trase")
 *   npm run trase -- --etapa=etapa-6      limit to one stage (+ connectors touching it); repeatable
 *   npm run trase -- --brez-povezav       stage routes only, skip connectors
 *
 * Reads ORS_API_KEY (and Supabase settings, if any) from .env.local.
 * Without Supabase, results go to .cache/trase.json (see lib/traseRepo.ts).
 */

import { preracunajTrase, stanjeTras, type StanjeGradnika } from "../lib/trasiranje";
import { getTraseRepo } from "../lib/traseRepo";
import { isOrsConfigured } from "../lib/ors";
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

async function main() {
  const args = process.argv.slice(2);
  const etapaIds = args.filter((a) => a.startsWith("--etapa=")).map((a) => a.slice("--etapa=".length));
  const moznosti = {
    etapaIds: etapaIds.length > 0 ? etapaIds : undefined,
    vse: args.includes("--vse"),
    brezPovezav: args.includes("--brez-povezav"),
  };

  console.log(`Shramba: ${getTraseRepo().ime} · ORS ključ: ${isOrsConfigured() ? "nastavljen" : "NI nastavljen"}`);

  if (!args.includes("--preracunaj")) {
    let stanja = await stanjeTras();
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
