/**
 * Core data schema for "Pot ob žici".
 *
 * Field names mirror the client's Excel master sheet (Slovenian), because
 * lib/data.ts, scripts/import-xlsx.ts and scripts/seed.ts all read/write
 * this exact shape. Changing a field here means updating the importer AND
 * the Supabase migration in the same commit (see CLAUDE.md rule 3).
 *
 * `Tocka` extends the JSON shape given in the project brief with columns
 * from the Excel "MASTER 50" sheet that the brief's example omitted but
 * Phase 4 (the admin) needs: gradiva-status columns (EŠD, foto rights),
 * QR rollout tracking, and the project-management columns (responsible
 * person, deadline, progress %, notes). All of these are informational —
 * none of them are historical content, so populating them is not covered
 * by the "never invent historical content" rule.
 *
 * NOTE on GPS status: the Excel has a separate "GPS status" column (J),
 * but for all 50 current rows its value normalizes to the same thing the
 * existing `gps_zanesljivost` field already encodes ("priblizek"). Adding
 * a second field for the same fact would just invite them to drift apart,
 * so `gps_zanesljivost` IS the GPS status column — no duplicate field.
 */

/** Type of memorial object. Closed set — confirmed against all 50 rows. */
export type Vrsta =
  | "plosca" // ploščа
  | "spomenik"
  | "grobnica"
  | "bunker"
  | "kompleks"
  | "muzej"
  | "kraj-dogodka";

/**
 * How a point relates to the main 8-stage trail. "Bližina poti" points are
 * close to the trail but not on it; "Razširjeni * krak" points are on a
 * named extended branch, geographically far from the main loop.
 */
export type Vkljucitev =
  | "Osnovna pot"
  | "Osnovna pot / bližina"
  | "Bližina poti"
  | "Razširjeni zahodni krak"
  | "Razširjeni vzhodni krak"
  | "Razširjeni severni krak"
  | "Razširjeni severovzhodni krak";

/** GPS reliability. All current data is "priblizek" (approximate). */
export type GpsZanesljivost = "priblizek" | "terensko-izmerjeno" | "preverjeno-v-gis";

/** Story theme used for filter chips. A point can carry up to 3. */
export type Zgodba =
  | "odpor"
  | "zrtve"
  | "kultura-spominjanja"
  | "otroci-in-mladi"
  | "partizanske-enote"
  | "talci"
  | "zeleznicarji"
  | "mesto-v-zici"
  | "bombardiranje"
  | "zenske-v-odporu";

/** EŠD (heritage register) entry status. */
export type EsdStatus = "za-preverjanje" | "vpisano" | "ni-esd" | "ni-relevantno";

/** Whether photo usage rights have been sorted out for this point overall. */
export type VsebinskiStatus = "ni-zaceto" | "v-pripravi" | "za-preverjanje" | "koncano" | "ni-potrebno";

/** QR permission status (landowner / heritage authority sign-off). */
export type DovoljenjeQr = "za-preverjanje" | "pridobljeno" | "zavrnjeno" | "ni-potrebno";

/** Expert (historian/museum) review status. */
export type StrokovnaVerifikacija = "za-preverjanje" | "v-pregledu" | "potrjeno" | "potrebni-popravki";

/** Where this point stands in the client's rollout process (Excel AD). */
export type StatusIzvedbe =
  | "predlog-preveriti"
  | "potrjeno-za-vkljucitev"
  | "terenski-popis"
  | "v-pripravi-vsebin"
  | "v-tehnicni-pripravi"
  | "objavljeno"
  | "izloceno-zamenjano";

/**
 * Public-facing publish gate (Phase 4). Distinct from `status_izvedbe`
 * above, which tracks the client's internal rollout workflow. This is the
 * simple draft/review/published switch that Supabase RLS will key off:
 * the public site only ever reads rows where `status === "objavljeno"`.
 * All 50 seed rows are "objavljeno" today because their texts are
 * intentionally empty placeholders, not half-written drafts.
 */
export type Status = "osnutek" | "v_pregledu" | "objavljeno";

/** Which kind of photo — matches the Excel's separate "today" / "archive" columns. */
export type FotoTip = "danes" | "arhivska";

export interface Foto {
  url: string;
  opis: string | null;
  /** Author or source of the photo. */
  avtor_vir: string | null;
  /**
   * Usage rights statement. A photo MUST NOT be shown on the public site
   * until this is filled in (Phase 4 hard validation) — a public heritage
   * site cannot carry images of unknown origin.
   */
  pravice: string | null;
  tip: FotoTip;
}

/**
 * Quiz question shape for the future quiz builder (Phase 5 — not built
 * yet). Declared now only so `kviz: []` type-checks against something
 * more specific than `unknown[]`.
 */
export interface KvizVprasanje {
  vprasanje: string;
  odgovori: string[];
  pravilni_indeks: number;
}

export interface Tocka {
  /** Stable ID, e.g. "NMZ-017". Never reused for a different point. */
  id: string;
  /** Stable slug, transliterated (č→c, š→s, ž→z). Never regenerated. */
  slug: string;
  naziv: string;
  obmocje: string;
  /** Raw free-text type from the Excel, kept for traceability. */
  vrsta_raw: string;
  vrsta: Vrsta;
  lat: number;
  lon: number;
  gps_zanesljivost: GpsZanesljivost;
  /** Heritage register ID (EŠD). Often null — most points aren't registered. */
  esd: string | null;
  esd_status: EsdStatus;
  /**
   * Stage ID (`Etapa.id`, e.g. "etapa-7"), or null for a point that belongs
   * to no stage — it still shows on the map but is part of no route.
   */
  etapa: string | null;
  /**
   * Order of the point within its stage's route (1-based), or null when
   * the point has no stage. Defaulted by scripts/import-xlsx.ts from
   * geographic order (lib/zaporedje.ts); editable in the admin.
   */
  zaporedje: number | null;
  /**
   * Stage section name, e.g. "Šmihel – Drska". Not stored in Supabase —
   * lib/data.ts overwrites it on read from the point's `Etapa.odsek`, so
   * the two can never drift apart. Kept in tocke.seed.json only because
   * the Excel carries it (column C).
   */
  odsek: string;
  vkljucitev: Vkljucitev;
  /** One-line teaser. Already written by the client — safe to display. */
  iztocnica: string;
  /** Free-text theme/person label from the Excel, kept for traceability. */
  kljucna_tema: string;
  /** Normalized story theme(s), derived from `kljucna_tema`. 1–3 entries. */
  zgodbe_predlog: Zgodba[];
  viri: string[];
  /**
   * QR shortlink. ALWAYS derived as `${NEXT_PUBLIC_BASE_URL}/${id.toLowerCase()}`
   * — never stored as a hand-typed value, so a base-URL change can't leave
   * stale links behind. Present on the type for convenience but computed
   * by lib/qr.ts, not read from the seed/DB row.
   */
  qr_url: string;

  // --- Content (empty until the association's historians write it) ---
  /** 800–1200 char short text. Null = not written yet -> "Vsebina v pripravi". */
  besedilo_kratko: string | null;
  besedilo_poglobljeno: string | null;
  foto: Foto[];
  kviz: KvizVprasanje[];

  // --- Publish gate (Phase 4) ---
  status: Status;
  updated_at: string | null;
  updated_by: string | null;

  // --- Client rollout tracking (Excel project-management columns) ---
  /** Have photo usage rights been sorted out for this point overall? */
  foto_pravice_status: VsebinskiStatus;
  qr_generiran: boolean;
  qr_tablica_namescena: boolean;
  dovoljenje_qr: DovoljenjeQr;
  strokovna_verifikacija: StrokovnaVerifikacija;
  status_izvedbe: StatusIzvedbe;
  odgovorna_oseba: string | null;
  /** ISO date string (yyyy-mm-dd), or null if not set. */
  rok: string | null;
  /** 0–100, or null if not tracked. */
  napredek: number | null;
  opombe: string | null;
}

/**
 * A stage (etapa). Editable data since Phase 4 — no longer a hardcoded
 * 1–8 table. `id` is a stable slug ("etapa-1"); never regenerate it for an
 * existing stage, it is referenced by tocke.etapa, URLs and the offline
 * fallback files data/poti/<id>.geojson. `stevilka` is display order only
 * and may change when an editor reorders stages.
 */
export interface Etapa {
  id: string;
  stevilka: number;
  naziv: string;
  odsek: string | null;
  /** "#rrggbb". Shared by the stage's markers, trail line and panel row. */
  barva: string;
  opis: string | null;
  /** Hidden stages are not shown publicly (RLS filters them out). */
  vidna: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

/** Outcome of a routing attempt. "Stale" is never stored — see Trasa.kljuc. */
export type TrasaStatus = "izracunano" | "ni_uspelo";

/** One leg of a computed route, between two consecutive waypoints. */
export interface TrasaKrak {
  od_id: string;
  do_id: string;
  dolzina_m: number;
  /** Straight-line distance, for the "suspicious detour" check. */
  zracna_m: number;
}

/**
 * A cached routing result (table `trase`). The public map only ever reads
 * these; routing calls happen in the admin (Phase 4 step 2).
 *
 * `kljuc` hashes the ordered (point id, lat, lon) list + stage ids +
 * routing profile. A route is stale exactly when the key computed from the
 * current points no longer matches — staleness is derived, not stored, so
 * it can never be forgotten.
 */
export interface Trasa {
  id: string;
  kljuc: string;
  etapa_ids: string[];
  geometry: { type: "LineString"; coordinates: [number, number][] } | null;
  dolzina_m: number | null;
  trajanje_s: number | null;
  engine: string;
  izracunano_ob: string;
  status: TrasaStatus;
  /** Why routing failed (status "ni_uspelo"), shown in the admin. */
  razlog: string | null;
  kraki: TrasaKrak[] | null;
}

/**
 * A trail: one of the 8 numbered stages, or the 1943 wire ring. Loaded
 * generically from whatever GeoJSON files sit in data/poti/ — see
 * lib/data.ts and README.md for the "drop in a real GPX later" contract.
 */
export type PotVrsta = "etapa" | "zica";

/**
 * A trail's geometry is never presented as surveyed unless it explicitly
 * is. "shematsko" = ordered/smoothed from point positions, no real
 * survey. The 1943 ring additionally uses this literal string.
 */
export type PotStatus = "shematsko" | "PLACEHOLDER — ni zgodovinsko potrjeno";

export interface Pot {
  slug: string;
  naziv: string;
  vrsta: PotVrsta;
  /**
   * Stage display number for the committed schematic fallback files, null
   * for the 1943 wire. Match a Pot to its Etapa by `slug === Etapa.id`.
   */
  etapa: number | null;
  odsek: string | null;
  /** Colour shared by the trail line, its markers, and its panel row. */
  barva: string;
  status: PotStatus | null;
  /** IDs of points this trail's row groups in the side panel. */
  tocke_ids: string[];
  /** GeoJSON LineString geometry, [lon, lat] pairs. */
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}
