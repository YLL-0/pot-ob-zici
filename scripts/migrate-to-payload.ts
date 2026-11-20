/**
 * Moves the 8 stages (lib/etape.ts ETAPE_SEED) and the 50 points
 * (tocke.seed.json) into the Payload collections, preserving IDs, slugs,
 * coordinates, source fields and stage order.
 *
 *   npm run migrate:payload -- --dry-run   # read-only: prints what it would do
 *   npm run migrate:payload                # writes, in one transaction
 *   npm run migrate:payload -- --prepisi   # also overwrite documents that differ
 *
 * Idempotent: a document that already exists and matches is skipped. One
 * that exists but differs is reported and left alone (once content is in
 * Payload, Payload is the source of truth) unless --prepisi is given.
 *
 * --dry-run makes every database connection a read-only session and
 * refuses to continue unless the server confirms it (SHOW
 * transaction_read_only), so a dry run cannot write.
 *
 * Writes go through the Payload Local API, so hooks, validation and the
 * first version of every document are created exactly as in the admin.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Etapa, Tocka } from "../lib/types";
import { ETAPE_SEED } from "../lib/etape";
import {
  DOVOLJENJE_QR_MOZNOSTI,
  ESD_STATUS_MOZNOSTI,
  GPS_ZANESLJIVOST_MOZNOSTI,
  STATUS_IZVEDBE_MOZNOSTI,
  STROKOVNA_VERIFIKACIJA_MOZNOSTI,
  VKLJUCITEV_MOZNOSTI,
  VRSTA_MOZNOSTI,
  VSEBINSKI_STATUS_MOZNOSTI,
  ZGODBA_MOZNOSTI,
} from "../cms/moznosti";

const ROOT = join(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const PREPISI = args.has("--prepisi");


// ---------------------------------------------------------------------------
// Seed → Payload document shape
// ---------------------------------------------------------------------------

type Doc = Record<string, unknown>;

interface LexicalText {
  type: "text";
  text: string;
  format: 0;
  style: "";
  mode: "normal";
  detail: 0;
  version: 1;
}
interface LexicalLinebreak {
  type: "linebreak";
  version: 1;
}
interface LexicalParagraph {
  type: "paragraph";
  children: (LexicalText | LexicalLinebreak)[];
  direction: "ltr";
  format: "";
  indent: 0;
  textFormat: 0;
  textStyle: "";
  version: 1;
}
interface LexicalRoot {
  root: { type: "root"; children: LexicalParagraph[]; direction: "ltr"; format: ""; indent: 0; version: 1 };
}

/**
 * Plain text → Lexical. Blank line = new paragraph, single newline = line
 * break. No markup is inferred: the text arrives exactly as written.
 */
function besediloVLexical(besedilo: string | null): LexicalRoot | null {
  if (besedilo === null || besedilo.trim() === "") return null;
  const odstavki = besedilo.split(/\n{2,}/);
  return {
    root: {
      type: "root",
      direction: "ltr",
      format: "",
      indent: 0,
      version: 1,
      children: odstavki.map((odstavek) => ({
        type: "paragraph",
        direction: "ltr",
        format: "",
        indent: 0,
        textFormat: 0,
        textStyle: "",
        version: 1,
        children: odstavek.split("\n").flatMap((vrstica, i): (LexicalText | LexicalLinebreak)[] => [
          ...(i > 0 ? [{ type: "linebreak", version: 1 } as const] : []),
          { type: "text", text: vrstica, format: 0, style: "", mode: "normal", detail: 0, version: 1 },
        ]),
      })),
    },
  };
}

/** Inverse of besediloVLexical — used to prove the conversion is lossless. */
function lexicalVBesedilo(doc: LexicalRoot | null): string | null {
  if (!doc) return null;
  return doc.root.children
    .map((p) => p.children.map((c) => (c.type === "linebreak" ? "\n" : c.text)).join(""))
    .join("\n\n");
}

function etapaVDokument(e: Etapa): Doc {
  return { id: e.id, stevilka: e.stevilka, naziv: e.naziv, odsek: e.odsek, barva: e.barva, opis: e.opis, vidna: e.vidna };
}

function tockaVDokument(t: Tocka): Doc {
  return {
    id: t.id,
    naziv: t.naziv,
    slug: t.slug,
    obmocje: t.obmocje,
    vrsta: t.vrsta,
    vrsta_raw: t.vrsta_raw,
    esd: t.esd,
    esd_status: t.esd_status,
    iztocnica: t.iztocnica,
    kljucna_tema: t.kljucna_tema,
    vkljucitev: t.vkljucitev,
    lat: t.lat,
    lon: t.lon,
    gps_zanesljivost: t.gps_zanesljivost,
    gps_vir: t.gps_vir,
    gps_vir_id: t.gps_vir_id,
    gps_vir_url: t.gps_vir_url,
    gps_opomba: t.gps_opomba,
    etapa: t.etapa,
    zaporedje: t.zaporedje,
    besedilo_kratko: t.besedilo_kratko,
    besedilo_poglobljeno: besediloVLexical(t.besedilo_poglobljeno),
    zgodbe_predlog: t.zgodbe_predlog,
    viri: t.viri.map((url) => ({ url })),
    fotografije: [],
    v_pregledu: t.status === "v_pregledu",
    status_izvedbe: t.status_izvedbe,
    odgovorna_oseba: t.odgovorna_oseba,
    rok: t.rok,
    napredek: t.napredek,
    opombe: t.opombe,
    foto_pravice_status: t.foto_pravice_status,
    qr_generiran: t.qr_generiran,
    qr_tablica_namescena: t.qr_tablica_namescena,
    dovoljenje_qr: t.dovoljenje_qr,
    strokovna_verifikacija: t.strokovna_verifikacija,
    kviz: t.kviz.length > 0 ? t.kviz : null,
    _status: t.status === "objavljeno" ? "published" : "draft",
  };
}

// ---------------------------------------------------------------------------
// Offline checks — everything that can fail before touching the database
// ---------------------------------------------------------------------------

function preveri(tocke: Tocka[], etape: Etapa[]): string[] {
  const napake: string[] = [];
  const v = (list: { value: string }[]) => new Set(list.map((o) => o.value));
  const selecti: [keyof Tocka, Set<string>][] = [
    ["vrsta", v(VRSTA_MOZNOSTI)],
    ["gps_zanesljivost", v(GPS_ZANESLJIVOST_MOZNOSTI)],
    ["vkljucitev", v(VKLJUCITEV_MOZNOSTI)],
    ["esd_status", v(ESD_STATUS_MOZNOSTI)],
    ["foto_pravice_status", v(VSEBINSKI_STATUS_MOZNOSTI)],
    ["dovoljenje_qr", v(DOVOLJENJE_QR_MOZNOSTI)],
    ["strokovna_verifikacija", v(STROKOVNA_VERIFIKACIJA_MOZNOSTI)],
    ["status_izvedbe", v(STATUS_IZVEDBE_MOZNOSTI)],
  ];
  const zgodbe = v(ZGODBA_MOZNOSTI);
  const etapeIds = new Set(etape.map((e) => e.id));
  const ids = new Set<string>();
  const slugi = new Set<string>();
  const stevilke = new Set<number>();

  for (const e of etape) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id)) napake.push(`etapa ${e.id}: neveljaven ID`);
    if (!/^#[0-9a-f]{6}$/i.test(e.barva)) napake.push(`etapa ${e.id}: neveljavna barva ${e.barva}`);
    if (stevilke.has(e.stevilka)) napake.push(`etapa ${e.id}: podvojena številka ${e.stevilka}`);
    stevilke.add(e.stevilka);
  }
  for (const t of tocke) {
    const p = `${t.id}`;
    if (!/^NMZ-\d{3}$/.test(t.id)) napake.push(`${p}: neveljaven ID`);
    if (ids.has(t.id)) napake.push(`${p}: podvojen ID`);
    ids.add(t.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.slug)) napake.push(`${p}: neveljaven slug ${t.slug}`);
    if (slugi.has(t.slug)) napake.push(`${p}: podvojen slug ${t.slug}`);
    slugi.add(t.slug);
    for (const [polje, dovoljene] of selecti) {
      if (!dovoljene.has(t[polje] as string)) napake.push(`${p}: ${polje} = »${String(t[polje])}« ni med možnostmi`);
    }
    for (const z of t.zgodbe_predlog) if (!zgodbe.has(z)) napake.push(`${p}: zgodba »${z}« ni med možnostmi`);
    if (t.zgodbe_predlog.length > 3) napake.push(`${p}: več kot tri zgodbe`);
    if (t.etapa !== null && !etapeIds.has(t.etapa)) napake.push(`${p}: etapa ${t.etapa} ne obstaja`);
    if (!Number.isFinite(t.lat) || !Number.isFinite(t.lon)) napake.push(`${p}: neveljavne koordinate`);
    for (const url of t.viri) if (!/^https?:\/\/\S+$/.test(url)) napake.push(`${p}: neveljaven vir ${url}`);
    if (t.foto.length > 0) {
      napake.push(`${p}: ima ${t.foto.length} fotografij — prenos datotek ta skripta ne podpira`);
    }
    if (lexicalVBesedilo(besediloVLexical(t.besedilo_poglobljeno)) !== (t.besedilo_poglobljeno?.trim() ? t.besedilo_poglobljeno : null)) {
      napake.push(`${p}: pretvorba poglobljenega besedila v Lexical ni brez izgube`);
    }
  }
  return napake;
}

// ---------------------------------------------------------------------------
// Comparison with what is already in the database
// ---------------------------------------------------------------------------

function normaliziraj(vrednost: unknown): unknown {
  if (Array.isArray(vrednost)) return vrednost.map(normaliziraj);
  if (vrednost && typeof vrednost === "object") {
    return Object.fromEntries(
      Object.keys(vrednost as Doc)
        .sort()
        .map((k) => [k, normaliziraj((vrednost as Doc)[k])]),
    );
  }
  return vrednost === undefined ? null : vrednost;
}

/** Projects a stored document onto the keys of the seed document. */
function izBaze(obstojeci: Doc, kljuci: string[]): Doc {
  const out: Doc = {};
  for (const k of kljuci) {
    let val = obstojeci[k];
    if (k === "viri" && Array.isArray(val)) val = val.map((r: Doc) => ({ url: r.url }));
    if (k === "fotografije" && Array.isArray(val)) {
      val = val.map((r) => (r && typeof r === "object" ? (r as Doc).id : r));
    }
    if (k === "etapa" && val && typeof val === "object") val = (val as Doc).id;
    if (k === "rok" && typeof val === "string") val = val.slice(0, 10);
    if (k === "zgodbe_predlog" && val == null) val = [];
    out[k] = val;
  }
  return out;
}

function razlike(zeljeno: Doc, obstojeci: Doc): string[] {
  const kljuci = Object.keys(zeljeno);
  const baza = izBaze(obstojeci, kljuci);
  return kljuci.filter((k) => JSON.stringify(normaliziraj(zeljeno[k])) !== JSON.stringify(normaliziraj(baza[k])));
}

/** `id` is read-only after creation, so updates must not send it. */
function brezId(doc: Doc): Doc {
  return Object.fromEntries(Object.entries(doc).filter(([k]) => k !== "id"));
}

type Akcija = "ustvari" | "enako" | "razlika" | "prepiši";

function nacrt(zeljeni: Doc[], obstojeci: Map<string, Doc>) {
  return zeljeni.map((doc) => {
    const id = doc.id as string;
    const v = obstojeci.get(id);
    if (!v) return { id, doc, akcija: "ustvari" as Akcija, polja: [] as string[] };
    const polja = razlike(doc, v);
    if (polja.length === 0) return { id, doc, akcija: "enako" as Akcija, polja };
    return { id, doc, akcija: (PREPISI ? "prepiši" : "razlika") as Akcija, polja };
  });
}

function povzetek(ime: string, n: ReturnType<typeof nacrt>) {
  const st = (a: Akcija) => n.filter((x) => x.akcija === a).length;
  console.log(
    `  ${ime}: ustvari ${st("ustvari")}, enako ${st("enako")}, ` +
      `${PREPISI ? `prepiši ${st("prepiši")}` : `razlika (preskočeno) ${st("razlika")}`}`,
  );
  for (const x of n.filter((x) => x.akcija === "razlika" || x.akcija === "prepiši")) {
    console.log(`    ${x.akcija === "prepiši" ? "↻" : "≠"} ${x.id}: ${x.polja.join(", ")}`);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? "=== SUHI ZAGON (--dry-run): baza se odpre samo za branje ===\n" : "=== ZAGON: zapis v bazo ===\n");

  if (!process.env.DATABASE_URI || !process.env.PAYLOAD_SECRET) {
    throw new Error("Manjka DATABASE_URI ali PAYLOAD_SECRET v .env.local.");
  }

  const tocke = JSON.parse(readFileSync(join(ROOT, "tocke.seed.json"), "utf-8")) as Tocka[];
  const etape = ETAPE_SEED;

  // 1. Offline
  console.log(`Vir: tocke.seed.json (${tocke.length} točk), lib/etape.ts ETAPE_SEED (${etape.length} etap)`);
  const napake = preveri(tocke, etape);
  if (napake.length > 0) {
    console.error(`\n✗ Preverjanje vira: ${napake.length} napak:`);
    for (const n of napake) console.error(`  - ${n}`);
    process.exit(1);
  }
  console.log("✓ Preverjanje vira: vse vrednosti so med možnostmi zbirk, ID-ji in slugi so edinstveni.");
  const sBesedilom = tocke.filter((t) => t.besedilo_poglobljeno).map((t) => t.id);
  console.log(`✓ Poglobljeno besedilo → Lexical brez izgube (${sBesedilom.length}: ${sBesedilom.join(", ") || "—"})`);

  const etapeDocs = etape.map(etapaVDokument);
  const tockeDocs = tocke.map(tockaVDokument);

  // 2. Database
  const { getPayload, createLocalReq, initTransaction, commitTransaction, killTransaction } = await import("payload");
  const { default: config } = await import("../payload.config");
  const payload = await getPayload({ config });
  interface PgClient {
    query: (sql: string) => Promise<unknown>;
  }
  interface PgPool {
    idleCount: number;
    query: (sql: string, p?: unknown[]) => Promise<{ rows: Doc[] }>;
    on: (event: "connect", cb: (client: PgClient) => void) => void;
  }
  const pool = (payload.db as unknown as { pool: PgPool }).pool;
  if (DRY_RUN) {
    // The Supabase pooler ignores startup `options`, so make every new
    // connection read-only on connect. pg runs queries on a client in
    // order, so this SET always precedes the first real query. Payload's
    // init opens no query connection, so there is no idle client yet that
    // would escape the listener — checked, not assumed.
    if (pool.idleCount !== 0) throw new Error("Bazen povezav ni prazen — suhi zagon prekinjen pred prvim branjem.");
    pool.on("connect", (client) => {
      void client.query("set session characteristics as transaction read only");
    });
  }
  const q = async (sql: string, p?: unknown[]) => (await pool.query(sql, p)).rows;

  try {
    const [ro] = await q("show transaction_read_only");
    const readOnly = ro?.transaction_read_only === "on";
    console.log(`\nBaza: povezava vzpostavljena, seja samo za branje: ${readOnly ? "da" : "ne"}`);
    if (DRY_RUN && !readOnly) {
      throw new Error("Strežnik ni sprejel seje samo za branje — suhi zagon prekinjen, nič ni bilo zapisano.");
    }

    const tabele = await q(
      "select table_schema, table_name from information_schema.tables where table_schema in ('payload','public') order by 1,2",
    );
    const v = (schema: string) => tabele.filter((t) => t.table_schema === schema).map((t) => t.table_name as string);
    const payloadTabele = v("payload");
    const publicTabele = v("public");
    console.log(`  shema public:  ${publicTabele.length ? publicTabele.join(", ") : "(prazna)"}`);
    console.log(`  shema payload: ${payloadTabele.length ? payloadTabele.join(", ") : "(ne obstaja ali je prazna)"}`);
    for (const t of ["tocke", "etape", "profiles", "trase"]) {
      if (publicTabele.includes(t)) {
        const [r] = await q(`select count(*)::int as n from public."${t}"`);
        console.log(`  public.${t}: ${r?.n} vrstic`);
      }
    }

    const shemaPripravljena = ["tocke", "etape", "media", "users"].every((t) => payloadTabele.includes(t));
    let obstojeceEtape = new Map<string, Doc>();
    let obstojeceTocke = new Map<string, Doc>();
    if (shemaPripravljena) {
      const e = await payload.find({ collection: "etape", limit: 0, pagination: false, depth: 0, overrideAccess: true });
      const t = await payload.find({ collection: "tocke", limit: 0, pagination: false, depth: 0, overrideAccess: true, draft: false });
      obstojeceEtape = new Map(e.docs.map((d) => [String(d.id), d as unknown as Doc]));
      obstojeceTocke = new Map(t.docs.map((d) => [String(d.id), d as unknown as Doc]));
      console.log(`  v Payloadu: ${obstojeceEtape.size} etap, ${obstojeceTocke.size} točk`);
    } else {
      console.log("  Payloadove tabele še ne obstajajo → pred prenosom podatkov je treba izvesti migracijo sheme.");
    }

    // 3. Plan
    const nEtape = nacrt(etapeDocs, obstojeceEtape);
    const nTocke = nacrt(tockeDocs, obstojeceTocke);
    console.log("\nNačrt:");
    povzetek("etape", nEtape);
    povzetek("tocke", nTocke);

    console.log("\nEtape:");
    for (const e of etape) {
      const n = tocke.filter((t) => t.etapa === e.id).length;
      console.log(`  ${e.id.padEnd(8)} #${e.stevilka}  ${e.barva}  ${(e.odsek ?? "").padEnd(24)} ${String(n).padStart(2)} točk`);
    }
    const objavljene = tockeDocs.filter((d) => d._status === "published").length;
    console.log(
      `\nTočke: ${tockeDocs.length} (objavljene ${objavljene}, osnutki ${tockeDocs.length - objavljene}, ` +
        `brez etape ${tocke.filter((t) => t.etapa === null).length}, s fotografijami ${tocke.filter((t) => t.foto.length).length})`,
    );
    for (const t of tocke) {
      console.log(
        `  ${t.id}  ${t.slug.padEnd(48)} ${String(t.lat).padEnd(10)} ${String(t.lon).padEnd(10)} ${(t.etapa ?? "—").padEnd(8)} #${t.zaporedje ?? "—"}`,
      );
    }

    if (DRY_RUN) {
      console.log("\nSuhi zagon končan. Nič ni bilo zapisano.");
      return;
    }
    if (!shemaPripravljena) {
      throw new Error("Payloadove tabele ne obstajajo. Najprej zaženi `npm run payload -- migrate`.");
    }

    // 4. Write — one transaction: all or nothing.
    const req = await createLocalReq({}, payload);
    await initTransaction(req);
    try {
      for (const x of nEtape) {
        if (x.akcija === "ustvari") await payload.create({ collection: "etape", data: x.doc as never, overrideAccess: true, req });
        if (x.akcija === "prepiši") {
          await payload.update({ collection: "etape", id: x.id, data: brezId(x.doc) as never, overrideAccess: true, req });
        }
      }
      for (const x of nTocke) {
        if (x.akcija === "ustvari") {
          await payload.create({ collection: "tocke", data: x.doc as never, draft: false, overrideAccess: true, req });
        }
        if (x.akcija === "prepiši") {
          await payload.update({ collection: "tocke", id: x.id, data: brezId(x.doc) as never, draft: false, overrideAccess: true, req });
        }
      }
      await commitTransaction(req);
    } catch (err) {
      await killTransaction(req);
      throw err;
    }

    // 5. Verify by reading back.
    const e = await payload.find({ collection: "etape", limit: 0, pagination: false, depth: 0, overrideAccess: true });
    const t = await payload.find({ collection: "tocke", limit: 0, pagination: false, depth: 0, overrideAccess: true, draft: false });
    const po = nacrt(tockeDocs, new Map(t.docs.map((d) => [String(d.id), d as unknown as Doc])));
    const poE = nacrt(etapeDocs, new Map(e.docs.map((d) => [String(d.id), d as unknown as Doc])));
    const neujemanja = [...po, ...poE].filter((x) => x.akcija !== "enako");
    console.log(`\nPreverjanje po zapisu: ${e.docs.length} etap, ${t.docs.length} točk v bazi.`);
    if (neujemanja.length > 0) {
      for (const x of neujemanja) console.log(`  ≠ ${x.id}: ${x.akcija} ${x.polja.join(", ")}`);
      throw new Error(`${neujemanja.length} dokumentov se ne ujema z virom.`);
    }
    console.log("✓ Vsi dokumenti se ujemajo z virom.");
  } finally {
    await payload.destroy();
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
