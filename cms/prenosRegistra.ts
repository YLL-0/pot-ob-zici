/**
 * »Prenesi iz registra« (PROMPT_PRENOS.md): copies the register's
 * inscription, access text and photographs from data/partizanstvo.json /
 * partizanstvo.si into one memorial — as a DRAFT version. Nothing here
 * publishes; an editor reviews and publishes as usual.
 *
 * Server-only. Endpoint POST /api/tocke/prenos-registra works in STEPS so
 * no request runs long (serverless time limits): each call either imports
 * ONE photo into `media` (step »fotografija«), or — once no photo is left
 * to import — finishes the memorial (step »konec«): fills the empty text
 * fields and attaches every imported photo, largest first, in a single
 * draft version. The admin buttons call it repeatedly until »konec«.
 *
 * Idempotent and resumable: a photo is matched on `vir_url` + register
 * file name, so an interrupted run just continues where it stopped, and
 * re-running a finished memorial changes nothing.
 */

import type { Endpoint, Payload, PayloadRequest } from "payload";
import sharp from "sharp";
import type { Media, Tocke } from "@/payload-types";
import { gradivoZaTocko, type GradivoRegistra } from "@/cms/partizanstvo";
import { isMediaStorageConfigured } from "@/lib/cms";

/**
 * Provenance line written into `dovoljenje_opomba` of every imported photo.
 * THE one place to set it. Re-running the action after changing it updates
 * the line on photos already imported.
 */
export const DOVOLJENJE_OPOMBA = "Vir: partizanstvo.si, objavljeno z dovoljenjem imetnika.";

/** Stop before the stored photos (all of `media`, every size) would exceed this. Free plan bucket: 1 GB. */
const MEJA_SHRAMBE_B = 600 * 1024 * 1024;
/** Longest edge of the stored copy; the site's own sizes (640, 1600) are derived from it. */
const NAJDALJSI_ROB_PX = 2000;
const KAKOVOST_JPEG = 82;
/** Pause between requests to partizanstvo.si — someone else's server (as in import-partizanstvo.ts). */
const PREMOR_MS = 250;
const CAS_PRENOSA_MS = 30_000;
/** Rough share the two derived WebP sizes add on top of the stored JPEG, for the pre-check only. */
const DELEZ_IZPELJANK = 0.5;

export type StanjeBesedila = "preneseno" | "ze-izpolnjeno" | "ni-v-registru";

/**
 * Copying one register text into an empty field, by the same rule as
 * scripts/prenesi-napise.ts: never overwrite what an editor has written.
 */
export function odlocitevBesedila(
  izRegistra: string | null | undefined,
  obstojece: string | null | undefined,
): { stanje: StanjeBesedila; besedilo: string | null } {
  const besedilo = izRegistra?.trim() || null;
  if (!besedilo) return { stanje: "ni-v-registru", besedilo: null };
  if (obstojece?.trim()) return { stanje: "ze-izpolnjeno", besedilo: null };
  return { stanje: "preneseno", besedilo };
}

export interface PreskocenaFotografija {
  url: string;
  razlog: string;
}

/** Request body. `preskoci`: register photo URLs that failed earlier in this run — not retried. */
export interface ZahtevekPrenosa {
  id: string;
  preskoci?: string[];
  /** Import no more photos; go straight to »konec« (after a storage stop). */
  zakljuci?: boolean;
}

interface OsnovaOdziva {
  id: string;
  naziv: string;
  /** Probable, not certain register match (NMZ-030, NMZ-033, NMZ-034). */
  opozorilo: string | null;
  /** All of `media` in storage after this step. */
  skupajVShrambiB: number;
}

/** One photo handled. The caller calls again (adding a failed URL to `preskoci`). */
export interface KorakFotografija extends OsnovaOdziva {
  korak: "fotografija";
  uvozena: { url: string; shranjenoB: number } | null;
  preskocena: PreskocenaFotografija | null;
  /** Photos still to import after this one (not counting those in `preskoci`). */
  preostalo: number;
  /** The storage limit was reached: call once more with `zakljuci: true`. */
  ustavljeno: string | null;
}

/** The memorial is finished. */
export interface KorakKonec extends OsnovaOdziva {
  korak: "konec";
  napis: StanjeBesedila;
  dostop: StanjeBesedila;
  vRegistru: number;
  /** Already attached before this run. */
  zePripetih: number;
  /** Attached by this step (imported in this run, or imported earlier and not attached). */
  pripetih: number;
  posodobljenaOpomba: number;
  /** Photos not imported for a reason decided here (permission line missing, storage, stopped run). */
  preskocene: PreskocenaFotografija[];
  /** A new draft version was saved. */
  spremenjeno: boolean;
  ustavljeno: string | null;
}

export type OdzivPrenosa = KorakFotografija | KorakKonec;

// --- requests to partizanstvo.si: one at a time, with a pause ------------

let vrsta: Promise<unknown> = Promise.resolve();
let zadnjiZahtevek = 0;

function poVrsti<T>(delo: () => Promise<T>): Promise<T> {
  const naslednje = vrsta.then(async () => {
    const pocakaj = zadnjiZahtevek + PREMOR_MS - Date.now();
    if (pocakaj > 0) await new Promise((r) => setTimeout(r, pocakaj));
    try {
      return await delo();
    } finally {
      zadnjiZahtevek = Date.now();
    }
  });
  vrsta = naslednje.catch(() => undefined);
  return naslednje;
}

async function prenesiSliko(url: string): Promise<Buffer> {
  return poVrsti(async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(CAS_PRENOSA_MS) });
    if (!res.ok) throw new Error(`strežnik registra je vrnil HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  });
}

// --- helpers -------------------------------------------------------------

function imeDatoteke(url: string): string {
  const zadnji = new URL(url).pathname.split("/").pop() || "fotografija.jpg";
  return decodeURIComponent(zadnji);
}

/**
 * Stored file name: ASCII only — the S3 storage rejects keys with
 * diacritics (»Invalid key: šola_otočec_1.jpg«). Matching uses
 * `izvirnik_url`, never this name.
 */
function vJpgIme(ime: string): string {
  const ascii = ime
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_");
  return ascii.replace(/\.[^.]+$/, "") + ".jpg";
}

function mediaId(ref: unknown): number | null {
  if (typeof ref === "number") return ref;
  if (ref && typeof ref === "object" && "id" in ref) return Number((ref as { id: unknown }).id);
  return null;
}

function velikostMedie(m: Pick<Media, "filesize" | "sizes">): number {
  return (m.filesize ?? 0) + (m.sizes?.kartica?.filesize ?? 0) + (m.sizes?.naslovna?.filesize ?? 0);
}

export async function shranjenoVShrambi(payload: Payload, req: PayloadRequest): Promise<number> {
  const { docs } = await payload.find({
    collection: "media",
    depth: 0,
    limit: 0,
    pagination: false,
    select: { filesize: true, sizes: true },
    req,
  });
  return docs.reduce((vsota, m) => vsota + velikostMedie(m as Media), 0);
}

function napakaBesedilo(err: unknown): string {
  if (err instanceof Error) return err.name === "TimeoutError" ? "prenos je trajal predolgo" : err.message;
  return String(err);
}

/** Original dimensions (EXIF orientation applied) and the resized JPEG to store. */
async function pripravi(izvirnik: Buffer): Promise<{ jpeg: Buffer; sirina: number; visina: number }> {
  const meta = await sharp(izvirnik).metadata();
  if (!meta.width || !meta.height) throw new Error("datoteka ni prepoznana kot slika");
  const zasukana = (meta.orientation ?? 1) >= 5;
  const jpeg = await sharp(izvirnik)
    .rotate()
    .resize({ width: NAJDALJSI_ROB_PX, height: NAJDALJSI_ROB_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: KAKOVOST_JPEG, mozjpeg: true })
    .toBuffer();
  return { jpeg, sirina: zasukana ? meta.height : meta.width, visina: zasukana ? meta.width : meta.height };
}

const ploscina = (m: Media) => (m.izvirnik_sirina ?? m.width ?? 0) * (m.izvirnik_visina ?? m.height ?? 0);

// --- one step ---------------------------------------------------------------

const vTeku = new Set<string>();

export class NapakaPrenosa extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function korakPrenosa(req: PayloadRequest, zahtevek: ZahtevekPrenosa): Promise<OdzivPrenosa> {
  const { payload } = req;
  const { id } = zahtevek;
  const preskoci = new Set(zahtevek.preskoci ?? []);
  const g: GradivoRegistra | null = gradivoZaTocko(id);
  if (!g) throw new NapakaPrenosa(`Za obeležje ${id} ni zapisa iz registra partizanstvo.si.`, 404);
  if (vTeku.has(id)) throw new NapakaPrenosa(`Prenos za ${id} že teče. Počakaj, da se konča.`, 409);
  vTeku.add(id);
  try {
    // Latest version (draft if there is one): the new draft builds on it.
    const tocka = (await payload.findByID({
      collection: "tocke",
      id,
      draft: true,
      depth: 0,
      disableErrors: true,
      req,
    })) as Tocke | null;
    if (!tocka) throw new NapakaPrenosa(`Obeležja ${id} ni v bazi.`, 404);

    // Photos already imported from this register record, by register file name.
    const { docs: obstojece } = await payload.find({
      collection: "media",
      where: { vir_url: { equals: g.vir_url } },
      depth: 0,
      limit: 0,
      pagination: false,
      req,
    });
    const poImenu = new Map<string, Media>();
    for (const m of obstojece as Media[]) {
      if (m.izvirnik_url) poImenu.set(imeDatoteke(m.izvirnik_url), m);
    }
    const neuvozene = g.slike.filter((s) => !poImenu.has(imeDatoteke(s.url)));
    const naVrsti = neuvozene.filter((s) => !preskoci.has(s.url));

    const osnova = { id, naziv: tocka.naziv, opozorilo: g.opozorilo };
    const skupaj = await shranjenoVShrambi(payload, req);

    const lahkoUvaza = isMediaStorageConfigured();
    const slika = naVrsti[0];
    if (slika && lahkoUvaza && !zahtevek.zakljuci) {
      const korak: KorakFotografija = {
        ...osnova,
        korak: "fotografija",
        uvozena: null,
        preskocena: null,
        preostalo: naVrsti.length - 1,
        ustavljeno: null,
        skupajVShrambiB: skupaj,
      };
      let p: Awaited<ReturnType<typeof pripravi>>;
      try {
        p = await pripravi(await prenesiSliko(slika.url));
      } catch (err) {
        korak.preskocena = { url: slika.url, razlog: `prenos ni uspel: ${napakaBesedilo(err)}` };
        return korak;
      }
      if (skupaj + p.jpeg.length * (1 + DELEZ_IZPELJANK) > MEJA_SHRAMBE_B) {
        korak.preostalo = naVrsti.length;
        korak.ustavljeno =
          `Uvoz je ustavljen: shranjene fotografije bi presegle ${MEJA_SHRAMBE_B / 1024 / 1024} MB ` +
          `(zdaj ${(skupaj / 1024 / 1024).toFixed(1)} MB).`;
        return korak;
      }
      try {
        const m = (await payload.create({
          collection: "media",
          data: {
            podnapis: slika.opis?.trim() || tocka.naziv,
            avtor_vir: slika.avtor?.trim() || "partizanstvo.si",
            pravice: "dovoljenje-pridobljeno",
            licenca: slika.licenca_v_registru ?? null,
            vir_url: g.vir_url,
            tip: "danes",
            dovoljenje_opomba: DOVOLJENJE_OPOMBA,
            izvirnik_url: slika.url,
            izvirnik_sirina: p.sirina,
            izvirnik_visina: p.visina,
          },
          file: { data: p.jpeg, mimetype: "image/jpeg", name: vJpgIme(imeDatoteke(slika.url)), size: p.jpeg.length },
          depth: 0,
          req,
        })) as Media;
        const bajtov = velikostMedie(m);
        korak.uvozena = { url: slika.url, shranjenoB: bajtov };
        korak.skupajVShrambiB = skupaj + bajtov;
      } catch (err) {
        korak.preskocena = { url: slika.url, razlog: `shranjevanje ni uspelo: ${napakaBesedilo(err)}` };
      }
      return korak;
    }

    // --- konec: texts + attach everything, one draft version -------------
    const konec: KorakKonec = {
      ...osnova,
      korak: "konec",
      napis: "ni-v-registru",
      dostop: "ni-v-registru",
      vRegistru: g.slike.length,
      zePripetih: 0,
      pripetih: 0,
      posodobljenaOpomba: 0,
      preskocene: [],
      spremenjeno: false,
      ustavljeno: null,
      skupajVShrambiB: skupaj,
    };

    if (naVrsti.length > 0) {
      const brezShrambe = !isMediaStorageConfigured();
      const razlog = brezShrambe ? "shramba ni nastavljena" : "uvoz ustavljen";
      konec.ustavljeno = brezShrambe
        ? "Fotografije niso uvožene: v tem okolju ni nastavljena shramba fotografij (S3_* v okolju strežnika)."
        : null;
      for (const s of naVrsti) konec.preskocene.push({ url: s.url, razlog });
    }

    for (const m of poImenu.values()) {
      if (m.dovoljenje_opomba === DOVOLJENJE_OPOMBA) continue;
      await payload.update({ collection: "media", id: m.id, data: { dovoljenje_opomba: DOVOLJENJE_OPOMBA }, req });
      konec.posodobljenaOpomba++;
    }

    const pripete = (tocka.fotografije ?? []).map(mediaId).filter((x): x is number => x !== null);
    const zaPripeti = [...poImenu.values()].filter((m) => !pripete.includes(m.id)).sort((a, b) => ploscina(b) - ploscina(a));
    konec.zePripetih = poImenu.size - zaPripeti.length;
    konec.pripetih = zaPripeti.length;

    const napis = odlocitevBesedila(g.napis, tocka.napis);
    const dostop = odlocitevBesedila(g.dostop, tocka.dostop);
    konec.napis = napis.stanje;
    konec.dostop = dostop.stanje;

    const data: Partial<Tocke> = {};
    if (napis.besedilo) {
      data.napis = napis.besedilo;
      // The register's text never appears without its attribution.
      data.napis_iz_registra = true;
    }
    if (dostop.besedilo) data.dostop = dostop.besedilo;
    if (zaPripeti.length > 0) data.fotografije = [...pripete, ...zaPripeti.map((m) => m.id)];

    if (Object.keys(data).length > 0) {
      // draft: true saves a new draft version on top of the latest one; the
      // published version (and the public site) stays exactly as it was.
      await payload.update({ collection: "tocke", id, data, draft: true, depth: 0, req });
      konec.spremenjeno = true;
    }
    return konec;
  } finally {
    vTeku.delete(id);
  }
}

/**
 * POST /api/tocke/prenos-registra  body ZahtevekPrenosa, e.g. `{ "id": "NMZ-017" }`.
 * Any logged-in editor (urednik, admin). Returns one OdzivPrenosa step.
 */
export const prenosRegistraEndpoint: Endpoint = {
  path: "/tocke/prenos-registra",
  method: "post",
  handler: async (req) => {
    if (!req.user) return Response.json({ napaka: "Za prenos se moraš prijaviti." }, { status: 401 });
    let telo: Partial<ZahtevekPrenosa> | undefined;
    try {
      telo = (await req.json?.()) as Partial<ZahtevekPrenosa> | undefined;
    } catch {
      // handled below
    }
    const id = telo?.id;
    if (typeof id !== "string" || !/^NMZ-\d{3}$/.test(id)) {
      return Response.json({ napaka: "Manjka ID obeležja (npr. »NMZ-017«)." }, { status: 400 });
    }
    const preskoci = Array.isArray(telo?.preskoci) ? telo.preskoci.filter((u): u is string => typeof u === "string") : [];
    try {
      return Response.json(await korakPrenosa(req, { id, preskoci, zakljuci: telo?.zakljuci === true }));
    } catch (err) {
      if (err instanceof NapakaPrenosa) return Response.json({ napaka: err.message }, { status: err.status });
      req.payload.logger.error({ err, msg: `prenos iz registra ${id}` });
      return Response.json({ napaka: `Prenos ni uspel: ${napakaBesedilo(err)}` }, { status: 500 });
    }
  },
};
