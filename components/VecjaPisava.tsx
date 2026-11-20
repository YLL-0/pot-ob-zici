"use client";

import { useSyncExternalStore } from "react";
import { Type } from "lucide-react";
import { setVecjaPisava } from "@/lib/progress";

const ATRIBUT = "data-vecja-pisava";

/**
 * The <html> attribute is the live state: the init script in app/(frontend)/layout.tsx
 * sets it from the saved preference before paint, and the toggle below
 * flips it. Reading it (instead of copying it into React state) keeps the
 * button and the page in step without a setState-in-effect.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATRIBUT] });
  return () => observer.disconnect();
}

/** "Večja pisava" toggle — accessibility hard requirement, on every page (in SiteHeader). */
export default function VecjaPisava() {
  const on = useSyncExternalStore(
    subscribe,
    () => document.documentElement.hasAttribute(ATRIBUT),
    () => false,
  );
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setVecjaPisava(next);
        document.documentElement.toggleAttribute(ATRIBUT, next);
      }}
      aria-pressed={on}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-crta-mocna px-3 text-sm font-medium hover:bg-tonirano aria-pressed:border-poudarek aria-pressed:bg-poudarek aria-pressed:text-white"
    >
      <Type size={16} aria-hidden="true" />
      Večja pisava
    </button>
  );
}
