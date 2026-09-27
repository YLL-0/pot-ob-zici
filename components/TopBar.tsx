"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface TopBarProps {
  panelExpanded: boolean;
  onTogglePanel: () => void;
}

/** Thin top bar: project name, link to /o-projektu, panel toggle. Nothing else. */
export default function TopBar({ panelExpanded, onTogglePanel }: TopBarProps) {
  return (
    <header className="map-chrome flex h-12 shrink-0 items-center justify-between border-b border-charcoal-700 px-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePanel}
          aria-label={panelExpanded ? "Skrči seznam" : "Razširi seznam"}
          aria-pressed={panelExpanded}
          className="rounded p-1.5 hover:bg-charcoal-800"
        >
          {panelExpanded ? (
            <PanelLeftClose size={20} aria-hidden="true" />
          ) : (
            <PanelLeftOpen size={20} aria-hidden="true" />
          )}
        </button>
        <span className="font-heading text-sm font-bold tracking-wide">Pot ob žici</span>
      </div>
      <Link href="/o-projektu" className="text-sm underline decoration-charcoal-600 underline-offset-4 hover:text-offwhite-200">
        O projektu
      </Link>
    </header>
  );
}
