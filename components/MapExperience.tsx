"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Etapa, Pot, Tocka } from "@/lib/types";
import { filterTocke, isRazsirjeniKrak } from "@/lib/filters";
import { statusOdsekov, vidniOdseki, SPOROCILO_ZICA, type Obroc } from "@/lib/trasaIzris";
import { useFilterState } from "@/hooks/useFilterState";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { RouteState } from "@/lib/routing";
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
  etape: Etapa[];
  obroc: Obroc;
}

export default function MapExperience({ points, poti, etape, obroc }: MapExperienceProps) {
  const [filters, setFilters] = useFilterState();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [desktopExpanded, setDesktopExpanded] = useState(true);
  const [sheetState, setSheetState] = useState<SheetState>("peek");
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });

  const visiblePoints = useMemo(() => filterTocke(points, filters, etape), [points, filters, etape]);

  // Selected stages (URL `?etapa=` holds display numbers), as stage IDs.
  const izbraneEtapaIds = useMemo(
    () => etape.filter((e) => filters.etape.includes(e.stevilka)).map((e) => e.id),
    [etape, filters.etape],
  );

  // The emphasised stage: the selected point's, or the selected stage trail.
  const poudarjenaEtapaId = useMemo(() => {
    if (filters.tocka) return points.find((p) => p.id === filters.tocka)?.etapa ?? null;
    return etape.some((e) => e.id === filters.pot) ? filters.pot : null;
  }, [filters.tocka, filters.pot, points, etape]);

  // Walking order 1, 2, 3 … — only with exactly one stage selected (with
  // several the numbers would be ambiguous). Counted over the stage's
  // points on the line (`points` arrive in walking order), so a search
  // filter never renumbers them; extended-branch points get no number.
  const zaporedneStevilke = useMemo(() => {
    if (izbraneEtapaIds.length !== 1) return null;
    const naCrti = points.filter((p) => p.etapa === izbraneEtapaIds[0] && !isRazsirjeniKrak(p));
    return new Map(naCrti.map((p, i) => [p.id, i + 1]));
  }, [izbraneEtapaIds, points]);

  // Honest labelling of what is drawn: routed, partly schematic, or schematic.
  const status = statusOdsekov(vidniOdseki(obroc, izbraneEtapaIds));
  const zicaVidna = filters.zica || filters.pot === "zica-1943";

  function selectTocka(id: string | null) {
    setFilters({ tocka: id, pot: null });
  }
  function selectPot(slug: string | null) {
    setFilters({ pot: slug, tocka: null });
  }
  // Stable identity (only depends on the setter, which React guarantees is
  // stable) so it's safe as a MapView effect dependency without churn.
  const handleRouteChange = useCallback((state: RouteState) => setRouteState(state), []);
  function clearRoute() {
    setRouteState({ status: "idle" });
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
          etape={etape}
          filters={filters}
          setFilters={setFilters}
          selectedTockaId={filters.tocka}
          selectedPotSlug={filters.pot}
          poudarjenaEtapaId={poudarjenaEtapaId}
          onSelectTocka={selectTocka}
          onSelectPot={selectPot}
          expanded={desktopExpanded}
          sheetState={sheetState}
          onSheetStateChange={setSheetState}
          routeState={routeState}
          onClearRoute={clearRoute}
        />
        <main className="relative min-w-0 flex-1">
          <MapView
            points={points}
            visiblePoints={visiblePoints}
            poti={poti}
            etape={etape}
            obroc={obroc}
            izbraneEtapaIds={izbraneEtapaIds}
            poudarjenaEtapaId={poudarjenaEtapaId}
            zaporedneStevilke={zaporedneStevilke}
            selectedTockaId={filters.tocka}
            selectedPotSlug={filters.pot}
            prefersReducedMotion={prefersReducedMotion}
            onSelectTocka={selectTocka}
            onSelectPot={selectPot}
            zicaVidna={filters.zica}
            routeTockaId={routeState.status === "idle" ? null : routeState.tocka.id}
            onRouteChange={handleRouteChange}
          />
          <Legend etape={etape} />
          {/* Hidden while a point's popup is open: on a phone it would cover
              the popup, which labels the stage line itself. */}
          {!filters.tocka && (status || zicaVidna) && (
            <div
              role="status"
              className="map-chrome pointer-events-none absolute top-3 left-3 z-10 max-w-[min(62vw,22rem)] space-y-0.5 rounded px-3 py-1.5 text-xs shadow-lg"
            >
              {status && <p>{status.sporocilo}</p>}
              {zicaVidna && <p>{SPOROCILO_ZICA}</p>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
