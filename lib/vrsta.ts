import {
  BuildingComplex,
  Cross,
  Landmark,
  Library,
  MapPin,
  ScrollText,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { Vrsta } from "@/lib/types";

/** Slovenian display label per object type, for filter chips and legend. */
export const VRSTA_LABELS: Record<Vrsta, string> = {
  plosca: "Spominska plošča",
  spomenik: "Spomenik",
  grobnica: "Grobnica",
  bunker: "Bunker",
  kompleks: "Spominski kompleks",
  muzej: "Muzej",
  "kraj-dogodka": "Kraj dogodka",
};

/** Icon per object type — shared by the map's marker glyphs and the legend/chips. */
export const VRSTA_ICONS: Record<Vrsta, LucideIcon> = {
  plosca: ScrollText,
  spomenik: Landmark,
  grobnica: Cross,
  bunker: Shield,
  kompleks: BuildingComplex,
  muzej: Library,
  "kraj-dogodka": MapPin,
};

export const VSE_VRSTE: Vrsta[] = ["plosca", "spomenik", "grobnica", "bunker", "kompleks", "muzej", "kraj-dogodka"];
