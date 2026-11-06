"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { formatDistance, formatMinutes } from "@/lib/geo";
import type { RouteState } from "@/lib/routing";

/** "Pelji me tja" result under the map: distance, time, turn-by-turn steps. */
export default function Navigacija({ routeState, onClearRoute }: { routeState: RouteState; onClearRoute: () => void }) {
  const [koraki, setKoraki] = useState(false);
  if (routeState.status === "idle") return null;

  return (
    <section aria-live="polite" className="rounded-xl border border-crta bg-povrsina p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">Pot do: {routeState.tocka.naziv}</h2>
        <button
          type="button"
          onClick={onClearRoute}
          aria-label="Prekliči navigacijo"
          className="-m-1 shrink-0 rounded-full p-1.5 hover:bg-tonirano"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {routeState.status === "loading" && <p className="mt-2 text-sm text-crnilo-mehko">Iščem pot …</p>}
      {routeState.status === "error" && (
        <p className="mt-2 text-sm">{routeState.error} Uporabi zunanjo aplikacijo v pojavnem oknu obeležja.</p>
      )}
      {routeState.status === "ready" && (
        <div className="mt-2 text-sm">
          <p>
            {formatDistance(routeState.route.distanceMeters)} · pribl.{" "}
            {formatMinutes(Math.round(routeState.route.durationSeconds / 60))} hoje
          </p>
          {routeState.route.steps.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setKoraki((v) => !v)}
                aria-expanded={koraki}
                className="mt-2 inline-flex items-center gap-1 font-medium text-poudarek"
              >
                <ChevronDown size={16} aria-hidden="true" className={koraki ? "rotate-180" : ""} />
                {koraki ? "Skrij navodila po korakih" : "Pokaži navodila po korakih"}
              </button>
              {koraki && (
                <ol className="mt-2 list-inside list-decimal space-y-1 text-crnilo-mehko">
                  {routeState.route.steps.map((s, i) => (
                    <li key={i}>
                      {s.instruction} ({formatDistance(s.distanceMeters)})
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
