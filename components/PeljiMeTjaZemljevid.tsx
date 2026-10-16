"use client";

/**
 * Detail-page counterpart to the map popup's "Pelji me tja": same
 * lib/routing.ts flow, its own compact result UI (no side panel to render
 * into here), and the same context MiniMap now also drawing the route.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Tocka } from "@/lib/types";
import type { RouteState } from "@/lib/routing";
import { messageForError, planWalkingRoute } from "@/lib/routing";
import { getAppleMapsUrl, getGoogleMapsUrl } from "@/lib/zemljevidi";
import { formatDistance, formatMinutes } from "@/lib/geo";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => (
    <div className="map-chrome flex h-full w-full items-center justify-center text-xs">Nalagam zemljevid …</div>
  ),
});

export default function PeljiMeTjaZemljevid({ tocka, barva }: { tocka: Tocka; barva: string }) {
  const [state, setState] = useState<RouteState>({ status: "idle" });
  const [showSteps, setShowSteps] = useState(false);

  async function handleClick() {
    setState({ status: "loading", tocka });
    try {
      const route = await planWalkingRoute({ lat: tocka.lat, lon: tocka.lon });
      setState({ status: "ready", tocka, route });
    } catch (err) {
      setState({ status: "error", tocka, error: messageForError(err) });
    }
  }

  return (
    <section className="mt-6">
      <p className="mb-2 text-sm font-medium text-charcoal-700">Lokacija in navigacija</p>
      <p className="mb-2 text-xs text-charcoal-600">Lokacija je približna — terenska uskladitev v teku.</p>

      <div className="h-64 overflow-hidden rounded-lg border border-charcoal-200">
        <MiniMap variant="tocka" tocka={tocka} barva={barva} route={state.status === "ready" ? state.route.geometry : null} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={state.status === "loading"}
          className="rounded bg-accent-red px-4 py-2 text-sm font-semibold text-offwhite-50 hover:bg-accent-red-dark disabled:opacity-60"
        >
          {state.status === "loading" ? "Iščem pot …" : "Pelji me tja"}
        </button>
        <a
          href={getGoogleMapsUrl(tocka.lat, tocka.lon)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-charcoal-300 px-4 py-2 text-sm font-medium hover:bg-offwhite-100"
        >
          Google Zemljevidi ↗
        </a>
        <a
          href={getAppleMapsUrl(tocka.lat, tocka.lon)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-charcoal-300 px-4 py-2 text-sm font-medium hover:bg-offwhite-100"
        >
          Apple Zemljevidi ↗
        </a>
      </div>

      {state.status === "error" && (
        <p className="mt-2 text-sm text-accent-red-dark">{state.error} Uporabi zunanjo aplikacijo zgoraj.</p>
      )}

      {state.status === "ready" && (
        <div className="mt-3 rounded border border-charcoal-200 bg-offwhite-100 p-3">
          <p className="text-sm font-medium">
            {formatDistance(state.route.distanceMeters)} · pribl. {formatMinutes(Math.round(state.route.durationSeconds / 60))}{" "}
            hoje
          </p>
          {state.route.steps.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                aria-expanded={showSteps}
                className="mt-1.5 flex items-center gap-1 text-xs font-medium text-charcoal-700 hover:text-accent-red"
              >
                {showSteps ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                {showSteps ? "Skrij navodila po korakih" : "Pokaži navodila po korakih"}
              </button>
              {showSteps && (
                <ol className="mt-1.5 list-inside list-decimal space-y-1 text-xs text-charcoal-700">
                  {state.route.steps.map((s, i) => (
                    <li key={i}>
                      {s.instruction} <span className="text-charcoal-500">({formatDistance(s.distanceMeters)})</span>
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
