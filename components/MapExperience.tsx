"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Pot, Tocka } from "@/lib/types";
import { filterTocke } from "@/lib/filters";
import { useFilterState } from "@/hooks/useFilterState";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import TopBar from "@/components/TopBar";
import SidePanel, { type SheetState } from "@/components/SidePanel";
import Legend from "@/components/Legend";

// The map island is client-side and lazy-loaded — it never needs to be
// part of the initial server-rendered bundle.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="map-chrome flex h-full w-full items-center justify-center text-sm">Nalagam zemljevid …</div>,
});

interface MapExperienceProps {
  points: Tocka[];
  poti: Pot[];
}

export default function MapExperience({ points, poti }: MapExperienceProps) {
  const [filters, setFilters] = useFilterState();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const [sheetState, setSheetState] = useState<SheetState>("peek");

  const visiblePoints = useMemo(() => filterTocke(points, filters), [points, filters]);

  function selectTocka(id: string | null) {
    setFilters({ tocka: id, pot: null });
  }
  function selectPot(slug: string | null) {
    setFilters({ pot: slug, tocka: null });
  }
  function togglePanel() {
    // Checked at click time, not render time: which variant is actually
    // visible depends on the CSS breakpoint (see SidePanel), and reading
    // matchMedia here — rather than through a hook that drives what
    // mounts — avoids an SSR/client layout mismatch on first paint.
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) setDesktopExpanded((v) => !v);
    else setSheetState((s) => (s === "peek" ? "half" : "peek"));
  }

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden">
      <TopBar panelExpanded={desktopExpanded || sheetState !== "peek"} onTogglePanel={togglePanel} />
      <div className="relative flex min-h-0 flex-1">
        <SidePanel
          points={points}
          poti={poti}
          filters={filters}
          setFilters={setFilters}
          selectedTockaId={filters.tocka}
          selectedPotSlug={filters.pot}
          onSelectTocka={selectTocka}
          onSelectPot={selectPot}
          expanded={desktopExpanded}
          sheetState={sheetState}
          onSheetStateChange={setSheetState}
        />
        <main className="relative min-w-0 flex-1">
          <MapView
            points={points}
            visiblePoints={visiblePoints}
            poti={poti}
            selectedTockaId={filters.tocka}
            selectedPotSlug={filters.pot}
            prefersReducedMotion={prefersReducedMotion}
            onSelectTocka={selectTocka}
            onSelectPot={selectPot}
          />
          <Legend />
          <p className="map-chrome pointer-events-none absolute top-3 left-3 z-10 max-w-[min(85vw,22rem)] rounded px-3 py-1.5 text-xs shadow-lg">
            Trasa je shematska — prava pot še ni vrisana.
          </p>
        </main>
      </div>
    </div>
  );
}
