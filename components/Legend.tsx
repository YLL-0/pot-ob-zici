"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Etapa } from "@/lib/types";
import { VRSTA_ICONS, VRSTA_LABELS, VSE_VRSTE } from "@/lib/vrsta";

/** Small collapsible map legend: etapa colours + object-type icons. */
export default function Legend({ etape }: { etape: Etapa[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="map-chrome absolute top-3 right-3 z-10 max-w-[min(90vw,20rem)] rounded-lg text-sm shadow-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="legenda-vsebina"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 font-heading font-semibold"
      >
        Legenda
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
      {open && (
        <div id="legenda-vsebina" className="max-h-[60vh] overflow-y-auto border-t border-charcoal-700 px-3 py-2">
          <p className="mb-1 text-xs font-semibold text-offwhite-200">Etapa (barva)</p>
          <ul className="mb-3 space-y-1">
            {etape.map((etapa) => (
              <li key={etapa.id} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: etapa.barva }}
                />
                <span>
                  {etapa.naziv}
                  {etapa.odsek ? ` — ${etapa.odsek}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mb-1 text-xs font-semibold text-offwhite-200">Vrsta obeležja (ikona)</p>
          <ul className="space-y-1">
            {VSE_VRSTE.map((vrsta) => {
              const Icon = VRSTA_ICONS[vrsta];
              return (
                <li key={vrsta} className="flex items-center gap-2">
                  <Icon size={14} aria-hidden="true" />
                  <span>{VRSTA_LABELS[vrsta]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
