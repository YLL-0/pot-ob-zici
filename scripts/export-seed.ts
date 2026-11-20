/**
 * Regenerates the zero-config fallback from the database:
 * tocke.seed.json (published points), etape.seed.json (stages) and
 * tocke.seed.meta.json.
 *
 *   npm run export:seed            # write the files
 *   npm run export:seed -- --check # only print what would change; exit 1 if anything would
 *
 * Since the Payload phase the database is the source of truth; the Excel
 * is finished as a source (scripts/import-xlsx.ts only compares now).
 * Run this after a round of edits and commit the result, so a fresh clone
 * with no .env, a build with a paused database, and the QR redirects
 * (proxy.ts reads slugs from tocke.seed.json) all match the live site.
 *
 * Read-only towards the database. Only the published version of each
 * point is exported — drafts never reach the fallback, so they can't leak
 * to the public through it. Rich text is stored as plain text (see
 * lib/cmsMapiranje.ts lexicalVBesedilo); `qr_url` stays empty (derived on
 * read), `odsek` is taken from the point's stage.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Etapa, Tocka } from "../lib/types";
import { etapaIzDokumenta, lexicalVBesedilo, tockaIzDokumenta } from "../lib/cmsMapiranje";
import { isCmsConfigured } from "../lib/cms";

const ROOT = join(import.meta.dirname, "..");
const TOCKE_PATH = join(ROOT, "tocke.seed.json");
const ETAPE_PATH = join(ROOT, "etape.seed.json");
const META_PATH = join(ROOT, "tocke.seed.meta.json");
const CHECK = process.argv.includes("--check");

function beri<T>(pot: string): T[] {
  try {
    return JSON.parse(readFileSync(pot, "utf-8")) as T[];
  } catch {
    return [];
  }
}

function razlike<T extends { id: string }>(ime: string, staro: T[], novo: T[]): string[] {
  const vrstice: string[] = [];
  const stari = new Map(staro.map((x) => [x.id, x]));
  const novi = new Map(novo.map((x) => [x.id, x]));
  for (const [id, n] of novi) {
    const s = stari.get(id);
    if (!s) {
      vrstice.push(`${ime} ${id}: nov`);
      continue;
    }
    for (const k of new Set([...Object.keys(s), ...Object.keys(n)])) {
      const a = JSON.stringify((s as Record<string, unknown>)[k]);
      const b = JSON.stringify((n as Record<string, unknown>)[k]);
      if (a !== b) vrstice.push(`${ime} ${id}.${k}: ${a?.slice(0, 60)} → ${b?.slice(0, 60)}`);
    }
  }
  for (const id of stari.keys()) if (!novi.has(id)) vrstice.push(`${ime} ${id}: ni več objavljen/ne obstaja — odstranjen iz seeda`);
  return vrstice;
}

async function main() {
  if (!isCmsConfigured()) {
    console.error("Manjkata DATABASE_URI in PAYLOAD_SECRET (.env.local) — brez baze ni česa izvoziti.");
    process.exit(1);
  }
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../payload.config")]);
  const payload = await getPayload({ config });

  const etapeDocs = await payload.find({ collection: "etape", sort: "stevilka", depth: 0, limit: 0, pagination: false });
  const etape: Etapa[] = etapeDocs.docs.map(etapaIzDokumenta);
  const odsek = new Map(etape.map((e) => [e.id, e.odsek ?? ""]));

  const tockeDocs = await payload.find({
    collection: "tocke",
    where: { _status: { equals: "published" } },
    draft: false,
    depth: 1,
    limit: 0,
    pagination: false,
  });
  const tocke: Tocka[] = tockeDocs.docs
    .map((d) => tockaIzDokumenta(d, lexicalVBesedilo))
    .map((t) => ({ ...t, odsek: t.etapa ? (odsek.get(t.etapa) ?? "") : "" }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const vse = [
    ...razlike("etapa", beri<Etapa>(ETAPE_PATH), etape),
    ...razlike("točka", beri<Tocka>(TOCKE_PATH), tocke),
  ];
  console.log(`Iz baze: ${etape.length} etap, ${tocke.length} objavljenih točk.`);
  if (vse.length === 0) {
    console.log("✓ Brez sprememb — seed je skladen z bazo.");
    process.exit(0);
  }
  console.log(`Sprememb: ${vse.length}`);
  vse.slice(0, 200).forEach((v) => console.log(`  ${v}`));
  if (vse.length > 200) console.log(`  … in še ${vse.length - 200}`);

  if (CHECK) process.exit(1);

  writeFileSync(ETAPE_PATH, JSON.stringify(etape, null, 2) + "\n", "utf-8");
  writeFileSync(TOCKE_PATH, JSON.stringify(tocke, null, 2) + "\n", "utf-8");
  const meta = { generated_at: new Date().toISOString(), source_file: "baza (Payload)", point_count: tocke.length };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  console.log(`✓ Zapisano: etape.seed.json (${etape.length}), tocke.seed.json (${tocke.length}), tocke.seed.meta.json.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
