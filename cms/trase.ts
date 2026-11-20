/**
 * Routed trails in the admin (PROMPT_ADMIN.md "Keeping the public site
 * working"). Server-only.
 *
 * "Stale" is never stored: a cached route carries the hash of the points
 * it was computed from (lib/trase.ts kljuc), so moving a point, changing
 * its stage or order, or (un)publishing it makes the stage's route stale
 * the moment the save is published. This module reads that state fresh
 * from the database (never the public cache) and runs the existing
 * recompute (lib/trasiranje.ts) for the »Ponovno izračunaj trase« action.
 */

import type { Endpoint } from "payload";
import { naloziEtapeIzBaze, naloziTockeIzBaze } from "@/lib/data";
import { isOrsConfigured } from "@/lib/ors";
import { isSupabaseWriteConfigured } from "@/lib/supabase";
import { preracunajTrase, stanjeTras, type StanjeGradnika } from "@/lib/trasiranje";
import { getTraseRepo } from "@/lib/traseRepo";
import type { Etapa } from "@/lib/types";
import { osveziTrase } from "@/cms/revalidacija";

export const OZNAKE_STANJA: Record<StanjeGradnika["stanje"], string> = {
  izracunano: "Izračunana",
  zastarelo: "Zastarela",
  ni_izracunano: "Ni izračunana",
  ni_uspelo: "Izračun ni uspel",
};

/** Why recomputing is impossible in this environment, in words an editor can pass on. */
export function oviraZaIzracun(): string | null {
  if (!isOrsConfigured()) {
    return (
      "V tem okolju ni nastavljen ključ ORS_API_KEY, zato tras ni mogoče izračunati. " +
      "Javna stran do takrat zastarele etape riše shematsko (črtkano). Ključ naj doda skrbnik strežnika."
    );
  }
  if (!isSupabaseWriteConfigured()) {
    return (
      "V tem okolju ni nastavljen SUPABASE_SERVICE_ROLE_KEY, zato izračunanih tras ni kam shraniti. " +
      "Ključ naj doda skrbnik strežnika."
    );
  }
  return null;
}

export interface StanjeTrasAdmin {
  etape: Etapa[];
  gradniki: StanjeGradnika[];
}

/** Current state of every stage route and connector, from the database. */
export async function stanjeTrasIzBaze(): Promise<StanjeTrasAdmin> {
  const [etape, points] = await Promise.all([naloziEtapeIzBaze(), naloziTockeIzBaze()]);
  const gradniki = await stanjeTras({ etape, points, repo: getTraseRepo() });
  return { etape, gradniki };
}

/** Same, but a read failure becomes a message to show instead of a crashed admin page. */
export async function stanjeTrasAliNapaka(): Promise<StanjeTrasAdmin | { napaka: string }> {
  try {
    return await stanjeTrasIzBaze();
  } catch (err) {
    return { napaka: err instanceof Error ? err.message : String(err) };
  }
}

export function imeGradnika(g: Pick<StanjeGradnika, "vrsta" | "etapaIds">, etape: Etapa[]): string {
  const ime = (id: string) => {
    const e = etape.find((x) => x.id === id);
    return e ? (e.odsek ? `${e.naziv}: ${e.odsek}` : e.naziv) : id;
  };
  if (g.vrsta === "etapa") return ime(g.etapaIds[0]!);
  const kratko = (id: string) => etape.find((x) => x.id === id)?.naziv ?? id;
  return `Povezava ${kratko(g.etapaIds[0]!)} → ${kratko(g.etapaIds[1]!)}`;
}

/**
 * POST /api/trase/preracunaj — body `{ "vse": true }` recomputes current
 * routes too; by default only stale, missing and failed ones. Any
 * logged-in editor may run it. Refuses up front, with a plain reason, when
 * the ORS key or the route store is missing — never fails silently.
 */
export const preracunajTraseEndpoint: Endpoint = {
  path: "/trase/preracunaj",
  method: "post",
  handler: async (req) => {
    if (!req.user) {
      return Response.json({ napaka: "Za izračun tras se moraš prijaviti." }, { status: 401 });
    }
    const ovira = oviraZaIzracun();
    if (ovira) return Response.json({ napaka: ovira }, { status: 400 });

    let vse = false;
    try {
      vse = Boolean(((await req.json?.()) as { vse?: unknown } | undefined)?.vse);
    } catch {
      // empty body = default
    }

    const [etape, points] = await Promise.all([naloziEtapeIzBaze(), naloziTockeIzBaze()]);
    const rezultati = await preracunajTrase({ etape, points, repo: getTraseRepo(), vse });
    osveziTrase(req);

    const stej = (s: StanjeGradnika["stanje"]) => rezultati.filter((r) => r.stanje === s).length;
    const ustavljeno = rezultati.find((r) => r.stanje !== "izracunano" && r.stanje !== "ni_uspelo" && r.razlog);
    return Response.json({
      izracunanih: stej("izracunano"),
      neuspelih: stej("ni_uspelo"),
      neizvedenih: stej("zastarelo") + stej("ni_izracunano"),
      ustavljeno: ustavljeno?.razlog ?? null,
    });
  },
};
