import { VRSTA_ICONS, VRSTA_LABELS } from "@/lib/vrsta";
import type { Tocka } from "@/lib/types";

/**
 * Deliberate placeholder for a missing photo — a typographic plate with
 * the point's ID and type, not a broken-image icon. Design requirement:
 * "Where photos don't exist yet, the placeholder must look deliberate."
 */
export default function FotoPlaceholder({ tocka, label }: { tocka: Tocka; label?: string }) {
  const Icon = VRSTA_ICONS[tocka.vrsta];
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-charcoal-900 text-offwhite-100">
      <Icon size={28} aria-hidden="true" className="opacity-70" />
      <p className="font-heading text-xs font-semibold tracking-widest uppercase opacity-80">{tocka.id}</p>
      <p className="text-[11px] opacity-60">{label ?? VRSTA_LABELS[tocka.vrsta]}</p>
    </div>
  );
}
