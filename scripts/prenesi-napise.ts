/**
 * Copies the transcribed inscriptions from data/partizanstvo.json into the
 * `napis` field of each point — AS A DRAFT, never published. The public
 * site keeps showing the published version until an editor checks the
 * inscription on site and publishes the point.
 *
 *   npm run prenesi:napise            # dry run: prints what would happen
 *   npm run prenesi:napise -- --zapisi
 *
 * Never overwrites: a point whose latest version (draft or published)
 * already has an inscription is skipped, so an editor's correction is safe
 * and re-running is harmless. The draft is based on the latest version, so
 * an editor's unpublished draft keeps its other changes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isCmsConfigured } from "../lib/cms";

const ROOT = join(import.meta.dirname, "..");
const ZAPISI = process.argv.includes("--zapisi");

interface Gradivo {
  obelezja: Record<string, { napis: string | null }>;
}

async function main() {
  if (!isCmsConfigured()) {
    console.error("Manjkata DATABASE_URI in PAYLOAD_SECRET (.env.local) — brez baze ni kam prenesti.");
    process.exit(1);
  }
  const gradivo = JSON.parse(readFileSync(join(ROOT, "data/partizanstvo.json"), "utf8")) as Gradivo;

  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../payload.config")]);
  const payload = await getPayload({ config });

  const preneseno: string[] = [];
  const zeEnako: string[] = [];
  const zeDrugacno: string[] = [];
  const brezNapisa: string[] = [];
  const manjka: string[] = [];

  for (const [id, { napis }] of Object.entries(gradivo.obelezja)) {
    const besedilo = napis?.trim();
    if (!besedilo) {
      brezNapisa.push(id);
      continue;
    }
    // draft: true -> the latest version, which may be a newer draft.
    const doc = await payload.findByID({ collection: "tocke", id, draft: true, depth: 0, disableErrors: true });
    if (!doc) {
      manjka.push(id);
      continue;
    }
    const obstojeci = doc.napis?.trim();
    if (obstojeci) {
      (obstojeci === besedilo ? zeEnako : zeDrugacno).push(id);
      continue;
    }
    if (ZAPISI) {
      // No _status in data + draft: true -> saved as a new draft version;
      // the published document (what the public site reads) is untouched.
      await payload.update({ collection: "tocke", id, data: { napis: besedilo }, draft: true, depth: 0 });
    }
    preneseno.push(id);
  }

  const vrstica = (oznaka: string, ids: string[]) =>
    console.log(`${oznaka} (${ids.length})${ids.length ? ": " + ids.join(", ") : ""}`);
  console.log(ZAPISI ? "\nZapisano kot osnutek, nič ni objavljeno:" : "\nPOSKUSNI ZAGON — nič ni zapisano. Za zapis dodaj --zapisi.");
  vrstica(ZAPISI ? "Preneseno" : "Bi preneslo", preneseno);
  vrstica("Že ima enak napis", zeEnako);
  vrstica("Že ima drugačen napis — ne prepišem", zeDrugacno);
  vrstica("Register nima napisa", brezNapisa);
  if (manjka.length) vrstica("Obeležja ni v bazi", manjka);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
