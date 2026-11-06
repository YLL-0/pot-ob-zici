import type { ReactNode } from "react";
import { besediloNaBarvi } from "@/lib/etape";

interface CipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Stage colour: shown as the dot, and as the fill when active. Without it the active fill is the accent. */
  barva?: string;
  /** Emphasised without being a filter (the selected point lies on this stage). */
  poudarjen?: boolean;
  /** Small trailing count, e.g. points per theme. */
  stevilo?: number;
}

/** Pill-shaped filter chip with an optional coloured dot; the active one is filled. */
export default function Cip({ active, onClick, children, barva, poudarjen = false, stevilo }: CipProps) {
  const svetlo = barva ? besediloNaBarvi(barva) === "svetlo" : true;
  const aktivniRazredi = barva
    ? svetlo
      ? "border-transparent text-white"
      : "border-transparent text-crnilo"
    : "border-poudarek bg-poudarek text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={active && barva ? { backgroundColor: barva } : undefined}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
        active ? aktivniRazredi : "border-crta bg-povrsina text-crnilo hover:border-crta-mocna"
      } ${poudarjen ? "ring-2 ring-crnilo ring-offset-2 ring-offset-papir" : ""}`}
    >
      {barva && (
        <span
          aria-hidden="true"
          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${active ? "ring-2 ring-white/80" : ""}`}
          style={{ backgroundColor: barva }}
        />
      )}
      {children}
      {stevilo !== undefined && (
        <span className={`text-xs tabular-nums ${active ? "" : "text-crnilo-mehko"}`}>{stevilo}</span>
      )}
    </button>
  );
}
