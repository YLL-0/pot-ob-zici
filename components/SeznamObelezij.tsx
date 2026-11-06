"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BARVA_BREZ_ETAPE, stevnikObelezij } from "@/lib/etape";
import { VRSTA_ICONS, VRSTA_LABELS } from "@/lib/vrsta";
import type { Etapa, Tocka } from "@/lib/types";

interface SeznamProps {
  etape: Etapa[];
  /** Already filtered, in stage and walking order (lib/data.ts). */
  tocke: Tocka[];
  selectedTockaId: string | null;
  onSelectTocka: (id: string | null) => void;
}

/** All visible points grouped by stage. A row finds the point on the map; the arrow opens its page. */
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
    <div className="space-y-8">
      {skupine.map(({ etapa, tocke: t }) => {
        const headingId = `skupina-${etapa?.id ?? "brez-etape"}`;
        return (
          <section key={headingId} aria-labelledby={headingId}>
            <h3 id={headingId} className="mb-3 flex flex-wrap items-baseline gap-x-2 font-heading text-lg font-semibold">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 self-center rounded-full"
                style={{ backgroundColor: etapa?.barva ?? BARVA_BREZ_ETAPE }}
              />
              {etapa?.naziv ?? "Brez etape"}
              {etapa?.odsek && <span className="font-body text-base font-normal text-crnilo-mehko">· {etapa.odsek}</span>}
              <span className="ml-auto font-body text-sm font-normal text-crnilo-mehko">{stevnikObelezij(t.length)}</span>
            </h3>
            <ul className="divide-y divide-crta overflow-hidden rounded-xl border border-crta bg-povrsina">
              {t.map((tocka) => {
                const Icon = VRSTA_ICONS[tocka.vrsta];
                const izbrana = selectedTockaId === tocka.id;
                return (
                  <li
                    key={tocka.id}
                    className="flex items-stretch"
                    ref={(el) => {
                      if (el) rowRefs.current.set(tocka.id, el);
                      else rowRefs.current.delete(tocka.id);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTocka(izbrana ? null : tocka.id)}
                      aria-pressed={izbrana}
                      className={`flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition-colors ${
                        izbrana ? "bg-tonirano" : "hover:bg-papir"
                      }`}
                    >
                      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-crnilo-mehko" />
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug font-medium">{tocka.naziv}</span>
                        <span className="block text-sm text-crnilo-mehko">
                          {tocka.obmocje} · {VRSTA_LABELS[tocka.vrsta]} · {tocka.id}
                        </span>
                      </span>
                    </button>
                    <Link
                      href={`/tocka/${tocka.slug}`}
                      aria-label={`Stran obeležja: ${tocka.naziv}`}
                      className="flex w-12 shrink-0 items-center justify-center border-l border-crta text-crnilo-mehko hover:bg-papir hover:text-crnilo"
                    >
                      <ArrowRight size={18} aria-hidden="true" />
                    </Link>
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
