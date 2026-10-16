import { NextResponse, type NextRequest } from "next/server";
import { OrsNapaka, isOrsConfigured, orsDirections } from "@/lib/ors";

/**
 * Server-side proxy for OpenRouteService foot-walking directions. The API
 * key (ORS_API_KEY, server env) is only read in lib/ors.ts — it never
 * reaches the browser. See lib/routing.ts for the client side of this.
 *
 * Caching: a simple in-memory Map, rounded to ~11m so nearby requests
 * share a cache entry. This is a best-effort cache for a single warm
 * server process — it does NOT persist across a serverless cold start or
 * across multiple instances. On Vercel that means it helps within a warm
 * lambda but isn't a real shared cache; a production deployment that gets
 * meaningful traffic should replace this with Vercel KV / Upstash Redis
 * (a new-dependency decision, not made here). The response also carries
 * an HTTP Cache-Control header so browsers/CDN can cache identical
 * requests regardless of this in-memory layer.
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — a walking route between two fixed points doesn't change
const cache = new Map<string, CacheEntry>();

function round(n: number): number {
  return Math.round(n * 10000) / 10000; // ~11m precision
}

function cacheKey(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
  return `${round(fromLat)},${round(fromLon)}|${round(toLat)},${round(toLon)}`;
}

function parseCoord(value: string | null, name: string): number {
  const n = Number(value);
  if (value === null || !Number.isFinite(n)) {
    throw new Error(`Manjka ali neveljaven parameter "${name}".`);
  }
  return n;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  let fromLat: number, fromLon: number, toLat: number, toLon: number;
  try {
    fromLat = parseCoord(params.get("fromLat"), "fromLat");
    fromLon = parseCoord(params.get("fromLon"), "fromLon");
    toLat = parseCoord(params.get("toLat"), "toLat");
    toLon = parseCoord(params.get("toLon"), "toLon");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Neveljavni parametri." }, { status: 400 });
  }

  if (!isOrsConfigured()) {
    // Clear "route unavailable" state (acceptance criteria) — the external
    // maps fallback link stays available regardless of this.
    return NextResponse.json({ error: "ORS_API_KEY ni nastavljen." }, { status: 503 });
  }

  const key = cacheKey(fromLat, fromLon, toLat, toLon);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "private, max-age=300" } });
  }

  let result;
  try {
    const route = await orsDirections(
      [
        [fromLon, fromLat],
        [toLon, toLat],
      ],
      { koraki: true },
    );
    const segment = route.segments[0]!;
    result = {
      geometry: route.geometry,
      distanceMeters: segment.distance,
      durationSeconds: segment.duration,
      steps: segment.steps.map((s) => ({ instruction: s.instruction, distanceMeters: s.distance })),
    };
  } catch (err) {
    if (!(err instanceof OrsNapaka)) throw err;
    console.error("[api/route] Napaka pri izračunu poti:", err.message);
    return NextResponse.json({ error: "Poti trenutno ni mogoče izračunati." }, { status: 502 });
  }

  cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
}
