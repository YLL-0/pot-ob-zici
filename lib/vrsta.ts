import {
  Cross,
  Landmark,
  MapPin,
  ScrollText,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { Vrsta } from "@/lib/types";

/**
 * The client's five object types, in the client's order. Fixed list: do not
 * extend, rename or substitute (POPRAVKI_1 §1). The importer's
 * VRSTA_RAW_TO_VRSTA table (scripts/import-xlsx.ts) may only map to these.
 */
export const VRSTA_LABELS: Record<Vrsta, string> = {
  spomenik: "Spomenik",
  plosca: "Spominska plošča",
  grobnica: "Grobnica",
  bunker: "Bunker",
  "kraj-dogodka": "Kraj dogodka",
};

/** Icon per object type — shared by the map's marker glyphs and the legend/chips. */
export const VRSTA_ICONS: Record<Vrsta, LucideIcon> = {
  plosca: ScrollText,
  spomenik: Landmark,
  grobnica: Cross,
  bunker: Shield,
  "kraj-dogodka": MapPin,
};

export const VSE_VRSTE = Object.keys(VRSTA_LABELS) as Vrsta[];

export function isVrsta(value: string): value is Vrsta {
  return Object.prototype.hasOwnProperty.call(VRSTA_LABELS, value);
}
