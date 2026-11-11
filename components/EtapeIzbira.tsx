"use client";

import Cip from "@/components/Cip";
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
 * Phones: one horizontally scrollable row (bleeding to the screen edge) so
 * the chips never push the map down; from `sm` up they wrap. The vertical
 * padding keeps focus rings and the emphasis ring inside the scroll box.
 */
export function EtapeCipi({ etape, izbrane, poudarjenaEtapaId, onPreklopi, onVse }: EtapeProps) {
  return (
    <div
      role="group"
      aria-label="Izbira etap"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
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
