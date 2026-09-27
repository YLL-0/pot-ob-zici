"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FilterState, parseFilters, serializeFilters } from "@/lib/filters";

type FilterUpdater = Partial<FilterState> | ((prev: FilterState) => Partial<FilterState>);

/**
 * Reads/writes the map page's filter + selection state from the URL query
 * string (CLAUDE.md convention: filter state lives in the URL, not React
 * state) — this is what makes a filtered view shareable and what lets
 * clicking a marker and clicking its panel row converge on the same state.
 */
export function useFilterState(): [FilterState, (update: FilterUpdater) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const setFilters = useCallback(
    (update: FilterUpdater) => {
      const partial = typeof update === "function" ? update(filters) : update;
      const next = { ...filters, ...partial };
      const qs = serializeFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  return [filters, setFilters];
}
