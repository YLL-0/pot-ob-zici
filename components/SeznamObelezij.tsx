"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BARVA_BREZ_ETAPE, stevnikObelezij } from "@/lib/etape";
import type { Etapa, Tocka } from "@/lib/types";

interface SeznamProps {
  etape: Etapa[];
  /** Already filtered, in stage and walking order (lib/data.ts). */
  tocke: Tocka[];
  selectedTockaId: string | null;
  onSelectTocka: (id: string | null) => void;
}

/** Coordinates as in the reference list: 4 decimals (~10 m), lat then lon. */
function koordinate(t: Tocka): string {
  return `${t.lat.toFixed(4)}, ${t.lon.toFixed(4)}`;
}

/**
 * All visible points grouped by stage, as a compact grid of cards: 1 / 2 / 3 / 4
 * columns (POPRAVKI_4 §1). Sections of unselected stages are absent because
 * `tocke` is already stage-filtered. A card finds the point on the map (pan,
 * popup, scroll up); the point's page is linked from the popup.
 */
export default function SeznamObelezij({ etape, tocke, selectedTockaId, onSelectTocka }: SeznamProps) {
  const skupine = useMemo(() => {
    const g: { etapa: Etapa | undefined; tocke: Tocka[] }[] = etape.map((etapa) => ({ etapa, tocke: [] }));
    const brez: Tocka[] = [];
    for (const t of tocke) {
      const s = g.find((x) => x.etapa!.id === t.etapa);
      if (s) s.tocke.push(t);
      else brez.push(t);
    }
    g.push({ etapa: undefined, tocke: brez });
    return g.filter((x) => x.tocke.length > 0);
  }, [etape, tocke]);

  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  useEffect(() => {
    if (!selectedTockaId) return;
    rowRefs.current.get(selectedTockaId)?.scrollIntoView({ block: "nearest" });
  }, [selectedTockaId]);

  if (tocke.length === 0) {
    return <p className="text-crnilo-mehko">Ni zadetkov — poskusi spremeniti filtre ali iskalni niz.</p>;
  }

  return (
    <div className="space-y-10">
      {skupine.map(({ etapa, tocke: t }) => {
        const headingId = `skupina-${etapa?.id ?? "brez-etape"}`;
        const barva = etapa?.barva ?? BARVA_BREZ_ETAPE;
        return (
          <section key={headingId} aria-labelledby={headingId}>
            {/* The stage colour as a rule under the heading. */}
            <div
              className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 pb-2"
              style={{ borderColor: barva }}
            >
              <h3 id={headingId} className="flex flex-wrap items-baseline gap-x-2 font-heading text-xl font-semibold">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 self-center rounded-full"
                  style={{ backgroundColor: barva }}
                />
                {etapa?.naziv ?? "Brez etape"}
                {etapa?.odsek && <span className="font-body text-base font-normal text-crnilo-mehko">{etapa.odsek}</span>}
                <span className="font-body text-sm font-normal text-crnilo-mehko">({stevnikObelezij(t.length)})</span>
              </h3>
              {etapa && (
                <Link
                  href={`/pot/${etapa.id}`}
                  className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-poudarek underline-offset-4 hover:underline"
                >
                  Stran etape
                  <ArrowRight size={16} aria-hidden="true" />
                  <span className="sr-only">: {etapa.naziv}</span>
                </Link>
              )}
            </div>
            {/* Fixed columns (repeat(N, minmax(0, 1fr))): an incomplete last row
                keeps the same card width instead of stretching (POPRAVKI_4 §1). */}
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 siroko:grid-cols-4">
              {t.map((tocka) => {
                const izbrana = selectedTockaId === tocka.id;
                return (
                  <li
                    key={tocka.id}
                    className="flex"
                    ref={(el) => {
                      if (el) rowRefs.current.set(tocka.id, el);
                      else rowRefs.current.delete(tocka.id);
                    }}
                  >
                    {/* The whole card is one button: Enter/Space, focus ring, no nested link. */}
                    <button
                      type="button"
                      onClick={() => onSelectTocka(tocka.id)}
                      aria-current={izbrana || undefined}
                      className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors ${
                        izbrana
                          ? "border-crnilo bg-tonirano ring-2 ring-crnilo"
                          : "border-crta bg-povrsina hover:border-crta-mocna hover:bg-papir"
                      }`}
                    >
                      <span className="block font-mono text-xs text-crnilo-mehko">{tocka.id}</span>
                      <span className="mt-0.5 block text-sm leading-snug font-semibold">{tocka.naziv}</span>
                      {tocka.obmocje && <span className="mt-0.5 block text-xs text-crnilo-mehko">{tocka.obmocje}</span>}
                      <span className="mt-1 block font-mono text-xs text-crnilo-mehko">
                        <span className="sr-only">Približne koordinate: </span>
                        {koordinate(tocka)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
