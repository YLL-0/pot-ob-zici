/**
 * Why routed trails might not appear — as distinct, named conditions, so a
 * deployment that silently shows straight lines is impossible to miss.
 * Server-only. Reported on server start (instrumentation.ts) and by
 * `npm run trase`.
 *
 * - NI_ORS_KLJUCA: ORS_API_KEY is not set. Routes cannot be (re)computed
 *   here. Harmless on the public site when routes are already stored —
 *   the site never calls ORS for trails — but nothing new can be routed.
 * - NI_TRAJNE_SHRAMBE: no Supabase and no committed files in data/trase/.
 *   There is nowhere durable to read routes from, so every stage is drawn
 *   schematically ("Trase ni bilo mogoče izračunati po poteh").
 */

import { isOrsConfigured } from "@/lib/ors";
import { isSupabaseConfigured } from "@/lib/supabase";
import { imaShranjeneDatoteke } from "@/lib/traseRepo";

export type KodaPogoja = "NI_ORS_KLJUCA" | "NI_TRAJNE_SHRAMBE";

export interface PogojTras {
  koda: KodaPogoja;
  sporocilo: string;
}

export function diagnozaTras(): PogojTras[] {
  const pogoji: PogojTras[] = [];
  if (!isOrsConfigured()) {
    pogoji.push({
      koda: "NI_ORS_KLJUCA",
      sporocilo:
        "ORS_API_KEY ni nastavljen — tras tu ni mogoče izračunati. Javna stran prikaže že shranjene trase, " +
        "novih ali zastarelih ne more popraviti.",
    });
  }
  if (!isSupabaseConfigured() && !imaShranjeneDatoteke()) {
    pogoji.push({
      koda: "NI_TRAJNE_SHRAMBE",
      sporocilo:
        "Ni Supabase in ni datotek v data/trase/ — vse etape bodo prikazane shematsko (ravne črte). " +
        "Popravek: npm run trase -- --preracunaj --zapisi-v-repo in commit data/trase/.",
    });
  }
  return pogoji;
}

/** Where routes are read from, for logs. */
export function opisShrambe(): string {
  if (isSupabaseConfigured()) return "Supabase (tabela trase)";
  if (imaShranjeneDatoteke()) return "datoteke v data/trase/";
  return "nobena (shematski prikaz)";
}
