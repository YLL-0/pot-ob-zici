/**
 * Pushes tocke.seed.json into Supabase. Idempotent (upsert on `id`) and
 * safe to re-run: a row that has been edited in Supabase more recently
 * than the seed file was generated (tocke.seed.meta.json's generated_at)
 * is skipped with a warning instead of overwritten — once content is in
 * Supabase, Supabase is the source of truth, not the spreadsheet snapshot.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server
 * only — this script never runs in the browser).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSupabaseServiceClient } from "../lib/supabase";
import type { Tocka } from "../lib/types";

const ROOT = join(import.meta.dirname, "..");

interface Meta {
  generated_at: string;
  source_file: string;
  point_count: number;
}

function loadSeed(): Tocka[] {
  return JSON.parse(readFileSync(join(ROOT, "tocke.seed.json"), "utf-8")) as Tocka[];
}

function loadMeta(): Meta | null {
  try {
    return JSON.parse(readFileSync(join(ROOT, "tocke.seed.meta.json"), "utf-8")) as Meta;
  } catch {
    return null;
  }
}

async function main() {
  const points = loadSeed();
  const meta = loadMeta();
  if (!meta) {
    console.warn(
      "⚠ tocke.seed.meta.json ne obstaja (zaženi najprej `npm run import:xlsx`). " +
        "Nadaljujem brez zaščite pred prepisom novejših vrstic — bodi previden.",
    );
  }
  const importedAt = meta ? new Date(meta.generated_at) : null;

  const supabase = getSupabaseServiceClient();

  const { data: existingRows, error: fetchError } = await supabase.from("tocke").select("id, updated_at");
  if (fetchError) {
    throw new Error(`Napaka pri branju obstoječih vrstic: ${fetchError.message}`);
  }
  const existingUpdatedAt = new Map((existingRows ?? []).map((r) => [r.id as string, r.updated_at as string | null]));

  const toUpsert: Tocka[] = [];
  let skipped = 0;

  for (const point of points) {
    const dbUpdatedAt = existingUpdatedAt.get(point.id);
    if (importedAt && dbUpdatedAt && new Date(dbUpdatedAt) > importedAt) {
      console.warn(`⚠ Preskočeno ${point.id}: vrstica v bazi (updated_at ${dbUpdatedAt}) je novejša od uvoza.`);
      skipped++;
      continue;
    }
    // qr_url is derived, never stored.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { qr_url, ...row } = point;
    toUpsert.push({ ...row, qr_url: "" } as Tocka);
  }

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase.from("tocke").upsert(toUpsert, { onConflict: "id" });
    if (upsertError) {
      throw new Error(`Napaka pri pisanju v Supabase: ${upsertError.message}`);
    }
  }

  console.log(`✓ Zapisanih/posodobljenih ${toUpsert.length} točk, preskočenih ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
