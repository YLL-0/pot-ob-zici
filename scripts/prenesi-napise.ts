/**
 * Copies the transcribed inscriptions from data/partizanstvo.json into the
 * `napis` field of each point's PUBLISHED version, so they show on the
 * public site straight away — always with the register attribution
 * (`napis_iz_registra`, default on), which the editor unticks only after
 * checking and correcting the inscription on site.
 *
 *   npm run prenesi:napise            # dry run: prints what would happen
 *   npm run prenesi:napise -- --zapisi
 *
 * Touches only `napis`. Skips, and reports:
 *  - points that already have an inscription (never overwrites);
 *  - points with an unpublished editor draft — Payload builds a publish on
 *    the latest version, so writing would also publish that draft;
 *  - points whose attribution is switched off (the register text must
 *    never appear without the attribution).
 *
 * The public site's cache lives in the Next server, which this script
 * can't reach: the inscriptions appear after the next deploy or when the
 * point is next saved in the admin.
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
  const osnutek: string[] = [];
  const brezNavedbe: string[] = [];
  const neobjavljeno: string[] = [];
  const brezNapisa: string[] = [];
  const manjka: string[] = [];

  for (const [id, { napis }] of Object.entries(gradivo.obelezja)) {
    const besedilo = napis?.trim();
    if (!besedilo) {
      brezNapisa.push(id);
      continue;
    }
    const objavljeno = await payload.findByID({ collection: "tocke", id, draft: false, depth: 0, disableErrors: true });
    if (!objavljeno) {
      manjka.push(id);
      continue;
    }
    if (objavljeno._status !== "published") {
      neobjavljeno.push(id);
      continue;
    }
    const obstojeci = objavljeno.napis?.trim();
    if (obstojeci) {
      (obstojeci === besedilo ? zeEnako : zeDrugacno).push(id);
      continue;
    }
    const zadnja = await payload.findVersions({
      collection: "tocke",
      where: { parent: { equals: id }, latest: { equals: true } },
      depth: 0,
      limit: 1,
    });
    const zadnjaRazlicica = zadnja.docs[0]?.version as { _status?: string; napis?: string | null } | undefined;
    if (zadnjaRazlicica?._status === "draft") {
      osnutek.push(id);
      continue;
    }
    if (objavljeno.napis_iz_registra === false) {
      brezNavedbe.push(id);
      continue;
    }
    if (ZAPISI) {
      // No pending draft, so the latest version is the published one and
      // only `napis` changes. `_status: "published"` keeps it published.
      await payload.update({
        collection: "tocke",
        id,
        data: { napis: besedilo, _status: "published" },
        draft: false,
        depth: 0,
      });
    }
    preneseno.push(id);
  }

  const vrstica = (oznaka: string, ids: string[]) =>
    console.log(`${oznaka} (${ids.length})${ids.length ? ": " + ids.join(", ") : ""}`);
  console.log(
    ZAPISI
      ? "\nZapisano v objavljeno različico (z navedbo registra):"
      : "\nPOSKUSNI ZAGON — nič ni zapisano. Za zapis dodaj --zapisi.",
  );
  vrstica(ZAPISI ? "Preneseno" : "Bi preneslo", preneseno);
  vrstica("Že ima enak napis", zeEnako);
  vrstica("Že ima drugačen napis — ne prepišem", zeDrugacno);
  vrstica("Ima neobjavljen osnutek — preskočeno, da ga ne objavim", osnutek);
  vrstica("Navedba registra izklopljena — preskočeno", brezNavedbe);
  vrstica("Obeležje ni objavljeno — preskočeno", neobjavljeno);
  vrstica("Register nima napisa", brezNapisa);
  if (manjka.length) vrstica("Obeležja ni v bazi", manjka);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
