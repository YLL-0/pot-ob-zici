"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Cip from "@/components/Cip";
import { besediloNaBarvi, stevnikObelezij } from "@/lib/etape";
import type { Etapa } from "@/lib/types";

interface EtapeProps {
  etape: Etapa[];
  /** Selected stages by display number (URL `?etapa=`); empty = all. */
  izbrane: number[];
  /** The selected point's stage — its chip and row get an outline. */
  poudarjenaEtapaId: string | null;
  onPreklopi: (stevilka: number) => void;
  onVse: () => void;
}

/**
 * The always-visible stage control: "Vse etape" + one chip per stage, in
 * the stage's own colour (`etape.barva` — the only colour source).
 */
export function EtapeCipi({ etape, izbrane, poudarjenaEtapaId, onPreklopi, onVse }: EtapeProps) {
  return (
    <div role="group" aria-label="Izbira etap" className="flex flex-wrap gap-2">
      <Cip active={izbrane.length === 0} onClick={onVse}>
        Vse etape
      </Cip>
      {etape.map((etapa) => (
        <Cip
          key={etapa.id}
          barva={etapa.barva}
          active={izbrane.includes(etapa.stevilka)}
          poudarjen={poudarjenaEtapaId === etapa.id}
          onClick={() => onPreklopi(etapa.stevilka)}
        >
          {etapa.naziv}
          {poudarjenaEtapaId === etapa.id && <span className="sr-only"> (izbrano obeležje je na tej etapi)</span>}
        </Cip>
      ))}
    </div>
  );
}

/**
 * The stage list proper: number, name, section and point count per stage,
 * in its colour. A row toggles the stage on the map, like its chip; the
 * arrow opens the stage's own page.
 */
export function EtapeSeznam({
  etape,
  izbrane,
  poudarjenaEtapaId,
  onPreklopi,
  stevilo,
}: Omit<EtapeProps, "onVse"> & { stevilo: (etapaId: string) => number }) {
  return (
    <ol className="divide-y divide-crta overflow-hidden rounded-xl border border-crta bg-povrsina">
      {etape.map((etapa) => {
        const aktivna = izbrane.includes(etapa.stevilka);
        const svetlo = besediloNaBarvi(etapa.barva) === "svetlo";
        return (
          <li key={etapa.id} className="flex items-stretch">
            <button
              type="button"
              onClick={() => onPreklopi(etapa.stevilka)}
              aria-pressed={aktivna}
              className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors ${
                aktivna ? "bg-tonirano" : "hover:bg-papir"
              }`}
            >
              {/* Colour bar on the left edge: the row's stage colour. */}
              <span aria-hidden="true" className="-my-3 -ml-4 w-1.5 self-stretch" style={{ backgroundColor: etapa.barva }} />
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                  svetlo ? "text-white" : "text-crnilo"
                } ${poudarjenaEtapaId === etapa.id ? "ring-2 ring-crnilo ring-offset-2" : ""}`}
                style={{ backgroundColor: etapa.barva }}
              >
                {etapa.stevilka}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-base leading-tight font-semibold">{etapa.naziv}</span>
                {etapa.odsek && <span className="block truncate text-sm text-crnilo-mehko">{etapa.odsek}</span>}
              </span>
              <span className="shrink-0 text-sm text-crnilo-mehko tabular-nums">{stevnikObelezij(stevilo(etapa.id))}</span>
              <span className="sr-only">{aktivna ? " — prikazana na zemljevidu" : ""}</span>
            </button>
            <Link
              href={`/pot/${etapa.id}`}
              aria-label={`Stran etape: ${etapa.naziv}${etapa.odsek ? `, ${etapa.odsek}` : ""}`}
              className="flex w-12 shrink-0 items-center justify-center border-l border-crta text-crnilo-mehko hover:bg-papir hover:text-crnilo"
            >
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
