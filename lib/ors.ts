/**
 * Server-only OpenRouteService client (foot-walking directions). The API
 * key (ORS_API_KEY) is read here and never leaves the server — import this
 * only from route handlers, server code and scripts, never from a Client
 * Component.
 *
 * Used by app/api/route/route.ts ("Pelji me tja") and lib/trasiranje.ts
 * (routed stage trails). Failures are thrown as OrsNapaka with a short
 * Slovenian reason the admin can show as-is.
 */

export const ORS_PROFIL = "foot-walking";
export const ORS_ENGINE = `ors/${ORS_PROFIL}`;

const ORS_URL = `https://api.openrouteservice.org/v2/directions/${ORS_PROFIL}/geojson`;
const TIMEOUT_MS = 20_000;
/** ORS snapping radius; points further than this from any path fail with code 2010. */
export const SNAP_RADIUS_M = 350;

export type OrsNapakaKoda = "NI_KLJUCA" | "OMEJITEV" | "NEDOSEGLJIVA_TOCKA" | "NI_POVEZAVE" | "STORITEV";

export class OrsNapaka extends Error {
  koda: OrsNapakaKoda;
  /** For NEDOSEGLJIVA_TOCKA: 0-based index of the offending waypoint, when ORS names it. */
  indeksTocke: number | undefined;
  constructor(koda: OrsNapakaKoda, razlog: string, indeksTocke?: number) {
    super(razlog);
    this.koda = koda;
    this.indeksTocke = indeksTocke;
    this.name = "OrsNapaka";
  }
}

export interface OrsKorak {
  instruction: string;
  distance: number;
}

export interface OrsSegment {
  distance: number;
  duration: number;
  steps: OrsKorak[];
}

export interface OrsRezultat {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance: number;
  duration: number;
  /** One segment per leg (between consecutive waypoints). */
  segments: OrsSegment[];
  /** Index into geometry.coordinates of each (snapped) waypoint. */
  wayPoints: number[];
}

interface OrsResponse {
  features?: {
    geometry: { type: "LineString"; coordinates: [number, number][] };
    properties: {
      summary?: { distance?: number; duration?: number };
      segments?: OrsSegment[];
      way_points?: number[];
    };
  }[];
  error?: { code?: number; message?: string } | string;
}

export function isOrsConfigured(): boolean {
  return Boolean(process.env.ORS_API_KEY);
}

/** Maps an ORS error response to a reason an editor can act on. */
function napakaIzOdgovora(status: number, body: OrsResponse | null): OrsNapaka {
  const error = typeof body?.error === "object" ? body.error : undefined;
  const message = typeof body?.error === "string" ? body.error : (error?.message ?? "");
  if (status === 429) {
    return new OrsNapaka("OMEJITEV", "Presežena omejitev zahtevkov ORS — poskusi znova kasneje.");
  }
  if (status === 401 || status === 403) {
    return new OrsNapaka("NI_KLJUCA", "ORS je zavrnil ključ (ORS_API_KEY) — preveri ga.");
  }
  if (error?.code === 2010) {
    // "Could not find routable point within a radius of 350.0 meters of specified coordinate 2: …"
    const match = /coordinate (\d+)/.exec(message)?.[1];
    const index = match === undefined ? undefined : Number(match);
    return new OrsNapaka(
      "NEDOSEGLJIVA_TOCKA",
      `Točka${index !== undefined ? ` št. ${index + 1}` : ""} je več kot ${SNAP_RADIUS_M} m od najbližje mapirane poti.`,
      index,
    );
  }
  if (error?.code === 2009) {
    return new OrsNapaka("NI_POVEZAVE", "Med točkami ni peš povezave po mapiranih poteh.");
  }
  return new OrsNapaka("STORITEV", `Storitev za izračun poti je vrnila napako (HTTP ${status}).`);
}

/**
 * Walking route through `coordinates` ([lon, lat], 2–50 waypoints) in the
 * given order. Throws OrsNapaka on any failure — never returns a partial
 * or straight-line result.
 */
export async function orsDirections(coordinates: [number, number][], options: { koraki?: boolean } = {}): Promise<OrsRezultat> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    throw new OrsNapaka("NI_KLJUCA", "ORS_API_KEY ni nastavljen.");
  }
  if (coordinates.length < 2) {
    throw new OrsNapaka("NI_POVEZAVE", "Za izračun poti sta potrebni vsaj dve točki.");
  }

  let response: Response;
  try {
    response = await fetch(ORS_URL, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates,
        radiuses: coordinates.map(() => SNAP_RADIUS_M),
        // Always on: with instructions off ORS omits `segments`, and the
        // per-leg distances in them are what the quality checks need.
        instructions: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    throw new OrsNapaka(
      "STORITEV",
      timeout ? "Storitev za izračun poti se ni odzvala pravočasno." : "Storitev za izračun poti ni dosegljiva.",
    );
  }

  const body = (await response.json().catch(() => null)) as OrsResponse | null;
  if (!response.ok) {
    console.error(`[ors] HTTP ${response.status}:`, JSON.stringify(body).slice(0, 500));
    throw napakaIzOdgovora(response.status, body);
  }

  const feature = body?.features?.[0];
  const segments = feature?.properties.segments;
  const wayPoints = feature?.properties.way_points;
  if (!feature || feature.geometry?.type !== "LineString" || !segments || !wayPoints) {
    throw new OrsNapaka("STORITEV", "Storitev za izračun poti ni vrnila poti.");
  }

  return {
    geometry: feature.geometry,
    distance: feature.properties.summary?.distance ?? segments.reduce((s, seg) => s + seg.distance, 0),
    duration: feature.properties.summary?.duration ?? segments.reduce((s, seg) => s + seg.duration, 0),
    segments: segments.map((seg) => ({
      distance: seg.distance,
      duration: seg.duration,
      steps: options.koraki ? (seg.steps ?? []) : [],
    })),
    wayPoints,
  };
}
