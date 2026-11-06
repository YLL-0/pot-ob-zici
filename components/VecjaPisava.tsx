"use client";

import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { getVecjaPisava, setVecjaPisava } from "@/lib/progress";

/** "Večja pisava" toggle — accessibility hard requirement, on every page (in SiteHeader). */
export default function VecjaPisava() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(getVecjaPisava()), []);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setOn(next);
        setVecjaPisava(next);
        document.documentElement.toggleAttribute("data-vecja-pisava", next);
      }}
      aria-pressed={on}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-crta-mocna px-3 text-sm font-medium hover:bg-tonirano aria-pressed:border-poudarek aria-pressed:bg-poudarek aria-pressed:text-white"
    >
      <Type size={16} aria-hidden="true" />
      Večja pisava
    </button>
  );
}
