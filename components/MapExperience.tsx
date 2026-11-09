"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Etapa, Pot, Tocka } from "@/lib/types";
import { filterTocke, isRazsirjeniKrak, toggleInArray } from "@/lib/filters";
import { stevnikObelezij } from "@/lib/etape";
import { BESEDILO_PRIBLIZEK, steviloPoZanesljivosti } from "@/lib/gpsOznaka";
import { statusOdsekov, vidniOdseki, SPOROCILO_ZICA, type Obroc } from "@/lib/trasaIzris";
import { useFilterState } from "@/hooks/useFilterState";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { RouteState } from "@/lib/routing";
import SiteHeader from "@/components/SiteHeader";
import Nadnaslov from "@/components/Nadnaslov";
import Obvestilo from "@/components/Obvestilo";
import { EtapeCipi, EtapeSeznam } from "@/components/EtapeIzbira";
import Filtri from "@/components/Filtri";
import Navigacija from "@/components/Navigacija";
import Legend from "@/components/Legend";
import SeznamObelezij from "@/components/SeznamObelezij";

// The map island is client-side and lazy-loaded — it never needs to be
// part of the initial server-rendered bundle.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-tonirano text-sm text-crnilo-mehko">
      Nalagam zemljevid …
    </div>
  ),
});

interface MapExperienceProps {
  points: Tocka[];
  poti: Pot[];
  etape: Etapa[];
  obroc: Obroc;
}

/**
 * The home page. A compact top in the editorial column (heading,
 * coordinates notice, stage chips, search and filters), then the map as
 * the page's main element — wider than the column and as tall as the
 * viewport below the header (POPRAVKI_2 §2) — then the stage list and all
 * points by stage. All selection and filter state is in the URL.
 */
export default function MapExperience({ points, poti, etape, obroc }: MapExperienceProps) {
  const [filters, setFilters] = useFilterState();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [routeState, setRouteState] = useState<RouteState>({ status: "idle" });
  const zemljevidRef = useRef<HTMLDivElement>(null);

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

  // Coordinates notice follows the data: register-sourced positions get the
  // register wording; the stronger caveat stays only while some point is
  // still on the Excel's approximation (POPRAVKI_2 §1).
  const gps = useMemo(() => steviloPoZanesljivosti(points), [points]);

  const steviloNaEtapi = useCallback((etapaId: string) => points.filter((p) => p.etapa === etapaId).length, [points]);

  // Honest labelling of what is drawn: routed, partly schematic, or schematic.
  const status = statusOdsekov(vidniOdseki(obroc, izbraneEtapaIds));
  const zicaVidna = filters.zica || filters.pot === "zica-1943";

  function selectTocka(id: string | null) {
    setFilters({ tocka: id, pot: null });
  }
  function selectPot(slug: string | null) {
    setFilters({ pot: slug, tocka: null });
  }
  function preklopiEtapo(stevilka: number) {
    setFilters((prev) => ({ etape: toggleInArray(prev.etape, stevilka), pot: null }));
  }
  function vseEtape() {
    setFilters({ etape: [], pot: null });
  }
  /** From the lists below the map: select, then bring the map into view. */
  function pokaziNaZemljevidu(fn: () => void) {
    fn();
    zemljevidRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  }
  // Stable identity (only depends on the setter, which React guarantees is
  // stable) so it's safe as a MapView effect dependency without churn.
  const handleRouteChange = useCallback((state: RouteState) => setRouteState(state), []);

  return (
    <div className="min-h-dvh bg-papir">
      <SiteHeader />
      <main className="pb-20">
        {/* Same layout as the client's prototype: one container; title,
            notice, chips + search and the map all fit on the first screen. */}
        <div className="mx-auto max-w-zemljevid space-y-3 px-4 pt-5 pb-3 sm:px-6 sm:pt-6">
          <Nadnaslov
            kompaktno
            nadnaslov="Novo mesto · Dolenjska"
            naslov="Pot ob žici"
            uvod={`Spominska pot okoli Novega mesta — ${stevnikObelezij(points.length)} na ${etape.length} etapah.`}
          />

          <Obvestilo>
            {gps.zunanji_vir > 0 && (
              <p>
                Lokacije obeležij so iz javnega registra{" "}
                <a
                  href="https://partizanstvo.si/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-poudarek underline underline-offset-4"
                >
                  partizanstvo.si
                </a>{" "}
                — terensko še niso preverjene.
              </p>
            )}
            {gps.priblizek > 0 &&
              (gps.zunanji_vir > 0 ? (
                <p>Pri nekaterih obeležjih je lokacija le izhodiščni približek in ni terensko izmerjena.</p>
              ) : (
                <p>{BESEDILO_PRIBLIZEK}</p>
              ))}
          </Obvestilo>
        </div>

        <section aria-labelledby="naslov-zemljevid" className="space-y-3">
          <h2 id="naslov-zemljevid" className="sr-only">
            Zemljevid in izbira etap
          </h2>
          <div className="mx-auto max-w-zemljevid space-y-2 px-4 sm:px-6">
            {/* Chips and search share one row from lg up. */}
            <div className="space-y-2 lg:flex lg:items-start lg:justify-between lg:gap-4 lg:space-y-0">
              <div className="min-w-0 lg:flex-1">
                <EtapeCipi
                  etape={etape}
                  izbrane={filters.etape}
                  poudarjenaEtapaId={poudarjenaEtapaId}
                  onPreklopi={preklopiEtapo}
                  onVse={vseEtape}
                />
              </div>
              <div className="lg:w-96 lg:shrink-0">
                <Filtri points={points} filters={filters} setFilters={setFilters} />
              </div>
            </div>
            <p className="text-sm text-crnilo-mehko" aria-live="polite">
              Prikazano {visiblePoints.length} od {stevnikObelezij(points.length)}
            </p>
          </div>

          {/* 60% of the screen (floor 26.25rem), as in the prototype, so the
              heading, chips and map are visible together without scrolling.
              svh, not vh — mobile browser chrome would cut a vh map off. */}
          <div className="mx-auto max-w-zemljevid px-4 sm:px-6">
            <div
              ref={zemljevidRef}
              className="relative h-[60svh] min-h-[26.25rem] overflow-hidden rounded-xl border border-crta bg-tonirano"
            >
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
            </div>
          </div>

          <div className="mx-auto max-w-zemljevid space-y-4 px-4 sm:px-6">
            {(status || zicaVidna) && (
              <div role="status" className="space-y-1 text-sm text-crnilo-mehko">
                {status && <p>{status.sporocilo}</p>}
                {zicaVidna && <p>{SPOROCILO_ZICA}</p>}
              </div>
            )}
            <Navigacija routeState={routeState} onClearRoute={() => setRouteState({ status: "idle" })} />
            <Legend />
          </div>
        </section>

        <div className="mx-auto max-w-zemljevid space-y-12 px-4 pt-10 sm:px-6">
          <section aria-labelledby="naslov-etape" className="space-y-4">
            <div>
              <h2 id="naslov-etape" className="font-heading text-2xl font-semibold">
                Etape
              </h2>
              <p className="mt-1 text-sm text-crnilo-mehko">
                {etape.length} zaporednih odsekov ene krožne poti. Klik na etapo jo prikaže na zemljevidu.
              </p>
            </div>
            <EtapeSeznam
              etape={etape}
              izbrane={filters.etape}
              poudarjenaEtapaId={poudarjenaEtapaId}
              onPreklopi={(n) => pokaziNaZemljevidu(() => preklopiEtapo(n))}
              stevilo={steviloNaEtapi}
            />
          </section>

          <section aria-labelledby="naslov-obelezja" className="space-y-4">
            <div>
              <h2 id="naslov-obelezja" className="font-heading text-2xl font-semibold">
                Vsa obeležja po etapah
              </h2>
              <p className="mt-1 text-sm text-crnilo-mehko">Klik na obeležje ga poišče na zemljevidu.</p>
            </div>
            <SeznamObelezij
              etape={etape}
              tocke={visiblePoints}
              selectedTockaId={filters.tocka}
              onSelectTocka={(id) => pokaziNaZemljevidu(() => selectTocka(id))}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
