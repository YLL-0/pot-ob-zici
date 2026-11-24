/**
 * »Prenesi iz registra« (PROMPT_PRENOS.md): copies the register's
 * inscription, access text and photographs from data/partizanstvo.json /
 * partizanstvo.si into one memorial — as a DRAFT version. Nothing here
 * publishes; an editor reviews and publishes as usual.
 *
 * Server-only. Used by the endpoint POST /api/tocke/prenos-registra
 * (one memorial per request; the stage action in the admin calls it once
 * per memorial, in sequence, so it can show progress).
 *
 * Idempotent: text fields are only filled when empty, and a photo is
 * matched on `vir_url` + register file name, so re-running changes nothing.
 */

import type { Endpoint, Payload, PayloadRequest } from "payload";
import sharp from "sharp";
import type { Media, Tocke } from "@/payload-types";
import { gradivoZaTocko, type GradivoRegistra, type SlikaRegistra } from "@/cms/partizanstvo";
import { isMediaStorageConfigured } from "@/lib/cms";

/**
 * Provenance line written into `dovoljenje_opomba` of every imported photo.
 * THE one place to set it. While it still contains "[…]" placeholders,
 * photos are not imported (texts still are). Re-running the action after
 * changing it updates the line on photos already imported.
 */
export const DOVOLJENJE_OPOMBA = "Dovoljenje za objavo: partizanstvo.si, [kdo ti je odgovoril], [mesec in leto].";

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

export const SPOROCILO_ZAMENJAJ_OPOMBO =
  "Fotografije niso uvožene: v cms/prenosRegistra.ts je treba v DOVOLJENJE_OPOMBA vpisati, kdo je dal dovoljenje in kdaj.";

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

export interface RezultatPrenosa {
  id: string;
  naziv: string;
  napis: StanjeBesedila;
  dostop: StanjeBesedila;
  fotografije: {
    vRegistru: number;
    uvozenih: number;
    /** Already imported and attached — nothing to do. */
    zeUvozenih: number;
    /** Imported earlier but no longer attached to the memorial: attached again, not downloaded again. */
    ponovnoPripetih: number;
    /** Already imported photos whose provenance line was updated to the current DOVOLJENJE_OPOMBA. */
    posodobljenaOpomba: number;
    preskocene: PreskocenaFotografija[];
  };
  /** Bytes newly written to storage by this run (stored JPEG + derived sizes). */
  shranjenoB: number;
  /** All of `media` in storage after this run. */
  skupajVShrambiB: number;
  /** A new draft version was saved. */
  spremenjeno: boolean;
  /** Probable, not certain register match (NMZ-030, NMZ-033, NMZ-034). */
  opozorilo: string | null;
  /** Why the photo import stopped early, if it did (storage limit, missing configuration). */
  ustavljeno: string | null;
}

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

function vJpgIme(ime: string): string {
  return ime.replace(/\.[^.]+$/, "") + ".jpg";
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

interface PripravljenaSlika {
  slika: SlikaRegistra;
  jpeg: Buffer;
  sirina: number;
  visina: number;
}

/** Original dimensions (EXIF orientation applied) and the resized JPEG to store. */
async function pripravi(slika: SlikaRegistra, izvirnik: Buffer): Promise<PripravljenaSlika> {
  const meta = await sharp(izvirnik).metadata();
  if (!meta.width || !meta.height) throw new Error("datoteka ni prepoznana kot slika");
  const zasukana = (meta.orientation ?? 1) >= 5;
  const jpeg = await sharp(izvirnik)
    .rotate()
    .resize({ width: NAJDALJSI_ROB_PX, height: NAJDALJSI_ROB_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: KAKOVOST_JPEG, mozjpeg: true })
    .toBuffer();
  return {
    slika,
    jpeg,
    sirina: zasukana ? meta.height : meta.width,
    visina: zasukana ? meta.width : meta.height,
  };
}

// --- one memorial ---------------------------------------------------------

const vTeku = new Set<string>();

export class NapakaPrenosa extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function prenesiIzRegistra(req: PayloadRequest, id: string): Promise<RezultatPrenosa> {
  const { payload } = req;
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

    const napis = odlocitevBesedila(g.napis, tocka.napis);
    const dostop = odlocitevBesedila(g.dostop, tocka.dostop);

    const rezultat: RezultatPrenosa = {
      id,
      naziv: tocka.naziv,
      napis: napis.stanje,
      dostop: dostop.stanje,
      fotografije: {
        vRegistru: g.slike.length,
        uvozenih: 0,
        zeUvozenih: 0,
        ponovnoPripetih: 0,
        posodobljenaOpomba: 0,
        preskocene: [],
      },
      shranjenoB: 0,
      skupajVShrambiB: 0,
      spremenjeno: false,
      opozorilo: g.opozorilo,
      ustavljeno: null,
    };
    const f = rezultat.fotografije;

    const pripete = (tocka.fotografije ?? []).map(mediaId).filter((x): x is number => x !== null);
    const nove: number[] = [];

    // Photos already imported from this register record, keyed by register file name.
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

    const zaPrenos: SlikaRegistra[] = [];
    for (const s of g.slike) {
      const m = poImenu.get(imeDatoteke(s.url));
      if (!m) {
        zaPrenos.push(s);
        continue;
      }
      if (pripete.includes(m.id)) f.zeUvozenih++;
      else {
        nove.push(m.id);
        f.ponovnoPripetih++;
      }
      if (m.dovoljenje_opomba !== DOVOLJENJE_OPOMBA && !DOVOLJENJE_OPOMBA.includes("[")) {
        await payload.update({ collection: "media", id: m.id, data: { dovoljenje_opomba: DOVOLJENJE_OPOMBA }, req });
        f.posodobljenaOpomba++;
      }
    }

    let skupaj = await shranjenoVShrambi(payload, req);

    if (zaPrenos.length > 0) {
      if (DOVOLJENJE_OPOMBA.includes("[")) {
        rezultat.ustavljeno = SPOROCILO_ZAMENJAJ_OPOMBO;
        for (const s of zaPrenos) f.preskocene.push({ url: s.url, razlog: "dovoljenje še ni vpisano" });
      } else if (!isMediaStorageConfigured()) {
        rezultat.ustavljeno =
          "Fotografije niso uvožene: v tem okolju ni nastavljena shramba fotografij (S3_* v okolju strežnika).";
        for (const s of zaPrenos) f.preskocene.push({ url: s.url, razlog: "shramba ni nastavljena" });
      } else {
        // Download and resize all first, so they can be attached largest first.
        const pripravljene: PripravljenaSlika[] = [];
        for (const s of zaPrenos) {
          try {
            pripravljene.push(await pripravi(s, await prenesiSliko(s.url)));
          } catch (err) {
            f.preskocene.push({ url: s.url, razlog: `prenos ni uspel: ${napakaBesedilo(err)}` });
          }
        }
        pripravljene.sort((a, b) => b.sirina * b.visina - a.sirina * a.visina);

        for (const p of pripravljene) {
          if (rezultat.ustavljeno) {
            f.preskocene.push({ url: p.slika.url, razlog: "ustavljeno zaradi omejitve shrambe" });
            continue;
          }
          const ocena = p.jpeg.length * (1 + DELEZ_IZPELJANK);
          if (skupaj + ocena > MEJA_SHRAMBE_B) {
            rezultat.ustavljeno =
              `Uvoz je ustavljen: shranjene fotografije bi presegle ${MEJA_SHRAMBE_B / 1024 / 1024} MB ` +
              `(zdaj ${(skupaj / 1024 / 1024).toFixed(1)} MB).`;
            f.preskocene.push({ url: p.slika.url, razlog: "ustavljeno zaradi omejitve shrambe" });
            continue;
          }
          try {
            const ime = vJpgIme(imeDatoteke(p.slika.url));
            const m = (await payload.create({
              collection: "media",
              data: {
                podnapis: p.slika.opis?.trim() || tocka.naziv,
                avtor_vir: p.slika.avtor?.trim() || "partizanstvo.si",
                pravice: "dovoljenje-pridobljeno",
                licenca: p.slika.licenca_v_registru ?? null,
                vir_url: g.vir_url,
                tip: "danes",
                dovoljenje_opomba: DOVOLJENJE_OPOMBA,
                izvirnik_url: p.slika.url,
                izvirnik_sirina: p.sirina,
                izvirnik_visina: p.visina,
              },
              file: { data: p.jpeg, mimetype: "image/jpeg", name: ime, size: p.jpeg.length },
              depth: 0,
              req,
            })) as Media;
            const bajtov = velikostMedie(m);
            rezultat.shranjenoB += bajtov;
            skupaj += bajtov;
            nove.push(m.id);
            f.uvozenih++;
          } catch (err) {
            f.preskocene.push({ url: p.slika.url, razlog: `shranjevanje ni uspelo: ${napakaBesedilo(err)}` });
          }
        }
      }
    }
    rezultat.skupajVShrambiB = skupaj;

    const data: Partial<Tocke> = {};
    if (napis.besedilo) {
      data.napis = napis.besedilo;
      // The register's text never appears without its attribution.
      data.napis_iz_registra = true;
    }
    if (dostop.besedilo) data.dostop = dostop.besedilo;
    if (nove.length > 0) data.fotografije = [...pripete, ...nove];

    if (Object.keys(data).length > 0) {
      // draft: true saves a new draft version on top of the latest one; the
      // published version (and the public site) stays exactly as it was.
      await payload.update({ collection: "tocke", id, data, draft: true, depth: 0, req });
      rezultat.spremenjeno = true;
    }
    return rezultat;
  } finally {
    vTeku.delete(id);
  }
}

/**
 * POST /api/tocke/prenos-registra  body `{ "id": "NMZ-017" }`
 * Any logged-in editor (urednik, admin). Returns a RezultatPrenosa.
 */
export const prenosRegistraEndpoint: Endpoint = {
  path: "/tocke/prenos-registra",
  method: "post",
  handler: async (req) => {
    if (!req.user) return Response.json({ napaka: "Za prenos se moraš prijaviti." }, { status: 401 });
    let id: unknown;
    try {
      id = ((await req.json?.()) as { id?: unknown } | undefined)?.id;
    } catch {
      // handled below
    }
    if (typeof id !== "string" || !/^NMZ-\d{3}$/.test(id)) {
      return Response.json({ napaka: "Manjka ID obeležja (npr. »NMZ-017«)." }, { status: 400 });
    }
    try {
      return Response.json(await prenesiIzRegistra(req, id));
    } catch (err) {
      if (err instanceof NapakaPrenosa) return Response.json({ napaka: err.message }, { status: err.status });
      req.payload.logger.error({ err, msg: `prenos iz registra ${id}` });
      return Response.json({ napaka: `Prenos ni uspel: ${napakaBesedilo(err)}` }, { status: 500 });
    }
  },
};
