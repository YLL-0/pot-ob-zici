import type { Tocka } from "@/lib/types";

/**
 * Previous/next point within the same stage, for the detail page's
 * prev/next links. Ordered by ID rather than the trail's generated walking
 * order (Pot.tocke_ids) — that order excludes extended-branch points
 * entirely, which would leave them with no prev/next at all. ID order at
 * least gives every point a place, at the cost of not being true walking
 * order for on-trail points.
 */
export function getPrevNextVEtapi(tocka: Tocka, vse: Tocka[]): { prev: Tocka | null; next: Tocka | null } {
  const vEtapi = vse.filter((t) => t.etapa === tocka.etapa).sort((a, b) => a.id.localeCompare(b.id));
  const index = vEtapi.findIndex((t) => t.id === tocka.id);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? vEtapi[index - 1]! : null,
    next: index < vEtapi.length - 1 ? vEtapi[index + 1]! : null,
  };
}
