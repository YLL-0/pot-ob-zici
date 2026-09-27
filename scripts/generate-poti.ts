/**
 * Generates data/poti/etapa-{1..8}.geojson from tocke.seed.json.
 *
 * We have no real trail geometry (no GPX from the client), so this script
 * fakes it honestly: each stage's line is built by taking that stage's
 * on-trail points (excluding "Razširjeni * krak" extended-branch points,
 * which never belong on a stage line), ordering them geographically
 * between two hand-placed anchor waypoints (data/sidrisca.json), and
 * smoothing the result with Chaikin's corner-cutting algorithm.
 *
 * The 8 stages form a closed loop (Loka → Bršljin → … → Drska → Loka), so
 * consecutive stages share an anchor and their lines visually connect.
 * Every generated feature is stamped `"status": "shematsko"` — never
 * presented as a surveyed path.
 *
 * Re-run with `npm run generate:poti`. Safe to re-run any time; it only
 * writes into data/poti/etapa-*.geojson, never data/poti/zica-1943.geojson
 * (that one is hand-authored, not generated) and never touches the
 * committed tocke.seed.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Tocka } from "../lib/types";
import { ETAPA_BARVE } from "../lib/etape";

interface LatLon {
  lat: number;
  lon: number;
}

interface Sidrisce extends LatLon {
  naziv: string;
}

const ROOT = join(import.meta.dirname, "..");

function loadPoints(): Tocka[] {
  const raw = readFileSync(join(ROOT, "tocke.seed.json"), "utf-8");
  return JSON.parse(raw) as Tocka[];
}

function loadSidrisca(): Sidrisce[] {
  const raw = readFileSync(join(ROOT, "data", "sidrisca.json"), "utf-8");
  const parsed = JSON.parse(raw) as { sidrisca: Sidrisce[] };
  return parsed.sidrisca;
}

/** True for points that belong on a stage's main line (not an extended branch). */
function isOnTrail(tocka: Tocka): boolean {
  return !tocka.vkljucitev.startsWith("Razširjeni");
}

/**
 * Orders points by their scalar projection onto the vector from `start` to
 * `end`, so they run in the same direction as the stage's walking sense.
 * Within a dense cluster (e.g. the 12 old-town points of stage 8) this is
 * still only an approximation of real walking order — that's expected of
 * schematic geometry and is why every feature carries "status": "shematsko".
 */
function orderByProjection(points: Tocka[], start: LatLon, end: LatLon): Tocka[] {
  const dx = end.lon - start.lon;
  const dy = end.lat - start.lat;
  return [...points].sort((a, b) => {
    const pa = (a.lon - start.lon) * dx + (a.lat - start.lat) * dy;
    const pb = (b.lon - start.lon) * dx + (b.lat - start.lat) * dy;
    return pa - pb;
  });
}

/**
 * Chaikin corner-cutting for an OPEN polyline. Preserves the exact first
 * and last coordinate across every iteration (so adjacent stages keep
 * sharing the same anchor point) and only softens interior corners.
 */
function chaikinOpen(points: [number, number][], iterations: number): [number, number][] {
  let current = points;
  for (let iter = 0; iter < iterations; iter++) {
    if (current.length < 3) break;
    const next: [number, number][] = [current[0]!];
    for (let i = 0; i < current.length - 1; i++) {
      const [x0, y0] = current[i]!;
      const [x1, y1] = current[i + 1]!;
      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      next.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    next.push(current[current.length - 1]!);
    current = next;
  }
  return current;
}

function buildEtapaGeoJson(etapa: number, points: Tocka[], sidrisca: Sidrisce[]) {
  const start = sidrisca[etapa - 1]!;
  const end = sidrisca[etapa % sidrisca.length]!;
  const stagePoints = orderByProjection(
    points.filter((p) => p.etapa === etapa && isOnTrail(p)),
    start,
    end,
  );

  const rawPathWithDupes: [number, number][] = [
    [start.lon, start.lat],
    ...stagePoints.map((p): [number, number] => [p.lon, p.lat]),
    [end.lon, end.lat],
  ];
  // Guard against an anchor coinciding exactly with one of its own stage's
  // points (a zero-length segment makes Chaikin repeat that coordinate on
  // every iteration instead of smoothing). Anchors are chosen to avoid this,
  // but this keeps a future data change from silently reintroducing it.
  const rawPath = rawPathWithDupes.filter(
    (coord, i) => i === 0 || coord[0] !== rawPathWithDupes[i - 1]![0] || coord[1] !== rawPathWithDupes[i - 1]![1],
  );
  const smoothed = chaikinOpen(rawPath, 4);

  const odsek = stagePoints[0]?.odsek ?? `${start.naziv} – ${end.naziv}`;

  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {
          slug: `etapa-${etapa}`,
          naziv: `Etapa ${etapa}: ${odsek}`,
          vrsta: "etapa",
          etapa,
          odsek,
          barva: ETAPA_BARVE[etapa],
          status: "shematsko",
          tocke_ids: stagePoints.map((p) => p.id),
        },
        geometry: {
          type: "LineString" as const,
          coordinates: smoothed,
        },
      },
    ],
  };
}

function main() {
  const points = loadPoints();
  const sidrisca = loadSidrisca();

  if (sidrisca.length !== 8) {
    throw new Error(`Pričakovanih 8 sidrišč, najdenih ${sidrisca.length}.`);
  }

  for (let etapa = 1; etapa <= 8; etapa++) {
    const geojson = buildEtapaGeoJson(etapa, points, sidrisca);
    const path = join(ROOT, "data", "poti", `etapa-${etapa}.geojson`);
    writeFileSync(path, JSON.stringify(geojson, null, 2) + "\n", "utf-8");
    const n = geojson.features[0]!.properties.tocke_ids.length;
    console.log(`  etapa-${etapa}.geojson  (${n} točk na trasi)`);
  }

  console.log("Generirano. zica-1943.geojson ni bil spremenjen (ročno avtoriran, ni generiran).");
}

main();
