import type { Zgodba } from "@/lib/types";

/** Slovenian display label per story theme, for filter chips. */
export const ZGODBA_LABELS: Record<Zgodba, string> = {
  odpor: "Odpor",
  zrtve: "Žrtve",
  "kultura-spominjanja": "Kultura spominjanja",
  "otroci-in-mladi": "Otroci in mladi",
  "partizanske-enote": "Partizanske enote",
  talci: "Talci",
  zeleznicarji: "Železničarji",
  "mesto-v-zici": "Mesto v žici",
  bombardiranje: "Bombardiranje",
  "zenske-v-odporu": "Ženske v odporu",
};

export const VSE_ZGODBE: Zgodba[] = [
  "odpor",
  "zrtve",
  "kultura-spominjanja",
  "otroci-in-mladi",
  "partizanske-enote",
  "talci",
  "zeleznicarji",
  "mesto-v-zici",
  "bombardiranje",
  "zenske-v-odporu",
];
