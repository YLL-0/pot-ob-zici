/**
 * Storage for cached routes (table `trase`). Server-only.
 *
 * - Supabase configured: the `trase` table. Reads use the anon client (RLS
 *   lets the public read routes); writes need SUPABASE_SERVICE_ROLE_KEY
 *   and only ever happen from server code (admin actions, `npm run trase`).
 * - No Supabase: a local JSON file, .cache/trase.json (gitignored), so the
 *   routing service can be run and tested before a Supabase project
 *   exists. A fresh clone has no such file and shows the schematic
 *   fallback, as the brief requires. Not for production — serverless
 *   file systems are read-only.
 *
 * One row per building block: saving a route deletes older rows for the
 * same `etapa_ids`, so "the" row for a stage is unambiguous.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseClient, getSupabaseServiceClient, isSupabaseConfigured } from "@/lib/supabase";
import { istiEtapaIds } from "@/lib/trase";
import type { Trasa } from "@/lib/types";

export type NovaTrasa = Omit<Trasa, "id">;

export interface TraseRepo {
  /** Human-readable name of the backing store, for logs. */
  ime: string;
  vse(): Promise<Trasa[]>;
  shrani(trasa: NovaTrasa): Promise<void>;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function pgArray(ids: string[]): string {
  return `{${ids.map((id) => `"${id}"`).join(",")}}`;
}

const supabaseRepo: TraseRepo = {
  ime: "Supabase (trase)",
  async vse() {
    const { data, error } = await getSupabaseClient().from("trase").select("*");
    if (error) throw new Error(`Napaka pri branju tras iz Supabase: ${error.message}`);
    return (data ?? []) as Trasa[];
  },
  async shrani(trasa) {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase.from("trase").upsert(trasa, { onConflict: "kljuc" });
    if (error) throw new Error(`Napaka pri zapisu trase v Supabase: ${error.message}`);
    const { error: deleteError } = await supabase
      .from("trase")
      .delete()
      .filter("etapa_ids", "eq", pgArray(trasa.etapa_ids))
      .neq("kljuc", trasa.kljuc);
    if (deleteError) throw new Error(`Napaka pri brisanju starih tras: ${deleteError.message}`);
  },
};

// ---------------------------------------------------------------------------
// Local file (no Supabase)
// ---------------------------------------------------------------------------

const DATOTEKA = join(process.cwd(), ".cache", "trase.json");

function preberiDatoteko(): Trasa[] {
  try {
    return JSON.parse(readFileSync(DATOTEKA, "utf-8")) as Trasa[];
  } catch {
    return []; // no file yet = nothing computed = schematic fallback
  }
}

const datotekaRepo: TraseRepo = {
  ime: ".cache/trase.json",
  async vse() {
    return preberiDatoteko();
  },
  async shrani(trasa) {
    const ostale = preberiDatoteko().filter(
      (v) => v.kljuc !== trasa.kljuc && !istiEtapaIds(v.etapa_ids, trasa.etapa_ids),
    );
    mkdirSync(dirname(DATOTEKA), { recursive: true });
    writeFileSync(DATOTEKA, JSON.stringify([...ostale, { id: randomUUID(), ...trasa }], null, 1) + "\n", "utf-8");
  },
};

export function getTraseRepo(): TraseRepo {
  return isSupabaseConfigured() ? supabaseRepo : datotekaRepo;
}
