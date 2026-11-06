import type { Zgodba } from "@/lib/types";

/**
 * The client's ten story themes, in the client's order. Fixed list: do not
 * extend, rename or substitute (POPRAVKI_1 §1). The importer's
 * TEMA_TO_ZGODBE table (scripts/import-xlsx.ts) may only map to these.
 */
export const ZGODBA_LABELS: Record<Zgodba, string> = {
  "mesto-v-zici": "Mesto v žici",
  odpor: "Odpor",
  zrtve: "Žrtve",
  talci: "Talci",
  zeleznicarji: "Železničarji",
  "partizanske-enote": "Partizanske enote",
  "otroci-in-mladi": "Otroci in mladi",
  "zenske-v-odporu": "Ženske v odporu",
  bombardiranje: "Bombardiranje",
  osvoboditev: "Osvoboditev",
};

export const VSE_ZGODBE = Object.keys(ZGODBA_LABELS) as Zgodba[];

export function isZgodba(value: string): value is Zgodba {
  return Object.prototype.hasOwnProperty.call(ZGODBA_LABELS, value);
}
