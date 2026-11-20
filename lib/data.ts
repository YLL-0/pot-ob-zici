/**
 * The ONLY place in the app allowed to fetch point/trail data. Components
 * must import from here, never call Payload, Supabase or read data/poti/
 * directly (CLAUDE.md convention).
 *
 * Points and stages come from Payload (published documents only) when the
 * CMS is configured (lib/cms.ts: DATABASE_URI + PAYLOAD_SECRET), otherwise
 * from tocke.seed.json / lib/etape.ts ETAPE_SEED. A fresh clone with no
 * .env must `npm run dev` and show all 50 points — that fallback must
 * never become a hard database dependency.
 *
 * Public pages are static and must not query the database per request: a
 * free Supabase project pauses after a week without activity, and a QR
 * plaque scanned in a quiet month must still open. So every database read
 * here goes through Next's data cache with a tag ("tocke", "etape",
 * "trase"); pages are prerendered from it and re-rendered only when an
 * admin save invalidates the tag (cms/revalidacija.ts).
 *
 * If the database can't be reached:
 * - during `next build` or in development → the seed is used, with a
 *   warning, so a paused database never fails a build;
 * - in production at runtime (a re-render after a publish) → the error is
 *   thrown, so Next keeps serving the last good page instead of replacing
 *   edited content with the older seed.
 *
 * A point's `odsek` is always taken from its stage on read, `qr_url` from
 * lib/qr.ts. Rich text (besedilo_poglobljeno) is returned as HTML.
 *
 * Trails (poti) always come from data/poti/*.geojson — see README.md
 * "Dodajanje prave GPX trase" for the zero-code-change contract this
 * loader honours. A stage trail's colour, name and section are NOT taken
 * from its file: they are joined from the live stage (`etape.barva` is the
 * single source of a stage's colour).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { unstable_cache } from "next/cache";
import seedData from "@/tocke.seed.json";
import type { Etapa, Pot, Tocka } from "@/lib/types";
import { getQrUrl } from "@/lib/qr";
import { ETAPE_SEED, findEtapa, sortEtape } from "@/lib/etape";
import { isCmsConfigured } from "@/lib/cms";
import { besediloVHtml, etapaIzDokumenta, tockaIzDokumenta, type LexicalDokument } from "@/lib/cmsMapiranje";
import { sestaviObroc } from "@/lib/trase";
import { getTraseRepo } from "@/lib/traseRepo";
import type { Obroc } from "@/lib/trasaIzris";
import { OZNAKE_PREDPOMNILNIKA } from "@/lib/cacheOznake";

const POTI_DIR = join(process.cwd(), "data", "poti");


// ---------------------------------------------------------------------------
// Cache + fallback plumbing
// ---------------------------------------------------------------------------

/**
 * Next's data cache, tagged. Outside Next (tsx scripts such as
 * `npm run trase` / export-seed) there is no cache to use, so the loader
 * runs directly.
 */
function predpomni<T>(nalozi: () => Promise<T>, kljuc: string, oznaka: string): () => Promise<T> {
  if (!process.env.NEXT_RUNTIME) return nalozi;
  return unstable_cache(nalozi, [kljuc], { tags: [oznaka] });
}

function smeUporabitiSeed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build";
}

/** Database first; on failure the seed (build/dev) or rethrow (production runtime). See header. */
async function izBazeAliSeed<T>(ime: string, izBaze: () => Promise<T>, izSeeda: () => T): Promise<T> {
  try {
    return await izBaze();
  } catch (err) {
    if (!smeUporabitiSeed()) throw err;
    const razlog = err instanceof Error ? err.message : String(err);
    console.warn(`[data] ${ime}: baza ni dosegljiva, uporabljam tocke.seed.json / ETAPE_SEED. (${razlog})`);
    return izSeeda();
  }
}

/** Payload's Local API, loaded only when the CMS is configured (the no-.env path never imports Payload). */
async function payload() {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("@payload-config")]);
  return getPayload({ config });
}

// ---------------------------------------------------------------------------
// Stages (etape)
// ---------------------------------------------------------------------------

function seedEtape(): Etapa[] {
  return sortEtape(ETAPE_SEED.filter((e) => e.vidna));
}

/** Visible stages straight from the database, uncached. Also used by the admin's route recompute. */
export async function naloziEtapeIzBaze(): Promise<Etapa[]> {
  const { docs } = await (await payload()).find({
    collection: "etape",
    where: { vidna: { equals: true } },
    sort: "stevilka",
    depth: 0,
    limit: 0,
    pagination: false,
  });
  return docs.map(etapaIzDokumenta);
}

const etapeIzPredpomnilnika = predpomni(naloziEtapeIzBaze, "cms-etape", OZNAKE_PREDPOMNILNIKA.etape);

/** Public, visible stages in display order (`stevilka`). */
export async function getEtape(): Promise<Etapa[]> {
  if (!isCmsConfigured()) return seedEtape();
  return izBazeAliSeed("etape", etapeIzPredpomnilnika, seedEtape);
}

export async function getEtapa(id: string): Promise<Etapa | null> {
  const etape = await getEtape();
  return findEtapa(etape, id) ?? null;
}

// ---------------------------------------------------------------------------
// Points (tocke)
// ---------------------------------------------------------------------------

const REQUIRED_STRING_FIELDS = ["id", "slug", "naziv", "obmocje", "vrsta", "iztocnica"] as const;

/**
 * Minimal runtime shape-check. This is not full schema validation — it
 * exists so a corrupted or hand-edited tocke.seed.json fails loudly at
 * startup instead of silently rendering a blank map.
 */
function assertValidTocke(raw: unknown): asserts raw is Tocka[] {
  if (!Array.isArray(raw)) {
    throw new Error("tocke.seed.json ni seznam (array) — preveri strukturo datoteke.");
  }
  raw.forEach((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`tocke.seed.json[${i}] ni objekt.`);
    }
    for (const field of REQUIRED_STRING_FIELDS) {
      const value = (item as Record<string, unknown>)[field];
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`tocke.seed.json[${i}] (${(item as Record<string, unknown>).id ?? "?"}) manjka polje "${field}".`);
      }
    }
    const lat = (item as Record<string, unknown>).lat;
    const lon = (item as Record<string, unknown>).lon;
    if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lon !== "number" || !Number.isFinite(lon)) {
      throw new Error(`tocke.seed.json[${i}] (${(item as Record<string, unknown>).id ?? "?"}) ima neveljaven lat/lon.`);
    }
  });
}

/** Fills the read-time fields: `qr_url` (lib/qr.ts) and `odsek` (from the stage). */
function withDerivedFields(tocka: Tocka, etape: Etapa[]): Tocka {
  return {
    ...tocka,
    qr_url: getQrUrl(tocka.id),
    odsek: findEtapa(etape, tocka.etapa)?.odsek ?? "",
  };
}

/** Stage display order first, then walking order within the stage. */
function compareByEtapaZaporedje(etape: Etapa[]) {
  const stevilka = (t: Tocka) => findEtapa(etape, t.etapa)?.stevilka ?? Number.MAX_SAFE_INTEGER;
  return (a: Tocka, b: Tocka) =>
    stevilka(a) - stevilka(b) ||
    (a.zaporedje ?? Number.MAX_SAFE_INTEGER) - (b.zaporedje ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id);
}

function loadSeedPoints(): Tocka[] {
  assertValidTocke(seedData);
  return seedData;
}

/**
 * Published seed points, with besedilo_poglobljeno as HTML so both sources
 * hand the page the same format. The public site only ever sees "objavljeno".
 */
function seedTocke(): Tocka[] {
  return loadSeedPoints()
    .filter((t) => t.status === "objavljeno")
    .map((t) => ({ ...t, besedilo_poglobljeno: besediloVHtml(t.besedilo_poglobljeno) }));
}

async function lexicalVHtml() {
  const { convertLexicalToHTML } = await import("@payloadcms/richtext-lexical/html");
  return (doc: LexicalDokument | null | undefined) =>
    doc ? convertLexicalToHTML({ data: doc as Parameters<typeof convertLexicalToHTML>[0]["data"], disableContainer: true }) || null : null;
}

/**
 * Published points straight from the database, uncached. `draft: false`
 * reads the published version even when a newer draft exists. Also used by
 * the admin's route recompute, which must see a save immediately.
 */
export async function naloziTockeIzBaze(): Promise<Tocka[]> {
  const [p, vHtml] = await Promise.all([payload(), lexicalVHtml()]);
  const { docs } = await p.find({
    collection: "tocke",
    where: { _status: { equals: "published" } },
    draft: false,
    depth: 1,
    limit: 0,
    pagination: false,
  });
  return docs.map((d) => tockaIzDokumenta(d, vHtml));
}

const tockeIzPredpomnilnika = predpomni(naloziTockeIzBaze, "cms-tocke", OZNAKE_PREDPOMNILNIKA.tocke);

/**
 * All published points. A point whose stage is hidden (or missing) is
 * still returned — it shows on the map like a point with no stage, just
 * not as part of any route.
 */
export async function getPoints(): Promise<Tocka[]> {
  const [raw, etape] = await Promise.all([
    isCmsConfigured() ? izBazeAliSeed("tocke", tockeIzPredpomnilnika, seedTocke) : Promise.resolve(seedTocke()),
    getEtape(),
  ]);
  return raw.map((t) => withDerivedFields(t, etape)).sort(compareByEtapaZaporedje(etape));
}

export async function getPoint(slug: string): Promise<Tocka | null> {
  const points = await getPoints();
  return points.find((p) => p.slug === slug) ?? null;
}

export async function getPointById(id: string): Promise<Tocka | null> {
  const points = await getPoints();
  const normalized = id.toUpperCase();
  return points.find((p) => p.id.toUpperCase() === normalized) ?? null;
}

/**
 * The point ID a slug belonged to in tocke.seed.json. QR plaques redirect
 * through the seed (proxy.ts) without touching the database, so if an
 * editor renamed a slug since the last seed export, the old slug must
 * still lead to the point — the point page uses this to redirect.
 */
export function getSeedIdZaSlug(slug: string): string | null {
  return loadSeedPoints().find((t) => t.slug === slug)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Trails (poti)
// ---------------------------------------------------------------------------

interface PotGeoJsonProperties {
  slug: string;
  naziv: string;
  vrsta: Pot["vrsta"];
  etapa: number | null;
  odsek: string | null;
  /** Only read for non-stage trails (the 1943 wire); stage colours come from `etape`. */
  barva?: string;
  status: Pot["status"];
  tocke_ids: string[];
}

interface PotGeoJsonFeature {
  type: "Feature";
  properties: PotGeoJsonProperties;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

interface PotGeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: PotGeoJsonFeature[];
}

function parsePotFile(filename: string): PotGeoJsonFeature {
  const raw = readFileSync(join(POTI_DIR, filename), "utf-8");
  const parsed = JSON.parse(raw) as PotGeoJsonFeatureCollection;
  const feature = parsed.features.find((f) => f.geometry.type === "LineString");
  if (!feature) {
    throw new Error(`${filename} ne vsebuje LineString feature-ja.`);
  }
  return feature;
}

/**
 * A stage trail takes its identity from the live stage: colour, number,
 * name and section. Returns null for a stage that is hidden or no longer
 * exists — its fallback file must not show publicly.
 */
function toPot({ properties, geometry }: PotGeoJsonFeature, etape: Etapa[]): Pot | null {
  const base = { slug: properties.slug, vrsta: properties.vrsta, status: properties.status, tocke_ids: properties.tocke_ids, geometry };
  if (properties.vrsta === "etapa") {
    const etapa = findEtapa(etape, properties.slug);
    if (!etapa) return null;
    return {
      ...base,
      naziv: etapa.odsek ? `${etapa.naziv}: ${etapa.odsek}` : etapa.naziv,
      etapa: etapa.stevilka,
      odsek: etapa.odsek,
      barva: etapa.barva,
    };
  }
  if (!properties.barva) {
    throw new Error(`${properties.slug}.geojson nima lastnosti "barva".`);
  }
  return { ...base, naziv: properties.naziv, etapa: null, odsek: properties.odsek, barva: properties.barva };
}

/**
 * Reads every *.geojson file in data/poti/. Dropping in a real GPX-derived
 * file later (with the same properties shape) needs zero code changes —
 * this loader doesn't know or care whether a file was generated or
 * hand-authored, or how many stages there are.
 */
export async function getPoti(): Promise<Pot[]> {
  const etape = await getEtape();
  const files = readdirSync(POTI_DIR).filter((f) => f.endsWith(".geojson"));
  const poti = files.map(parsePotFile).map((f) => toPot(f, etape)).filter((p): p is Pot => p !== null);
  return poti.sort((a, b) => {
    if (a.etapa !== null && b.etapa !== null) return a.etapa - b.etapa;
    if (a.etapa === null && b.etapa === null) return a.slug.localeCompare(b.slug);
    return a.etapa === null ? 1 : -1; // etapas before the 1943 layer
  });
}

const traseIzPredpomnilnika = predpomni(() => getTraseRepo().vse(), "trase", OZNAKE_PREDPOMNILNIKA.trase);

/**
 * The stage ring the map draws: cached routes where current, the schematic
 * fallback elsewhere (lib/trase.ts sestaviObroc). Reads the route cache
 * only — never triggers a routing call. Storage in lib/traseRepo.ts:
 * Supabase rows, with committed data/trase/ files for blocks not in the
 * database; with neither it is entirely schematic.
 */
export async function getObroc(): Promise<Obroc> {
  const vrstice = traseIzPredpomnilnika().catch((err: unknown) => {
    // Routes are an enhancement: without them every stage is drawn schematically.
    if (!smeUporabitiSeed()) throw err;
    console.warn(`[data] trase: ni mogoče prebrati, rišem shematsko. (${err instanceof Error ? err.message : err})`);
    return [];
  });
  const [etape, points, poti, vrsticeTras] = await Promise.all([getEtape(), getPoints(), getPoti(), vrstice]);
  return sestaviObroc(etape, points, vrsticeTras, poti);
}

export async function getPot(slug: string): Promise<Pot | null> {
  const poti = await getPoti();
  return poti.find((p) => p.slug === slug) ?? null;
}
