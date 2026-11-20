import { Suspense } from "react";
import { getEtape, getObroc, getPoints, getPoti } from "@/lib/data";
import MapExperience from "@/components/MapExperience";

// Static: prerendered from lib/data.ts's cached reads and re-rendered when
// an admin save expires them (cms/revalidacija.ts) — no database query per
// visit, so a paused database never takes the map down.

/**
 * The map IS the homepage — full-screen map, side panel, no page scroll.
 * See PROMPT.md "Layout of / (the map page)".
 */
export default async function HomePage() {
  const [points, poti, etape, obroc] = await Promise.all([getPoints(), getPoti(), getEtape(), getObroc()]);

  return (
    <Suspense fallback={null}>
      <MapExperience points={points} poti={poti} etape={etape} obroc={obroc} />
    </Suspense>
  );
}
