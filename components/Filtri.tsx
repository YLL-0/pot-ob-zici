"use client";

import { useId, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import Cip from "@/components/Cip";
import { toggleInArray, type FilterState } from "@/lib/filters";
import { VRSTA_LABELS, VSE_VRSTE } from "@/lib/vrsta";
import { VSE_ZGODBE, ZGODBA_LABELS } from "@/lib/zgodbe";
import type { Tocka } from "@/lib/types";

interface FiltriProps {
  points: Tocka[];
  filters: FilterState;
  setFilters: (update: Partial<FilterState> | ((prev: FilterState) => Partial<FilterState>)) => void;
  /** "Prikazano X od Y" — sits beside the search, not on a line of its own (POPRAVKI_3 §2). */
  stevec?: string;
}

/**
 * Search, plus the secondary filters (type, theme, core trail, 1942–43
 * ring) behind one disclosure. Filter values live in the URL; only whether
 * the disclosure is open is local UI state. Theme chips show their point
 * count, so an empty client theme reads as an honest 0.
 */
export default function Filtri({ points, filters, setFilters, stevec }: FiltriProps) {
  const steviloAktivnih =
    filters.vrste.length + filters.zgodbe.length + (filters.samoOsnovna ? 1 : 0) + (filters.zica ? 1 : 0);
  const [odprto, setOdprto] = useState(steviloAktivnih > 0);
  const searchId = useId();
  const panelId = useId();

  const poVrsti = (v: string) => points.filter((t) => t.vrsta === v).length;
  const poZgodbi = (z: string) => points.filter((t) => (t.zgodbe_predlog as string[]).includes(z)).length;
  const osnovnih = points.filter((t) => t.vkljucitev.startsWith("Osnovna")).length;

  return (
    <div className="space-y-3">
      {/* One row at every width: search + disclosure button, so the map stays high on the page. */}
      <div className="flex gap-2">
        <label htmlFor={searchId} className="sr-only">
          Išči po nazivu ali kraju
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-crnilo-mehko"
          />
          <input
            id={searchId}
            type="search"
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Išči po nazivu ali kraju …"
            className="min-h-11 w-full rounded-lg border border-crta-mocna bg-povrsina py-2 pr-3 pl-10 text-base placeholder:text-crnilo-mehko"
          />
        </div>
        <button
          type="button"
          onClick={() => setOdprto((v) => !v)}
          aria-expanded={odprto}
          aria-controls={panelId}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-crta-mocna bg-povrsina px-3 text-sm font-medium hover:bg-tonirano sm:px-4"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtri
          {steviloAktivnih > 0 && (
            <span className="rounded-full bg-poudarek px-2 text-xs leading-5 text-white tabular-nums">
              {steviloAktivnih}
              <span className="sr-only"> aktivnih</span>
            </span>
          )}
          <ChevronDown size={16} aria-hidden="true" className={odprto ? "rotate-180" : ""} />
        </button>
      </div>
      {stevec && (
        <p className="-mt-1.5 text-xs text-crnilo-mehko" aria-live="polite">
          {stevec}
        </p>
      )}

      {odprto && (
        <div id={panelId} className="space-y-4 rounded-xl border border-crta bg-povrsina p-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Vrsta obeležja</legend>
            <div className="flex flex-wrap gap-2">
              {VSE_VRSTE.map((vrsta) => (
                <Cip
                  key={vrsta}
                  active={filters.vrste.includes(vrsta)}
                  stevilo={poVrsti(vrsta)}
                  onClick={() => setFilters((prev) => ({ vrste: toggleInArray(prev.vrste, vrsta) }))}
                >
                  {VRSTA_LABELS[vrsta]}
                </Cip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Tema</legend>
            <div className="flex flex-wrap gap-2">
              {VSE_ZGODBE.map((zgodba) => (
                <Cip
                  key={zgodba}
                  active={filters.zgodbe.includes(zgodba)}
                  stevilo={poZgodbi(zgodba)}
                  onClick={() => setFilters((prev) => ({ zgodbe: toggleInArray(prev.zgodbe, zgodba) }))}
                >
                  {ZGODBA_LABELS[zgodba]}
                </Cip>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2 text-sm">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={filters.samoOsnovna}
                onChange={(e) => setFilters({ samoOsnovna: e.target.checked })}
                className="h-5 w-5 accent-poudarek"
              />
              Samo osnovna trasa ({osnovnih})
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={filters.zica}
                onChange={(e) => setFilters({ zica: e.target.checked })}
                className="h-5 w-5 accent-poudarek"
              />
              Prikaži obrambni obroč 1942–43 (žica)
            </label>
          </div>
          {steviloAktivnih > 0 && (
            <button
              type="button"
              onClick={() => setFilters({ vrste: [], zgodbe: [], samoOsnovna: false, zica: false })}
              className="text-sm font-medium text-poudarek underline underline-offset-4"
            >
              Počisti filtre
            </button>
          )}
        </div>
      )}
    </div>
  );
}
