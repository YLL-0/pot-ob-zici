"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { VRSTA_ICONS, VRSTA_LABELS, VSE_VRSTE } from "@/lib/vrsta";

/** Collapsible key to the map's lines and type icons, below the map. Stage colours are on the chips. */
export default function Legend() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1 font-medium text-poudarek"
      >
        <ChevronDown size={16} aria-hidden="true" className={open ? "rotate-180" : ""} />
        Legenda zemljevida
      </button>
      {open && (
        <div id={id} className="mt-3 grid gap-4 rounded-xl border border-crta bg-povrsina p-4 sm:grid-cols-2">
          <ul className="space-y-2">
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="inline-block w-8 shrink-0 border-t-4 border-solid border-crnilo-mehko" />
              Trasa etape, izračunana po poteh (v barvi etape)
            </li>
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="inline-block w-8 shrink-0 border-t-4 border-dashed border-crnilo-mehko" />
              Trasa etape, shematska povezava
            </li>
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="inline-block w-8 shrink-0 border-t-4 border-dotted border-crnilo" />
              Pelji me tja — vaša pot do obeležja
            </li>
          </ul>
          <ul className="space-y-2">
            {VSE_VRSTE.map((vrsta) => {
              const Icon = VRSTA_ICONS[vrsta];
              return (
                <li key={vrsta} className="flex items-center gap-3">
                  <Icon size={16} aria-hidden="true" />
                  {VRSTA_LABELS[vrsta]}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
