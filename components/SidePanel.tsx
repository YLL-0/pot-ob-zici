"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripHorizontal, Search, Type, X } from "lucide-react";
import type { FilterState } from "@/lib/filters";
import { filterTocke, toggleInArray } from "@/lib/filters";
import { ETAPA_ODSEKI, getEtapaBarva } from "@/lib/etape";
import { VRSTA_ICONS, VRSTA_LABELS, VSE_VRSTE } from "@/lib/vrsta";
import { VSE_ZGODBE, ZGODBA_LABELS } from "@/lib/zgodbe";
import { getVecjaPisava, setVecjaPisava } from "@/lib/progress";
import { formatDistance, formatMinutes } from "@/lib/geo";
import type { RouteState } from "@/lib/routing";
import type { Pot, Tocka } from "@/lib/types";

export type SheetState = "peek" | "half" | "full";

interface SidePanelProps {
  points: Tocka[];
  poti: Pot[];
  filters: FilterState;
  setFilters: (update: Partial<FilterState> | ((prev: FilterState) => Partial<FilterState>)) => void;
  selectedTockaId: string | null;
  selectedPotSlug: string | null;
  onSelectTocka: (id: string | null) => void;
  onSelectPot: (slug: string | null) => void;
  expanded: boolean;
  sheetState: SheetState;
  onSheetStateChange: (s: SheetState) => void;
  routeState: RouteState;
  onClearRoute: () => void;
}

const SHEET_HEIGHT: Record<SheetState, string> = {
  peek: "28vh",
  half: "52vh",
  full: "88vh",
};

function nextSheetState(current: SheetState): SheetState {
  if (current === "peek") return "half";
  if (current === "half") return "full";
  return "peek";
}

function VecjaPisavaToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(getVecjaPisava()), []);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setOn(next);
        setVecjaPisava(next);
        document.documentElement.toggleAttribute("data-vecja-pisava", next);
      }}
      aria-pressed={on}
      aria-label="Večja pisava"
      title="Večja pisava"
      className="flex shrink-0 items-center gap-1 rounded border border-charcoal-600 px-2 py-1.5 text-xs font-medium hover:bg-charcoal-800"
    >
      <Type size={14} aria-hidden="true" />
      Aa
    </button>
  );
}

/**
 * "Pelji me tja" result — distance/duration/turn instructions in the panel
 * (Phase 3 spec), triggered from a marker popup on the map. Sits above the
 * filters so it's visible without scrolling once a route is active.
 */
function NavigacijaSection({ routeState, onClearRoute }: { routeState: RouteState; onClearRoute: () => void }) {
  const [showSteps, setShowSteps] = useState(false);
  if (routeState.status === "idle") return null;

  return (
    <div className="shrink-0 border-b border-charcoal-700 bg-charcoal-800 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading text-xs font-semibold tracking-wide text-offwhite-200 uppercase">
          Navigacija · {routeState.tocka.naziv}
        </p>
        <button
          type="button"
          onClick={onClearRoute}
          aria-label="Prekliči navigacijo"
          className="shrink-0 rounded p-0.5 hover:bg-charcoal-700"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {routeState.status === "loading" && <p className="mt-1.5 text-sm">Iščem pot …</p>}

      {routeState.status === "error" && (
        <p className="mt-1.5 text-sm text-accent-red">
          {routeState.error} Uporabi zunanjo aplikacijo v pojavnem oknu obeležja.
        </p>
      )}

      {routeState.status === "ready" && (
        <div className="mt-1.5">
          <p className="text-sm">
            {formatDistance(routeState.route.distanceMeters)} · pribl.{" "}
            {formatMinutes(Math.round(routeState.route.durationSeconds / 60))} hoje
          </p>
          {routeState.route.steps.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                aria-expanded={showSteps}
                className="mt-1.5 flex items-center gap-1 text-xs font-medium text-offwhite-200 hover:text-offwhite-50"
              >
                {showSteps ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                {showSteps ? "Skrij navodila po korakih" : "Pokaži navodila po korakih"}
              </button>
              {showSteps && (
                <ol className="mt-1.5 list-inside list-decimal space-y-1 text-xs text-offwhite-200">
                  {routeState.route.steps.map((s, i) => (
                    <li key={i}>
                      {s.instruction} <span className="text-offwhite-200/60">({formatDistance(s.distanceMeters)})</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
        active
          ? "border-accent-red bg-accent-red text-offwhite-50"
          : "border-charcoal-600 text-offwhite-100 hover:bg-charcoal-800"
      }`}
    >
      {children}
    </button>
  );
}

function PanelBody({
  points,
  poti,
  filters,
  setFilters,
  selectedTockaId,
  selectedPotSlug,
  onSelectTocka,
  onSelectPot,
  routeState,
  onClearRoute,
}: Omit<SidePanelProps, "expanded" | "sheetState" | "onSheetStateChange">) {
  const visiblePoints = useMemo(() => filterTocke(points, filters), [points, filters]);
  const byEtapa = useMemo(() => {
    const map = new Map<number, Tocka[]>();
    for (const t of visiblePoints) map.set(t.etapa, [...(map.get(t.etapa) ?? []), t]);
    return map;
  }, [visiblePoints]);

  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  useEffect(() => {
    if (!selectedTockaId) return;
    rowRefs.current.get(selectedTockaId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedTockaId]);

  // PanelBody renders twice (desktop dock + mobile sheet, toggled by CSS —
  // see SidePanel below), so any id here must be unique per instance or
  // the two would collide as duplicate DOM ids.
  const searchId = useId();

  return (
    <div className="flex h-full flex-col text-sm">
      {/* Search + font-size toggle */}
      <div className="flex shrink-0 items-center gap-2 border-b border-charcoal-700 p-3">
        <label htmlFor={searchId} className="sr-only">
          Išči po nazivu ali območju
        </label>
        <div className="relative flex-1">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 opacity-60" />
          <input
            id={searchId}
            type="search"
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Išči po nazivu ali območju …"
            className="w-full rounded border border-charcoal-600 bg-charcoal-800 py-1.5 pr-2 pl-7 text-sm placeholder:text-offwhite-200/50"
          />
        </div>
        <VecjaPisavaToggle />
      </div>

      <NavigacijaSection routeState={routeState} onClearRoute={onClearRoute} />

      {/* Filters */}
      <div className="shrink-0 space-y-2 border-b border-charcoal-700 p-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-offwhite-200">Etapa</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(ETAPA_ODSEKI).map((e) => {
              const etapa = Number(e);
              return (
                <Chip
                  key={etapa}
                  active={filters.etape.includes(etapa)}
                  onClick={() => setFilters((prev) => ({ etape: toggleInArray(prev.etape, etapa) }))}
                >
                  <span
                    aria-hidden="true"
                    className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: getEtapaBarva(etapa) }}
                  />
                  {etapa}
                </Chip>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-offwhite-200">Vrsta obeležja</p>
          <div className="flex flex-wrap gap-1.5">
            {VSE_VRSTE.map((vrsta) => (
              <Chip
                key={vrsta}
                active={filters.vrste.includes(vrsta)}
                onClick={() => setFilters((prev) => ({ vrste: toggleInArray(prev.vrste, vrsta) }))}
              >
                {VRSTA_LABELS[vrsta]}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-offwhite-200">Tema</p>
          <div className="flex flex-wrap gap-1.5">
            {VSE_ZGODBE.map((zgodba) => (
              <Chip
                key={zgodba}
                active={filters.zgodbe.includes(zgodba)}
                onClick={() => setFilters((prev) => ({ zgodbe: toggleInArray(prev.zgodbe, zgodba) }))}
              >
                {ZGODBA_LABELS[zgodba]}
              </Chip>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs">
          <input
            type="checkbox"
            checked={filters.samoOsnovna}
            onChange={(e) => setFilters({ samoOsnovna: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          Samo osnovna trasa (13)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={filters.zica}
            onChange={(e) => setFilters({ zica: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          Prikaži obrambni obroč 1942–43 (žica)
        </label>
      </div>

      {/* Scrollable lists */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-charcoal-700 p-3">
          <h2 className="mb-2 font-heading text-xs font-semibold tracking-wide text-offwhite-200 uppercase">Poti</h2>
          <ul className="space-y-0.5">
            {poti.map((pot) => (
              <li key={pot.slug}>
                <button
                  type="button"
                  onClick={() => onSelectPot(selectedPotSlug === pot.slug ? null : pot.slug)}
                  aria-pressed={selectedPotSlug === pot.slug}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${
                    selectedPotSlug === pot.slug ? "bg-charcoal-700" : "hover:bg-charcoal-800"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: pot.barva }}
                  />
                  <span className="flex-1 truncate">{pot.naziv}</span>
                  <span className="shrink-0 text-xs text-offwhite-200/70">{pot.tocke_ids.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-3">
          <h2 className="mb-2 font-heading text-xs font-semibold tracking-wide text-offwhite-200 uppercase">
            Obeležja ({visiblePoints.length})
          </h2>
          {[...byEtapa.entries()]
            .sort(([a], [b]) => a - b)
            .map(([etapa, tocke]) => (
              <div key={etapa} className="mb-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-offwhite-200">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: getEtapaBarva(etapa) }}
                  />
                  Etapa {etapa}
                </p>
                <ul className="space-y-0.5">
                  {tocke.map((t) => {
                    const Icon = VRSTA_ICONS[t.vrsta];
                    const selected = selectedTockaId === t.id;
                    return (
                      <li
                        key={t.id}
                        ref={(el) => {
                          if (el) rowRefs.current.set(t.id, el);
                          else rowRefs.current.delete(t.id);
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectTocka(selected ? null : t.id)}
                          aria-pressed={selected}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left ${
                            selected ? "bg-charcoal-700" : "hover:bg-charcoal-800"
                          }`}
                        >
                          <Icon size={14} aria-hidden="true" className="shrink-0 opacity-80" />
                          <span className="shrink-0 text-xs text-offwhite-200/70">{t.id}</span>
                          <span className="flex-1 truncate">{t.naziv}</span>
                          <span className="shrink-0 truncate text-xs text-offwhite-200/70">{t.obmocje}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          {visiblePoints.length === 0 && (
            <p className="text-offwhite-200/70">Ni zadetkov — poskusi spremeniti filtre ali iskalni niz.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Both layout variants render unconditionally, toggled purely by CSS
 * breakpoints (`hidden md:flex` / `flex md:hidden`) rather than a JS
 * matchMedia check driving what mounts. A JS-driven split would render the
 * mobile sheet on the server (no `window` to check) and then swap to the
 * desktop dock right after hydration on every desktop load — a visible
 * flash, a lost `PanelBody` instance, and a hydration mismatch.
 */
export default function SidePanel(props: SidePanelProps) {
  return (
    <>
      <aside
        className={`map-chrome hidden h-full shrink-0 overflow-hidden border-r border-charcoal-700 transition-[width] duration-200 md:block ${
          props.expanded ? "w-[360px]" : "w-0"
        }`}
      >
        <div className="h-full w-[360px]">
          <PanelBody {...props} />
        </div>
      </aside>

      <aside
        className="map-chrome fixed inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-xl border-t border-charcoal-700 shadow-2xl transition-[height] duration-200 md:hidden"
        style={{ height: SHEET_HEIGHT[props.sheetState] }}
      >
        <button
          type="button"
          onClick={() => props.onSheetStateChange(nextSheetState(props.sheetState))}
          aria-label="Spremeni višino seznama"
          className="flex shrink-0 items-center justify-center py-1.5"
        >
          <GripHorizontal size={20} aria-hidden="true" />
        </button>
        <div className="min-h-0 flex-1">
          <PanelBody {...props} />
        </div>
      </aside>
    </>
  );
}
