/**
 * Select options for the Payload collections. Values are exactly the
 * union members in lib/types.ts, so a document maps 1:1 onto `Tocka`
 * without translation. Closed client lists (vrsta, zgodbe) reuse the
 * label tables the public site already uses — never extend them here.
 */

import type {
  DovoljenjeQr,
  EsdStatus,
  FotoTip,
  GpsZanesljivost,
  StatusIzvedbe,
  StrokovnaVerifikacija,
  Vkljucitev,
  VsebinskiStatus,
} from "@/lib/types";
import { VRSTA_LABELS } from "@/lib/vrsta";
import { ZGODBA_LABELS } from "@/lib/zgodbe";

interface Moznost<T extends string> {
  label: string;
  value: T;
}

function izTabele<T extends string>(tabela: Record<T, string>): Moznost<T>[] {
  return (Object.entries(tabela) as [T, string][]).map(([value, label]) => ({ label, value }));
}

export const VRSTA_MOZNOSTI = izTabele(VRSTA_LABELS);

export const ZGODBA_MOZNOSTI = izTabele(ZGODBA_LABELS);

export const GPS_ZANESLJIVOST_MOZNOSTI = izTabele<GpsZanesljivost>({
  priblizek: "Približek (iz Excela)",
  zunanji_vir: "Zunanji vir (register), ni terensko preverjeno",
  "terensko-izmerjeno": "Terensko izmerjeno",
  "preverjeno-v-gis": "Preverjeno v GIS",
});

export const VKLJUCITEV_MOZNOSTI = izTabele<Vkljucitev>({
  "Osnovna pot": "Osnovna pot",
  "Osnovna pot / bližina": "Osnovna pot / bližina",
  "Bližina poti": "Bližina poti",
  "Razširjeni zahodni krak": "Razširjeni zahodni krak",
  "Razširjeni vzhodni krak": "Razširjeni vzhodni krak",
  "Razširjeni severni krak": "Razširjeni severni krak",
  "Razširjeni severovzhodni krak": "Razširjeni severovzhodni krak",
});

export const ESD_STATUS_MOZNOSTI = izTabele<EsdStatus>({
  "za-preverjanje": "Za preverjanje",
  vpisano: "Vpisano v register",
  "ni-esd": "Ni v registru",
  "ni-relevantno": "Ni relevantno",
});

export const VSEBINSKI_STATUS_MOZNOSTI = izTabele<VsebinskiStatus>({
  "ni-zaceto": "Ni začeto",
  "v-pripravi": "V pripravi",
  "za-preverjanje": "Za preverjanje",
  koncano: "Končano",
  "ni-potrebno": "Ni potrebno",
});

export const DOVOLJENJE_QR_MOZNOSTI = izTabele<DovoljenjeQr>({
  "za-preverjanje": "Za preverjanje",
  pridobljeno: "Pridobljeno",
  zavrnjeno: "Zavrnjeno",
  "ni-potrebno": "Ni potrebno",
});

export const STROKOVNA_VERIFIKACIJA_MOZNOSTI = izTabele<StrokovnaVerifikacija>({
  "za-preverjanje": "Za preverjanje",
  "v-pregledu": "V pregledu",
  potrjeno: "Potrjeno",
  "potrebni-popravki": "Potrebni popravki",
});

export const STATUS_IZVEDBE_MOZNOSTI = izTabele<StatusIzvedbe>({
  "predlog-preveriti": "Predlog – preveriti",
  "potrjeno-za-vkljucitev": "Potrjeno za vključitev",
  "terenski-popis": "Terenski popis",
  "v-pripravi-vsebin": "V pripravi vsebin",
  "v-tehnicni-pripravi": "V tehnični pripravi",
  objavljeno: "Objavljeno",
  "izloceno-zamenjano": "Izločeno / zamenjano",
});

export type Pravice = "lastno-delo" | "dovoljenje-pridobljeno" | "prosta-licenca" | "javna-domena" | "neznano";

export const PRAVICE_MOZNOSTI = izTabele<Pravice>({
  "lastno-delo": "Lastno delo",
  "dovoljenje-pridobljeno": "Dovoljenje pridobljeno",
  "prosta-licenca": "Prosta licenca — objava z navedbo vira",
  "javna-domena": "Javna domena",
  neznano: "Neznano",
});

export const FOTO_TIP_MOZNOSTI = izTabele<FotoTip>({
  danes: "Današnja fotografija",
  arhivska: "Arhivska fotografija",
});
