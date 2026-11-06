import type { ReactNode } from "react";
import { Info } from "lucide-react";

/** Notice bar: tinted panel with a left accent rule — informative, not a warning banner. */
export default function Obvestilo({ children, role }: { children: ReactNode; role?: "status" }) {
  return (
    <div role={role} className="flex gap-3 rounded-r-lg border-l-4 border-poudarek bg-povrsina px-4 py-3 text-sm leading-relaxed shadow-xs">
      <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-poudarek" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}
