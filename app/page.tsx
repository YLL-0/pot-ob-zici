import { Suspense } from "react";
import { getPoints, getPoti } from "@/lib/data";
import MapExperience from "@/components/MapExperience";

// Once Supabase is connected, getPoints()/getPoti() must read current data
// on every request — an admin publishing a point (Phase 4) must show up
// without a redeploy. Force dynamic rendering rather than letting Next
// statically prerender this route at build time.
export const dynamic = "force-dynamic";

/**
 * The map IS the homepage — full-screen map, side panel, no page scroll.
 * See PROMPT.md "Layout of / (the map page)".
 */
export default async function HomePage() {
  const [points, poti] = await Promise.all([getPoints(), getPoti()]);

  return (
    <Suspense fallback={null}>
      <MapExperience points={points} poti={poti} />
    </Suspense>
  );
}
