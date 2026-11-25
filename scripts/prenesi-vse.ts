/**
 * »Prenesi iz registra« for every memorial at once, then PUBLISH — the same
 * steps as the admin button (cms/prenosRegistra.ts → korakPrenosa), run from
 * the command line with the Local API.
 *
 *   npm run prenesi:vse
 *
 * Per memorial: import every register photo (one step per photo), fill the
 * empty `napis` / `dostop`, attach the photos (one draft version), then
 * publish that draft.
 *
 * Idempotent and resumable: photos are matched on `vir_url` + file name,
 * texts are only written into empty fields, and a memorial whose latest
 * version is already published is left as it is. Re-run after an
 * interruption and it continues where it stopped.
 *
 * Never publishes an editor's own work: before the import and again before
 * publishing, a pending draft must differ from the published version ONLY
 * by what the register transfer adds (empty napis/dostop filled with the
 * register text, register photos appended). Otherwise the memorial is
 * skipped and reported. Memorials that were never published stay that way.
 *
 * The public site's cache lives in the Next server: changes show after the
 * next deploy (or when the memorial is next saved in the admin).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Payload, PayloadRequest } from "payload";
import type { Media, Tocke } from "../payload-types";
import type { GradivoRegistra } from "../cms/partizanstvo";
import type { KorakKonec } from "../cms/prenosRegistra";
import { isCmsConfigured, isMediaStorageConfigured } from "../lib/cms";

const ROOT = join(import.meta.dirname, "..");

type Izid =
  | "objavljeno"
  | "brez-sprememb"
  | "osnutek-urednika"
  | "ni-objavljeno"
  | "ni-v-bazi"
  | "napaka";

interface Porocilo {
  id: string;
  izid: Izid;
  vrstica: string;
}

function mediaId(ref: unknown): number | null {
  if (typeof ref === "number") return ref;
  if (ref && typeof ref === "object" && "id" in ref) return Number((ref as { id: unknown }).id);
  return null;
}

/** Stable JSON (sorted keys) for comparing two versions. */
function stabilno(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabilno).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stabilno((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

const PRENOS_POLJA = new Set(["napis", "napis_iz_registra", "dostop", "fotografije"]);
const SISTEMSKA_POLJA = new Set(["updatedAt", "createdAt", "_status"]);

/**
 * Null when the pending draft differs from the published version only by
 * what the register transfer writes; otherwise the reason it doesn't.
 */
function tujeSpremembe(
  objavljeno: Tocke,
  osnutek: Tocke,
  g: GradivoRegistra,
  registrskeFotografije: Set<number>,
): string | null {
  const o = objavljeno as unknown as Record<string, unknown>;
  const d = osnutek as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(o), ...Object.keys(d)])) {
    if (PRENOS_POLJA.has(k) || SISTEMSKA_POLJA.has(k)) continue;
    if (stabilno(o[k]) !== stabilno(d[k])) return `polje »${k}«`;
  }

  const besedilo = (k: "napis" | "dostop", izRegistra: string | null) => {
    const prej = objavljeno[k]?.trim() || null;
    const zdaj = osnutek[k]?.trim() || null;
    return zdaj === prej || (!prej && zdaj === (izRegistra?.trim() || null));
  };
  if (!besedilo("napis", g.napis)) return "polje »napis«";
  if (!besedilo("dostop", g.dostop)) return "polje »dostop«";
  const napisSpremenjen = (objavljeno.napis?.trim() || null) !== (osnutek.napis?.trim() || null);
  if (!napisSpremenjen && Boolean(objavljeno.napis_iz_registra) !== Boolean(osnutek.napis_iz_registra)) {
    return "polje »napis_iz_registra«";
  }

  const prej = (objavljeno.fotografije ?? []).map(mediaId);
  const zdaj = (osnutek.fotografije ?? []).map(mediaId);
  const ohranjene = prej.every((id, i) => zdaj[i] === id);
  const dodane = zdaj.slice(prej.length).every((id) => id !== null && registrskeFotografije.has(id));
  if (!ohranjene || !dodane) return "polje »fotografije«";
  return null;
}

async function stanje(payload: Payload, req: PayloadRequest, id: string) {
  const objavljeno = (await payload.findByID({
    collection: "tocke",
    id,
    draft: false,
    depth: 0,
    disableErrors: true,
    req,
  })) as Tocke | null;
  const zadnja = (await payload.findByID({
    collection: "tocke",
    id,
    draft: true,
    depth: 0,
    disableErrors: true,
    req,
  })) as Tocke | null;
  return { objavljeno, zadnja };
}

async function registrskeFotografije(payload: Payload, req: PayloadRequest, virUrl: string): Promise<Set<number>> {
  const { docs } = await payload.find({
    collection: "media",
    where: { vir_url: { equals: virUrl } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { vir_url: true },
    req,
  });
  return new Set((docs as Pick<Media, "id">[]).map((m) => m.id));
}

async function main() {
  if (!isCmsConfigured()) {
    console.error("Manjkata DATABASE_URI in PAYLOAD_SECRET (.env.local) — brez baze ni kam prenesti.");
    process.exit(1);
  }
  if (!isMediaStorageConfigured()) {
    console.error("Shramba fotografij ni nastavljena (S3_* v .env.local) — fotografij ne bi bilo mogoče uvoziti.");
    process.exit(1);
  }

  const [{ getPayload, createLocalReq }, { default: config }, prenos, partizanstvo] = await Promise.all([
    import("payload"),
    import("../payload.config"),
    import("../cms/prenosRegistra"),
    import("../cms/partizanstvo"),
  ]);
  const payload = await getPayload({ config });
  const req = await createLocalReq({}, payload);

  const gradivo = JSON.parse(readFileSync(join(ROOT, "data/partizanstvo.json"), "utf8")) as {
    obelezja: Record<string, unknown>;
  };
  const idji = Object.keys(gradivo.obelezja).sort();
  const porocila: Porocilo[] = [];
  let shrambaPolna = false;

  for (const id of idji) {
    const g = partizanstvo.gradivoZaTocko(id);
    const zapisi = (izid: Izid, vrstica: string) => {
      porocila.push({ id, izid, vrstica });
      console.log(`${id}  ${vrstica}`);
    };
    try {
      if (!g) {
        zapisi("ni-v-bazi", "ni zapisa iz registra");
        continue;
      }
      const pred = await stanje(payload, req, id);
      if (!pred.zadnja) {
        zapisi("ni-v-bazi", "obeležja ni v bazi");
        continue;
      }
      if (pred.objavljeno?._status !== "published") {
        zapisi("ni-objavljeno", "obeležje še ni bilo objavljeno — ne objavljam ga (preskočeno)");
        continue;
      }
      if (pred.zadnja._status === "draft") {
        const razlog = tujeSpremembe(pred.objavljeno, pred.zadnja, g, await registrskeFotografije(payload, req, g.vir_url));
        if (razlog) {
          zapisi("osnutek-urednika", `ima neobjavljen osnutek urednika (${razlog}) — preskočeno, da ga ne objavim`);
          continue;
        }
      }

      // Import photos one step at a time, then »konec«.
      const preskoci: string[] = [];
      const neuspele: string[] = [];
      let uvozenih = 0;
      let konec: KorakKonec;
      for (;;) {
        const korak = await prenos.korakPrenosa(req, { id, preskoci, zakljuci: shrambaPolna });
        if (korak.korak === "konec") {
          konec = korak;
          break;
        }
        if (korak.uvozena) {
          uvozenih++;
          process.stdout.write(`${id}  fotografija ${uvozenih} uvožena (še ${korak.preostalo})\r`);
        }
        if (korak.preskocena) {
          preskoci.push(korak.preskocena.url);
          neuspele.push(`${korak.preskocena.url}: ${korak.preskocena.razlog}`);
        }
        if (korak.ustavljeno) {
          shrambaPolna = true;
          console.log(`\n${korak.ustavljeno}`);
        }
      }
      process.stdout.write(" ".repeat(60) + "\r");

      // Publish the draft the transfer built — only if it holds nothing else.
      const po = await stanje(payload, req, id);
      let objavljeno = false;
      if (po.zadnja?._status === "draft" && po.objavljeno) {
        const razlog = tujeSpremembe(po.objavljeno, po.zadnja, g, await registrskeFotografije(payload, req, g.vir_url));
        if (razlog) {
          zapisi("osnutek-urednika", `osnutek vsebuje spremembo urednika (${razlog}) — ne objavljam`);
          continue;
        }
        // Payload builds the publish on the latest (draft) version.
        await payload.update({ collection: "tocke", id, data: { _status: "published" }, draft: false, depth: 0, req });
        objavljeno = true;
      }

      const k = konec;
      const deli = [
        `napis: ${k.napis}`,
        `dostop: ${k.dostop}`,
        `fotografije: ${k.zePripetih + k.pripetih}/${k.vRegistru} pripetih` +
          (uvozenih ? `, ${uvozenih} uvoženih zdaj` : "") +
          (k.pripetih ? `, ${k.pripetih} na novo pripetih` : ""),
      ];
      if (k.preskocene.length || neuspele.length) deli.push(`neuvoženih: ${k.preskocene.length + neuspele.length}`);
      if (k.opozorilo) deli.push(`OPOZORILO: ${k.opozorilo}`);
      zapisi(objavljeno ? "objavljeno" : "brez-sprememb", `${objavljeno ? "OBJAVLJENO" : "brez sprememb"} — ${deli.join("; ")}`);
      for (const n of neuspele) console.log(`         ! ${n}`);
      for (const s of k.preskocene) console.log(`         ! ${s.url}: ${s.razlog}`);
    } catch (err) {
      zapisi("napaka", `NAPAKA: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const skupaj = (izid: Izid) => porocila.filter((p) => p.izid === izid).map((p) => p.id);
  const vrstica = (oznaka: string, ids: string[]) =>
    console.log(`${oznaka} (${ids.length})${ids.length ? ": " + ids.join(", ") : ""}`);
  const shramba = await prenos.shranjenoVShrambi(payload, req);
  console.log("\nPovzetek:");
  vrstica("Objavljeno", skupaj("objavljeno"));
  vrstica("Brez sprememb (že preneseno in objavljeno)", skupaj("brez-sprememb"));
  vrstica("Osnutek urednika — preskočeno", skupaj("osnutek-urednika"));
  vrstica("Ni objavljeno — preskočeno", skupaj("ni-objavljeno"));
  vrstica("Ni v bazi / registru", skupaj("ni-v-bazi"));
  vrstica("Napaka (poženi znova)", skupaj("napaka"));
  console.log(`Fotografije v shrambi skupaj: ${(shramba / 1024 / 1024).toFixed(1)} MB`);
  if (shrambaPolna) console.log("Uvoz fotografij je bil ustavljen zaradi meje shrambe.");
  process.exit(skupaj("napaka").length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
