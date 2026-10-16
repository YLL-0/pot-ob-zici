/**
 * The ONLY place in the app allowed to fetch point/trail data. Components
 * must import from here, never call Supabase or read data/poti/ directly
 * (CLAUDE.md convention).
 *
 * getPoints() reads Supabase if NEXT_PUBLIC_SUPABASE_URL is set, otherwise
 * falls back to tocke.seed.json. A fresh clone with no .env must
 * `npm run dev` and show all 50 points — this fallback is what makes that
 * true, and it must never become a hard Supabase dependency.
 *
 * Stages (etape) follow the same rule: Supabase `etape` if configured,
 * otherwise lib/etape.ts ETAPE_SEED. A point's `odsek` is always taken
 * from its stage on read (it is not stored in Supabase).
 *
 * Trails (poti) always come from data/poti/*.geojson regardless of
 * Supabase config — see README.md "Dodajanje prave GPX trase" for the
 * zero-code-change contract this loader honours.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import seedData from "@/tocke.seed.json";
import type { Etapa, Pot, Tocka } from "@/lib/types";
import { getQrUrl } from "@/lib/qr";
import { ETAPE_SEED, findEtapa, sortEtape } from "@/lib/etape";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const POTI_DIR = join(process.cwd(), "data", "poti");

// ---------------------------------------------------------------------------
// Stages (etape)
// ---------------------------------------------------------------------------

async function loadSupabaseEtape(): Promise<Etapa[]> {
  const supabase = getSupabaseClient();
  // RLS limits the anon client to `vidna = true`; filtered here as well so
  // the public result doesn't depend on which client reads it.
  const { data, error } = await supabase.from("etape").select("*").eq("vidna", true).order("stevilka");
  if (error) {
    throw new Error(`Napaka pri branju etap iz Supabase: ${error.message}`);
  }
  return (data ?? []) as Etapa[];
}

/** Public, visible stages in display order (`stevilka`). */
export async function getEtape(): Promise<Etapa[]> {
  if (isSupabaseConfigured()) {
    return loadSupabaseEtape();
  }
  return sortEtape(ETAPE_SEED.filter((e) => e.vidna));
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

async function loadSupabasePoints(): Promise<Tocka[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("tocke").select("*").eq("status", "objavljeno");

  if (error) {
    throw new Error(`Napaka pri branju točk iz Supabase: ${error.message}`);
  }
  return (data ?? []) as Tocka[];
}

/**
 * All points. Public site only ever sees status "objavljeno" — filtered
 * here in the seed path too, so demo behaviour matches production
 * behaviour from day one (today this filters out nothing: all 50 seed
 * rows are already "objavljeno").
 *
 * A point whose stage is hidden (or missing) is still returned — it shows
 * on the map like a point with no stage, just not as part of any route.
 */
export async function getPoints(): Promise<Tocka[]> {
  const [raw, etape] = await Promise.all([
    isSupabaseConfigured()
      ? loadSupabasePoints()
      : Promise.resolve(loadSeedPoints().filter((t) => t.status === "objavljeno")),
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

// ---------------------------------------------------------------------------
// Trails (poti)
// ---------------------------------------------------------------------------

interface PotGeoJsonProperties {
  slug: string;
  naziv: string;
  vrsta: Pot["vrsta"];
  etapa: number | null;
  odsek: string | null;
  barva: string;
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

function parsePotFile(filename: string): Pot {
  const raw = readFileSync(join(POTI_DIR, filename), "utf-8");
  const parsed = JSON.parse(raw) as PotGeoJsonFeatureCollection;
  const feature = parsed.features.find((f) => f.geometry.type === "LineString");
  if (!feature) {
    throw new Error(`${filename} ne vsebuje LineString feature-ja.`);
  }
  const { properties, geometry } = feature;
  return {
    slug: properties.slug,
    naziv: properties.naziv,
    vrsta: properties.vrsta,
    etapa: properties.etapa,
    odsek: properties.odsek,
    barva: properties.barva,
    status: properties.status,
    tocke_ids: properties.tocke_ids,
    geometry,
  };
}

/**
 * Reads every *.geojson file in data/poti/. Dropping in a real GPX-derived
 * file later (with the same properties shape) needs zero code changes —
 * this loader doesn't know or care whether a file was generated or
 * hand-authored, or how many stages there are.
 */
export async function getPoti(): Promise<Pot[]> {
  const files = readdirSync(POTI_DIR).filter((f) => f.endsWith(".geojson"));
  return files.map(parsePotFile).sort((a, b) => {
    if (a.etapa !== null && b.etapa !== null) return a.etapa - b.etapa;
    if (a.etapa === null && b.etapa === null) return a.slug.localeCompare(b.slug);
    return a.etapa === null ? 1 : -1; // etapas before the 1943 layer
  });
}

export async function getPot(slug: string): Promise<Pot | null> {
  const poti = await getPoti();
  return poti.find((p) => p.slug === slug) ?? null;
}
