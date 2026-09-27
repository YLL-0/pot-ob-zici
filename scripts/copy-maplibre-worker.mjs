/**
 * maplibre-gl computes its default worker URL from its own bundled
 * module's `import.meta.url` (see maplibre-gl.mjs, getWorkerUrl()). Under
 * Next.js/webpack that URL doesn't point anywhere fetchable — the worker
 * script never actually ships to a public path — so map init fails with
 * "Worker failed to load. Check that the worker URL is correct." and the
 * canvas stays blank.
 *
 * Fix: copy the worker script into public/ (this file changes only when
 * the maplibre-gl version changes — regenerated on every dev/build rather
 * than committed, so it can never drift from the installed version) and
 * point maplibre at it explicitly via setWorkerUrl() — see lib/mapIcons.ts
 * sibling call site in components/MapView.tsx.
 */

import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const DIST = join(ROOT, "node_modules", "maplibre-gl", "dist");
const PUBLIC = join(ROOT, "public");

// The worker module itself imports maplibre-gl-shared.mjs as a sibling —
// both must be served from the same public path.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

for (const file of FILES) {
  const src = join(DIST, file);
  if (!existsSync(src)) {
    console.warn(`⚠ ${src} ne obstaja — je maplibre-gl nameščen? Preskačem kopiranje worker skript.`);
    process.exit(0);
  }
  copyFileSync(src, join(PUBLIC, file));
}
console.log(`✓ Kopirano v public/: ${FILES.join(", ")}`);
