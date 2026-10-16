/**
 * Regenerates tocke.seed.json from the client's Excel master sheet.
 *
 * `npm run import:xlsx`        — writes tocke.seed.json + tocke.seed.meta.json
 * `npm run import:xlsx:check`  — computes the same result but only prints a
 *                                 diff against the current tocke.seed.json;
 *                                 never writes. Exits 1 if anything would change.
 *
 * CLAUDE.md rule: tocke.seed.json is generated, not hand-edited. This is
 * the only script allowed to write it.
 *
 * Sheet "MASTER 50", header row 4, data rows 5–54 (Excel table
 * MasterObelezja, A4:AH54).
 *
 * IMPORTANT — what this script does NOT do: columns T (Kratko besedilo),
 * U (Poglobljeno besedilo), V (Video), W (Avdio/podkast) and X (Kviz) in
 * the Excel currently hold WORKFLOW STATUS strings ("Ni začeto", "V
 * pripravi", …), not real historical content — the association's
 * historians haven't written anything yet. This script never copies those
 * cells into besedilo_kratko/besedilo_poglobljeno/kviz; those stay null/[]
 * from Excel import and are only ever filled in later via the Phase 4
 * admin (Supabase), never via a spreadsheet re-import. If one of those
 * cells ever contains something OTHER than a known status placeholder —
 * i.e. someone typed real content into the Excel — this script warns
 * loudly instead of silently discarding it (see checkForStrayContent).
 *
 * Stages: column B holds the stage NUMBER; it is resolved to a stage ID
 * ("etapa-3") that must exist in lib/etape.ts ETAPE_SEED, and an empty cell
 * means "no stage". `zaporedje` (order within the stage) has no Excel
 * column — it is computed here from geography (lib/zaporedje.ts) so the
 * seed and the no-.env fallback carry a sensible default. Once Supabase
 * exists, the admin is where stage and order are edited; scripts/seed.ts
 * will not overwrite a row edited there more recently than this import.
 *
 * The one exception: NMZ-001, NMZ-016 and NMZ-023 get DEMO_BESEDILA below
 * so one detail page can be demoed with real-length text (CLAUDE.md
 * explicitly allows this for exactly these three, labelled as demo). It's
 * applied here rather than hand-edited into the seed so it survives a
 * re-import — see DEMO_BESEDILA.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { slugify } from "../lib/slug";
import { ETAPE_SEED, etapaIdIzStevilke } from "../lib/etape";
import { privzetoZaporedje, type LatLon } from "../lib/zaporedje";
import type {
  DovoljenjeQr,
  EsdStatus,
  StatusIzvedbe,
  StrokovnaVerifikacija,
  Tocka,
  Vkljucitev,
  Vrsta,
  VsebinskiStatus,
  Zgodba,
} from "../lib/types";

const ROOT = join(import.meta.dirname, "..");
const SEED_PATH = join(ROOT, "tocke.seed.json");
const SIDRISCA_PATH = join(ROOT, "data", "sidrisca.json");
const META_PATH = join(ROOT, "tocke.seed.meta.json");
const SHEET_NAME = "MASTER 50";
const HEADER_ROW_INDEX = 3; // row 4, 0-based
const FIRST_DATA_ROW_INDEX = 4; // row 5, 0-based
const LAST_DATA_ROW_INDEX = 53; // row 54, 0-based

// --- Column letters -> 0-based indices -------------------------------------
const COL = {
  ID: 0, // A
  ETAPA: 1, // B
  ODSEK: 2, // C
  VKLJUCITEV: 3, // D
  NAZIV: 4, // E
  OBMOCJE: 5, // F
  VRSTA_RAW: 6, // G
  LAT: 7, // H
  LON: 8, // I
  GPS_STATUS: 9, // J
  ESD: 10, // K
  ESD_STATUS: 11, // L
  IZTOCNICA: 12, // M
  KLJUCNA_TEMA: 13, // N
  VIR1: 14, // O
  VIR2: 15, // P
  DANASNJA_FOTO: 16, // Q
  ARHIVSKA_FOTO: 17, // R
  PRAVICE_FOTO: 18, // S
  BESEDILO_KRATKO: 19, // T — status placeholder only, see file header
  BESEDILO_POGLOBLJENO: 20, // U — status placeholder only
  VIDEO: 21, // V — status placeholder only
  AVDIO: 22, // W — status placeholder only
  KVIZ: 23, // X — status placeholder only
  QR_URL: 24, // Y — ignored, qr_url is always derived (lib/qr.ts)
  QR_GENERIRAN: 25, // Z
  QR_TABLICA: 26, // AA
  DOVOLJENJE_QR: 27, // AB
  STROKOVNA_VERIFIKACIJA: 28, // AC
  STATUS_IZVEDBE: 29, // AD
  ODGOVORNA_OSEBA: 30, // AE
  ROK: 31, // AF
  NAPREDEK: 32, // AG
  OPOMBE: 33, // AH
} as const;

/** Status-placeholder strings the "vsebina" columns (T/U/V/W/X) may hold. */
const KNOWN_PLACEHOLDER_VALUES = new Set(["Ni začeto", "V pripravi", "Za preverjanje", "Končano", "Ni potrebno", ""]);

// --- Curated mapping tables (not mechanically derivable from raw text) -----

const VRSTA_RAW_TO_VRSTA: Record<string, Vrsta> = {
  "Bunker / obrambni objekt": "bunker",
  Grob: "grobnica",
  "Grob / grobnica": "grobnica",
  "Grob / spomenik": "grobnica",
  Grobišče: "grobnica",
  Grobnica: "grobnica",
  "Grobnica / spomenik": "grobnica",
  "Kip / spomenik": "spomenik",
  "Muzejska spominska točka": "muzej",
  "Naravna lokacija / spominski plošči": "kraj-dogodka",
  Spomenik: "spomenik",
  "Spomeniški kompleks": "kompleks",
  "Spominska plošča": "plosca",
  "Spominska plošča / lokacija dogodka": "plosca",
  "Spominski park": "kompleks",
  "Spominski sklop": "kompleks",
  "Spominsko obeležje": "spomenik",
};

/**
 * kljucna_tema -> zgodbe_predlog. Curated by hand (a free-text theme label
 * cannot be mechanically split into story-theme tags). Extracted from the
 * previously reviewed tocke.seed.json. A kljucna_tema not in this table
 * means a genuinely new theme text — the script stops and asks rather than
 * guessing tags for it.
 */
const TEMA_TO_ZGODBE: Record<string, Zgodba[]> = {
  "Alojz Colja; lokalni odpor": ["odpor"],
  "Anton Čampa; aktivizem / odpor": ["odpor"],
  "Anton Štrasner; represija": ["odpor"],
  "Bombardiranje; civilne žrtve": ["bombardiranje", "zrtve"],
  "Cankarjeva brigada; padli borci": ["partizanske-enote", "zrtve"],
  "Civilne žrtve; družinska zgodba": ["zrtve"],
  "Danilo Podobnik; Slavko Petrič": ["odpor"],
  "Delavsko gibanje; predvojni kontekst": ["odpor"],
  "Delo; mladi; lokalna skupnost": ["otroci-in-mladi"],
  "Dogodki NOB; spomin v krajini": ["kultura-spominjanja"],
  "Dolenjski odred; padli borci": ["partizanske-enote", "zrtve"],
  "Družinska zgodba; žrtve / odpor": ["zrtve", "odpor"],
  "Gasilstvo; lokalna skupnost; NOB": ["odpor"],
  "Ilegalna tehnika; odpor": ["odpor"],
  "Katja Rupena; ženske v odporu": ["zenske-v-odporu", "odpor"],
  "Lokalne žrtve NOB": ["zrtve"],
  "Lokalni dogodki NOB": ["odpor"],
  "Lokalni odpor; padli": ["zrtve", "odpor"],
  "Lokalni odpor; padli domačini": ["zrtve", "odpor"],
  "Lokalni odpor; spomin": ["odpor"],
  "Mesto v žici; okupacijski obrambni sistem": ["mesto-v-zici"],
  "Milan Majcen; odpor": ["odpor"],
  "Mladi; izobraževanje; odpor": ["otroci-in-mladi", "odpor"],
  "Mladi; lokalna zgodovina": ["otroci-in-mladi"],
  "Mladi; šolstvo; NOB": ["otroci-in-mladi"],
  "Muzejska interpretacija; zgodovinski viri": ["kultura-spominjanja"],
  "Narodni heroji; kolektivni spomin": ["kultura-spominjanja"],
  "Odpor; organizirano delovanje": ["odpor"],
  "Padli borci / žrtve": ["zrtve"],
  "Padli borci NOB": ["zrtve"],
  "Padli borci NOV": ["zrtve"],
  "Padli borci; civilne žrtve": ["zrtve"],
  "Padli borci; javni spominski prostor": ["zrtve", "kultura-spominjanja"],
  "Padli borci; spomin": ["zrtve"],
  "Padli borci; žrtve; spomin": ["zrtve"],
  "Partizanske enote; Dolenjski bataljon": ["partizanske-enote"],
  "Represija; institucije; odpor": ["odpor"],
  "Represija; talci; javne usmrtitve": ["talci"],
  "Spomin; povojna kultura spominjanja": ["kultura-spominjanja"],
  "Talci; okupacijsko nasilje": ["talci"],
  "Tito; povojni spomin": ["kultura-spominjanja"],
  "Valantičeva družina; lokalni spomin": ["odpor"],
  "Železničarji; odpor": ["zeleznicarji", "odpor"],
  "Železničarji; odpor; logistika": ["zeleznicarji", "odpor"],
  "Železničarska brigada; organiziranje odpora": ["zeleznicarji", "partizanske-enote", "odpor"],
};

const ESD_STATUS_MAP: Record<string, EsdStatus> = {
  "Za preverjanje": "za-preverjanje",
  Vpisano: "vpisano",
  "Ni EŠD": "ni-esd",
  "Ni relevantno": "ni-relevantno",
};

const VSEBINSKI_STATUS_MAP: Record<string, VsebinskiStatus> = {
  "Ni začeto": "ni-zaceto",
  "V pripravi": "v-pripravi",
  "Za preverjanje": "za-preverjanje",
  Končano: "koncano",
  "Ni potrebno": "ni-potrebno",
};

const DOVOLJENJE_QR_MAP: Record<string, DovoljenjeQr> = {
  "Za preverjanje": "za-preverjanje",
  Pridobljeno: "pridobljeno",
  Zavrnjeno: "zavrnjeno",
  "Ni potrebno": "ni-potrebno",
};

const STROKOVNA_VERIFIKACIJA_MAP: Record<string, StrokovnaVerifikacija> = {
  "Za preverjanje": "za-preverjanje",
  "V pregledu": "v-pregledu",
  Potrjeno: "potrjeno",
  "Potrebni popravki": "potrebni-popravki",
};

const STATUS_IZVEDBE_MAP: Record<string, StatusIzvedbe> = {
  "Predlog – preveriti": "predlog-preveriti",
  "Potrjeno za vključitev": "potrjeno-za-vkljucitev",
  "Terenski popis": "terenski-popis",
  "V pripravi vsebin": "v-pripravi-vsebin",
  "V tehnični pripravi": "v-tehnicni-pripravi",
  Objavljeno: "objavljeno",
  "Izločeno / zamenjano": "izloceno-zamenjano",
};

const VKLJUCITEV_VALUES: Vkljucitev[] = [
  "Osnovna pot",
  "Osnovna pot / bližina",
  "Bližina poti",
  "Razširjeni zahodni krak",
  "Razširjeni vzhodni krak",
  "Razširjeni severni krak",
  "Razširjeni severovzhodni krak",
];

const DEMO_OZNAKA = "[DEMO BESEDILO — ni zgodovinski vir]";

/**
 * Filler for exactly NMZ-001, NMZ-016, NMZ-023 (CLAUDE.md exception), so
 * one detail page can be demoed with real-length text before the
 * association's historians write the real thing. Deliberately written to
 * describe the DEMO ITSELF rather than invent plausible-sounding history —
 * no invented dates, names or casualty numbers, even as filler — so the
 * label stays true even if someone reads only this text out of context.
 */
const DEMO_BESEDILA: Record<string, { kratko: string; poglobljeno: string }> = {
  "NMZ-001": {
    kratko:
      `${DEMO_OZNAKA} Ta odstavek prikazuje, kako bo videti izpolnjeno kratko besedilo, ko ga pripravijo ` +
      `zgodovinarji društva ZZB NOB Novo mesto. Bunker na Drski je eden redkeje ohranjenih objektov, ` +
      `povezanih z okupacijskim obrambnim sistemom okoli Novega mesta — mrežo utrdb, opazovalnic in ` +
      `žičnih ovir, po kateri je pot dobila ime. Namesto tega odstavka bo dokončno besedilo vsebovalo ` +
      `preverjene podatke o gradnji, uporabi in današnjem stanju objekta, z navedbo virov in strokovnega ` +
      `pregleda ZVKDS oziroma Dolenjskega muzeja. Ta stran do takrat ne trdi ničesar konkretnega o ` +
      `datumih, osebah ali dogodkih — gre izključno za ponazoritev postavitve strani za predstavitev ` +
      `naročniku in financerju projekta.`,
    poglobljeno:
      `${DEMO_OZNAKA} Poglobljeno besedilo je namenjeno obiskovalcem, ki si želijo več konteksta kot ga ` +
      `ponuja kratek uvod. V končni različici bo ta razdelek predstavil širši okupacijski obrambni ` +
      `sistem, umestil bunker v ta sistem in navedel, na podlagi katerih virov (arhivski dokumenti, ` +
      `terenski pregled, pričevanja) je bila vsebina pripravljena.\n\n` +
      `Trenutno besedilo služi le preizkusu postavitve: dolžine odstavkov, preloma vrstic in prostora ` +
      `za slikovno gradivo. Ne vsebuje nobenega dejanskega datuma, imena ali števila žrtev — vse ` +
      `tovrstne podatke bo pred objavo potrdil strokovni partner projekta, kot določa postopek ` +
      `verifikacije v projektni dokumentaciji.`,
  },
  "NMZ-016": {
    kratko:
      `${DEMO_OZNAKA} Vzorčno besedilo za obeležje na novomeški gimnaziji. Plošča spominja na vlogo ` +
      `šole in njenih dijakov med drugo svetovno vojno — natančno besedilo o osebah in dogodkih bo ` +
      `dodano po pregledu virov, ki ga opravi strokovni partner projekta. Ta odstavek ne navaja nobenih ` +
      `konkretnih imen, datumov ali številk, ki bi jih bilo mogoče zamenjati za preverjeno zgodovinsko ` +
      `dejstvo — namenjen je izključno predstavitvi videza strani.`,
    poglobljeno:
      `${DEMO_OZNAKA} V dokončni različici bo ta razdelek povezal zgodbo šole s širšim dogajanjem v ` +
      `Novem mestu med okupacijo in odporom, z navedbo virov (šolska kronika, pričevanja, arhivsko ` +
      `gradivo). Besedilo, ki ga vidite zdaj, je samo ponazoritev dolžine in oblike — brez izmišljenih ` +
      `podatkov o konkretnih osebah.`,
  },
  "NMZ-023": {
    kratko:
      `${DEMO_OZNAKA} Vzorčno besedilo za spominsko ploščo padlim železničarjem. Dokončna vsebina bo ` +
      `opisala vlogo železničarjev pri odporu proti okupatorju na podlagi preverjenih virov. Ta odstavek ` +
      `je samo demonstracija postavitve strani in ne vsebuje nobenih dejanskih imen, datumov ali ` +
      `dogodkov.`,
    poglobljeno:
      `${DEMO_OZNAKA} Poglobljeno besedilo bo v končni različici umestilo delovanje železničarjev v ` +
      `širši kontekst ilegalnega dela in logistične podpore odporniškemu gibanju, z navedbo virov. ` +
      `Trenutno besedilo služi le preizkusu dolžine in oblikovanja strani.`,
  },
};

// --- Helpers -----------------------------------------------------------------

function lookup<T extends string>(map: Record<string, T>, raw: string, context: string): T {
  const value = map[raw];
  if (value === undefined) {
    throw new Error(`Neznana vrednost "${raw}" za ${context}. Dodaj jo v mapping tabelo v scripts/import-xlsx.ts.`);
  }
  return value;
}

function parseVkljucitev(raw: string): Vkljucitev {
  const match = VKLJUCITEV_VALUES.find((v) => v === raw);
  if (!match) {
    throw new Error(`Neznana vrednost vključitve "${raw}". Pričakovana ena od: ${VKLJUCITEV_VALUES.join(", ")}.`);
  }
  return match;
}

function parseGpsZanesljivost(raw: string): Tocka["gps_zanesljivost"] {
  const lower = raw.toLowerCase();
  if (lower.includes("približek")) return "priblizek";
  if (lower.includes("teren")) return "terensko-izmerjeno";
  if (lower.includes("gis")) return "preverjeno-v-gis";
  console.warn(`  ⚠ Neprepoznan GPS status "${raw}", privzeto "priblizek".`);
  return "priblizek";
}

function parseBool(raw: string): boolean {
  return raw.trim().toLowerCase() === "da";
}

function nullIfEmpty(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Excel serial date -> "yyyy-mm-dd", for when AF (Rok) is entered as a date. */
function excelSerialToIsoDate(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().slice(0, 10);
}

function parseRok(cell: unknown): string | null {
  if (cell === undefined || cell === null || cell === "") return null;
  if (typeof cell === "number") return excelSerialToIsoDate(cell);
  return nullIfEmpty(String(cell));
}

function parseNapredek(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const num = Number(trimmed.replace("%", "").trim());
  return Number.isFinite(num) ? num : null;
}

/**
 * Warns (does not throw — this is a content-loss guard, not a hard error)
 * if a "vsebina" column holds something other than a known workflow
 * placeholder, meaning a human may have typed real content directly into
 * the Excel. That text is never imported either way (Excel is not a
 * content channel) but the person running the import needs to know it's
 * sitting there unclaimed.
 */
function checkForStrayContent(id: string, columnLabel: string, raw: string): void {
  if (!KNOWN_PLACEHOLDER_VALUES.has(raw.trim())) {
    console.warn(
      `  ⚠⚠ ${id}: stolpec "${columnLabel}" vsebuje besedilo, ki ni znan status ("${raw}").\n` +
        `      To NI bilo uvoženo (Excel ni vsebinski kanal) — preveri ročno in po potrebi vnesi prek admina.`,
    );
  }
}

/** Column B -> stage ID. Empty = no stage; an unknown number is a hard error. */
function parseEtapa(raw: string, id: string): string | null {
  if (raw.length === 0) return null;
  const stevilka = Number(raw);
  const etapaId = Number.isInteger(stevilka) ? etapaIdIzStevilke(stevilka) : null;
  if (!etapaId || !ETAPE_SEED.some((e) => e.id === etapaId)) {
    throw new Error(
      `Neznana etapa "${raw}" pri ${id}. Znane etape: ${ETAPE_SEED.map((e) => e.stevilka).join(", ")} (lib/etape.ts).`,
    );
  }
  return etapaId;
}

/**
 * Fills in `zaporedje` for every point that has a stage, all points of the
 * stage included (extended-branch points too — client decision, Phase 4).
 * The walking direction of a numbered stage runs from its anchor to the
 * next one (data/sidrisca.json, a closed loop of 8 — same convention as
 * scripts/generate-poti.ts).
 */
function assignZaporedje(points: Tocka[]): void {
  const sidrisca = (JSON.parse(readFileSync(SIDRISCA_PATH, "utf-8")) as { sidrisca: LatLon[] }).sidrisca;
  for (const etapa of ETAPE_SEED) {
    const start = sidrisca[etapa.stevilka - 1];
    const end = sidrisca[etapa.stevilka % sidrisca.length];
    const smer = start && end ? { start, end } : undefined;
    const vEtapi = points.filter((p) => p.etapa === etapa.id);
    privzetoZaporedje(vEtapi, smer).forEach((id, i) => {
      vEtapi.find((p) => p.id === id)!.zaporedje = i + 1;
    });
  }
}

function findExcelFile(): string {
  const explicit = process.argv.find((a) => a.endsWith(".xlsx"));
  if (explicit) return join(ROOT, explicit);
  const candidates = readdirSync(ROOT).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$"));
  if (candidates.length === 0) {
    throw new Error("V korenu projekta ni najti .xlsx datoteke. Podaj pot kot argument.");
  }
  if (candidates.length > 1) {
    throw new Error(`Najdenih več .xlsx datotek (${candidates.join(", ")}). Podaj pot kot argument.`);
  }
  return join(ROOT, candidates[0]!);
}

function loadExistingSeed(): Map<string, Tocka> {
  if (!existsSync(SEED_PATH)) return new Map();
  const raw = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as Partial<Tocka>[];
  return new Map(raw.filter((r): r is Tocka & { id: string } => typeof r.id === "string").map((r) => [r.id, r as Tocka]));
}

// --- Row -> Tocka -------------------------------------------------------------

function rowToTocka(row: unknown[], existing: Map<string, Tocka>): Tocka {
  const get = (i: number): string => {
    const v = row[i];
    return v === undefined || v === null ? "" : String(v).trim();
  };

  const id = get(COL.ID);
  if (!/^NMZ-\d{3}$/.test(id)) {
    throw new Error(`Neveljaven ID "${id}" — pričakovana oblika NMZ-000.`);
  }

  const naziv = get(COL.NAZIV);
  const vrsta_raw = get(COL.VRSTA_RAW);
  const kljucna_tema = get(COL.KLJUCNA_TEMA);
  const esdRaw = get(COL.ESD);

  const prev = existing.get(id);

  // Content/publish fields are never sourced from Excel — preserve whatever
  // is already on disk (or sane defaults for a brand-new point).
  for (const [col, label] of [
    [COL.BESEDILO_KRATKO, "Kratko besedilo"],
    [COL.BESEDILO_POGLOBLJENO, "Poglobljeno besedilo"],
    [COL.VIDEO, "Video"],
    [COL.AVDIO, "Avdio/podkast"],
    [COL.KVIZ, "Kviz"],
  ] as const) {
    checkForStrayContent(id, label, get(col));
  }

  return {
    id,
    slug: prev?.slug ?? slugify(naziv),
    naziv,
    obmocje: get(COL.OBMOCJE),
    vrsta_raw,
    vrsta: lookup(VRSTA_RAW_TO_VRSTA, vrsta_raw, `vrsta_raw (${id})`),
    lat: Number(get(COL.LAT)),
    lon: Number(get(COL.LON)),
    gps_zanesljivost: parseGpsZanesljivost(get(COL.GPS_STATUS)),
    esd: esdRaw.length > 0 ? esdRaw : null,
    esd_status: lookup(ESD_STATUS_MAP, get(COL.ESD_STATUS), `esd_status (${id})`),
    etapa: parseEtapa(get(COL.ETAPA), id),
    zaporedje: null, // filled in by assignZaporedje() once all rows are parsed
    odsek: get(COL.ODSEK),
    vkljucitev: parseVkljucitev(get(COL.VKLJUCITEV)),
    iztocnica: get(COL.IZTOCNICA),
    kljucna_tema,
    zgodbe_predlog: TEMA_TO_ZGODBE[kljucna_tema] ?? (() => {
      throw new Error(`Neznana kljucna_tema "${kljucna_tema}" pri ${id}. Dodaj jo v TEMA_TO_ZGODBE.`);
    })(),
    viri: [get(COL.VIR1), get(COL.VIR2)].filter((v) => v.length > 0),
    qr_url: "", // computed at read time by lib/qr.ts, never stored meaningfully

    besedilo_kratko: prev?.besedilo_kratko ?? DEMO_BESEDILA[id]?.kratko ?? null,
    besedilo_poglobljeno: prev?.besedilo_poglobljeno ?? DEMO_BESEDILA[id]?.poglobljeno ?? null,
    foto: prev?.foto ?? [],
    kviz: prev?.kviz ?? [],

    status: prev?.status ?? "objavljeno",
    updated_at: prev?.updated_at ?? null,
    updated_by: prev?.updated_by ?? null,

    foto_pravice_status: lookup(VSEBINSKI_STATUS_MAP, get(COL.PRAVICE_FOTO), `foto_pravice_status (${id})`),
    qr_generiran: parseBool(get(COL.QR_GENERIRAN)),
    qr_tablica_namescena: parseBool(get(COL.QR_TABLICA)),
    dovoljenje_qr: lookup(DOVOLJENJE_QR_MAP, get(COL.DOVOLJENJE_QR), `dovoljenje_qr (${id})`),
    strokovna_verifikacija: lookup(STROKOVNA_VERIFIKACIJA_MAP, get(COL.STROKOVNA_VERIFIKACIJA), `strokovna_verifikacija (${id})`),
    status_izvedbe: lookup(STATUS_IZVEDBE_MAP, get(COL.STATUS_IZVEDBE), `status_izvedbe (${id})`),
    odgovorna_oseba: nullIfEmpty(get(COL.ODGOVORNA_OSEBA)),
    rok: parseRok(row[COL.ROK]),
    napredek: parseNapredek(get(COL.NAPREDEK)),
    opombe: nullIfEmpty(get(COL.OPOMBE)),
  };
}

// --- Diff for --check ----------------------------------------------------------

function diffTocke(oldList: Tocka[], newList: Tocka[]): string[] {
  const lines: string[] = [];
  const oldMap = new Map(oldList.map((t) => [t.id, t]));
  const newMap = new Map(newList.map((t) => [t.id, t]));

  for (const id of newMap.keys()) {
    if (!oldMap.has(id)) lines.push(`+ ${id} je nova točka`);
  }
  for (const id of oldMap.keys()) {
    if (!newMap.has(id)) lines.push(`- ${id} v novem uvozu manjka`);
  }
  for (const [id, newRow] of newMap) {
    const oldRow = oldMap.get(id);
    if (!oldRow) continue;
    // qr_url is computed at read time, not a meaningful stored field — skip.
    const keys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]) as Set<keyof Tocka>;
    keys.delete("qr_url");
    for (const key of keys) {
      const a = JSON.stringify(oldRow[key]);
      const b = JSON.stringify(newRow[key]);
      if (a !== b) lines.push(`~ ${id}.${key}: ${a} -> ${b}`);
    }
  }
  return lines;
}

// --- Main ----------------------------------------------------------------------

function main() {
  const checkOnly = process.argv.includes("--check");
  const filePath = findExcelFile();
  console.log(`Berem ${filePath.replace(ROOT + "/", "")} (list "${SHEET_NAME}")...`);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`List "${SHEET_NAME}" ne obstaja. Najdeni listi: ${workbook.SheetNames.join(", ")}`);
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const header = rows[HEADER_ROW_INDEX];
  if (!header || String(header[COL.ID]).trim() !== "ID") {
    throw new Error(`Vrstica ${HEADER_ROW_INDEX + 1} ni pričakovana glava (stolpec A naj bo "ID").`);
  }

  const existing = loadExistingSeed();
  const dataRows = rows.slice(FIRST_DATA_ROW_INDEX, LAST_DATA_ROW_INDEX + 1).filter((r) => String(r[COL.ID] ?? "").trim().length > 0);

  console.log(`Najdenih ${dataRows.length} podatkovnih vrstic.`);
  const points = dataRows.map((row) => rowToTocka(row, existing));
  assignZaporedje(points);

  const ids = new Set(points.map((p) => p.id));
  if (ids.size !== points.length) {
    throw new Error("Podvojeni ID-ji v Excelu — uvoz prekinjen.");
  }

  if (checkOnly) {
    const oldList = [...existing.values()];
    const diff = diffTocke(oldList, points);
    if (diff.length === 0) {
      console.log("✓ Brez razlik — tocke.seed.json je skladen z Excelom.");
      process.exit(0);
    }
    console.log(`Najdenih ${diff.length} razlik:`);
    diff.forEach((line) => console.log(`  ${line}`));
    process.exit(1);
  }

  writeFileSync(SEED_PATH, JSON.stringify(points, null, 2) + "\n", "utf-8");
  const meta = {
    generated_at: new Date().toISOString(),
    source_file: filePath.replace(ROOT + "/", ""),
    point_count: points.length,
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  console.log(`✓ Zapisano ${points.length} točk v tocke.seed.json (generated_at: ${meta.generated_at}).`);
}

main();
