import type { Tocka } from "@/lib/types";

/**
 * Previous/next point within the same stage, for the detail page's
 * prev/next links, in walking order (`zaporedje`; ID breaks ties and
 * orders any point without one last). A point with no stage has neither.
 */
export function getPrevNextVEtapi(tocka: Tocka, vse: Tocka[]): { prev: Tocka | null; next: Tocka | null } {
  if (tocka.etapa === null) return { prev: null, next: null };
  const vEtapi = vse
    .filter((t) => t.etapa === tocka.etapa)
    .sort(
      (a, b) =>
        (a.zaporedje ?? Number.MAX_SAFE_INTEGER) - (b.zaporedje ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id),
    );
  const index = vEtapi.findIndex((t) => t.id === tocka.id);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? vEtapi[index - 1]! : null,
    next: index < vEtapi.length - 1 ? vEtapi[index + 1]! : null,
  };
}
