# Pot ob žici

Spominska pot ob žici okoli Novega mesta — 50 obeležij druge svetovne vojne na 8 etapah.
Memorial trail around Novo mesto, Slovenia — 50 WWII memorial sites across 8 trail stages.

---

## Za naročnika (ZZB NOB Novo mesto)

### Kaj je to

Spletna stran, na kateri je zemljevid **domača stran** — obiskovalec takoj vidi zemljevid
Novega mesta z etapami poti in obeležji, ne pristajalne strani pred njim. Vsako obeležje ima
svojo stran, na katero vodi QR-tablica na terenu.

### Kje je stanje zdaj (po Fazi 3)

Domača stran je zemljevid: vseh 50 obeležij, vseh 8 etap in preklopljiv obroč nekdanje žice, z
iskanjem, filtri in seznamom v stranskem panelu. Klik na obeležje ali etapo — na zemljevidu ali
v seznamu — odpre pojavno okno in vodi na svojo stran (`/tocka/...`, `/pot/...`) s polnim
besedilom (ali "Vsebina v pripravi"), viri, EŠD in kontekstnim zemljevidom. QR-tablice
(`/nmz-001` … `/nmz-050`) pravilno preusmerijo na pravo stran.

Gumb "Pelji me tja" zdaj poskusi izračunati pravo peš pot (razdalja, čas, navodila po korakih) —
za to na strežniku potrebuje `ORS_API_KEY` (glej `.env.example`); brez njega se pošteno prikaže
"Navigacija v aplikaciji trenutno ni na voljo" in ostane povezava do Google/Apple Zemljevidov.

Kar še manjka: admin za vnos besedil in fotografij je Faza 4 — brez njega vsebin trenutno ne
more vnesti nihče razen prek Excela/razvijalca.

Aplikacija ves čas deluje tudi brez podatkovne baze (za demo na katerem koli računalniku).

### Vsebina obeležij

**Nič besedila, ki ga niste napisali vi, ni na strani.** Polja za kratek in poglobljen opis so
prazna, dokler jih ne izpolni zgodovinar/-ka društva — do takrat se prikaže opozorilo
"Vsebina v pripravi" s povzetkom, ki ga že imate v Excelu, in povezavami na vire. Izjema so tri
demo-točke (NMZ-001, NMZ-016, NMZ-023), ki bodo za namen predstavitve nosile jasno označeno
**demo besedilo, ki NI zgodovinski vir**.

### GPS koordinate

Vse koordinate so **približki**, izračunani iz javno dostopnih podatkov — ne s terenskim
GPS-om. To bo na strani vedno jasno napisano. Pred namestitvijo QR-tablic jih je treba
terensko preveriti (kot že piše v opombi na vrhu vašega Excela).

### Kaj bo omogočilo urejanje vsebin (Faza 4)

Ko bo osnovni zemljevid gotov, sledi preprost urejevalnik ("admin"), kjer bo lahko urednik
društva vnašal besedila, fotografije (z obveznim navajanjem avtorja/pravic) in spreminjal
status objave posamezne točke — brez pomoči razvijalca in brez ponovnega uvažanja Excela.

---

## For developers

### Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · MapLibre GL JS + OpenFreeMap ·
Supabase (Postgres) · lucide-react. See `CLAUDE.md` for project rules — read it before
touching this repo.

### Quick start

```bash
npm install
npm run dev
```

No `.env` needed. `lib/data.ts` falls back to `tocke.seed.json` (all 50 points) when
`NEXT_PUBLIC_SUPABASE_URL` is unset — this must keep working on a completely fresh clone.

To connect Supabase instead, copy `.env.example` to `.env.local` and fill in the values, then:

```bash
# apply supabase/migrations/0001_init.sql, then 0002_etape_trase.sql, then:
npm run import:xlsx   # regenerate tocke.seed.json from the client's Excel (if needed)
npm run seed          # insert missing stages, then upsert tocke.seed.json (on id)
```

To test the in-app walking route ("Pelji me tja"), also set `ORS_API_KEY` in `.env.local` (a
free key from [openrouteservice.org](https://openrouteservice.org/dev/#/signup)). Without it,
`app/api/route/route.ts` returns 503 and the UI shows the "route unavailable" state — that's the
default in this repo, not a bug; the code follows ORS's documented `/v2/directions/foot-walking/geojson`
contract but hasn't been exercised against a live key in this environment.

### Data pipeline

```
client's Excel (MASTER 50 sheet)
        │  npm run import:xlsx
        ▼
tocke.seed.json  ──────────────►  lib/data.ts getPoints()  ──► app
        │  npm run seed                    ▲
        ▼                                   │ (if NEXT_PUBLIC_SUPABASE_URL set)
   Supabase "tocke" table ───────────────────┘
```

- **`tocke.seed.json` is generated, never hand-edited.** Run `npm run import:xlsx` to
  regenerate it from the Excel. Run `npm run import:xlsx:check` first to see a diff without
  writing anything.
- The Excel import is a **one-time migration**, not an ongoing sync. Once real content lives
  in Supabase, `npm run seed` will skip (with a warning) any row whose `updated_at` in the
  database is newer than the import — it will never clobber a human edit with a stale
  spreadsheet snapshot.
- Adding a new field: update `lib/types.ts` (`Tocka`/`Pot`), `scripts/import-xlsx.ts`, and
  `supabase/migrations/` together. See the comments at the top of each file.
- **Stages (etape) are data since Phase 4.** `etape` table in Supabase, or `ETAPE_SEED` in
  `lib/etape.ts` when there is no `.env`; read them through `lib/data.ts` `getEtape()`.
  `etape.id` is a stable slug (`etapa-3`) — `stevilka` is only display order and may change.
  The Excel's numeric "Etapa" column is resolved to that ID by the importer (an unknown number
  stops the import; an empty cell = no stage). A point's `odsek` is derived from its stage on
  read and is not stored in Supabase.
- `zaporedje` (a point's order within its stage, used for routing) has no Excel column. The
  importer computes a default from geography (`lib/zaporedje.ts`: projection along the stage
  direction, then 2-opt) for every point of every stage, extended branches included. It is a
  starting point only — editors set the real order in the admin, and `npm run seed` won't
  overwrite rows edited there after the import.
- Slugs are stable IDs. `scripts/import-xlsx.ts` never regenerates a slug for an ID that
  already exists in `tocke.seed.json` — only a brand-new point gets a freshly `slugify()`'d
  slug.
- Two Excel columns (T–U "besedilo", V "video", W "avdio", X "kviz") currently hold **workflow
  status placeholders** ("Ni začeto" etc.), not real content — the importer never copies them
  into `besedilo_kratko`/`besedilo_poglobljeno`/`kviz`. If one of those cells ever contains
  something else (a historian typed real text directly into the spreadsheet), the importer
  prints a loud warning instead of silently discarding it — real content still needs to be
  entered through the admin (Phase 4) once it exists.

### Routed trails (trase) — Phase 4

Stage routes are computed along real streets and footpaths by OpenRouteService `foot-walking`,
**server-side only** (`lib/ors.ts`; `ORS_API_KEY` never reaches the browser), and cached. The
public map only ever reads the cache.

- **Building blocks:** each stage's route through its published points in `zaporedje` order, and
  a connector for every ordered pair of stages (last point → first point). A selection of
  several stages is composed from these on read (`lib/trase.ts` `sestaviTraso`), so 7 stage
  requests + 28 connector requests cover all 255 selections.
- **Staleness is derived, not stored:** each cached row carries a key hashing profile, stage IDs
  and the ordered `(id, lat, lon)` waypoints. Moving, reordering, reassigning or (un)publishing
  a point changes the key; a row whose key no longer matches is never served.
- **Honest fallback:** a part without a current routed row is drawn from the schematic file
  below (or a straight connector) and marked `"shematsko"`. Failures are cached with a reason; a
  missing key or an ORS rate limit stops the batch and writes nothing.
- **Storage:** Supabase `trase` when configured, otherwise `.cache/trase.json` (gitignored), so a
  fresh clone shows the schematic fallback.

```bash
npm run trase                               # state of every route, no ORS calls
npm run trase -- --preracunaj               # recompute stale / missing / failed (≤ 35 requests)
npm run trase -- --preracunaj --vse         # recompute everything
npm run trase -- --etapa=etapa-6            # one stage (+ connectors touching it)
npm run trase:preizkus                      # self-check of the acceptance criteria (3 requests)
```

Both scripts read `.env.local`. Quality warnings (leg > 2,5× the straight line, leg > 3 km,
point > 100 m from the nearest mapped path) are shown for stage routes and connectors between
consecutive stages.

### Trails (poti)

`data/poti/*.geojson` — one file per trail, loaded generically by `lib/data.ts` `getPoti()`.
**Dropping in a real GPX-derived GeoJSON file needs zero code changes**, as long as its
Feature `properties` carry: `slug`, `naziv`, `vrsta` (`"etapa"` | `"zica"`), `etapa` (number or
`null`), `odsek` (string or `null`), `barva` (hex colour), `status` (`"shematsko"` | the 1943
placeholder string | `null` once a trail is actually surveyed), and `tocke_ids` (array of point
IDs the trail's panel row groups). The loader just reads whatever `.geojson` files sit in the
directory — it doesn't hardcode "8 stages".

Today none of that geometry is real (no GPX exists yet):

- `scripts/generate-poti.ts` builds `etapa-1.geojson` … `etapa-8.geojson` by ordering each
  stage's on-trail points between two hand-placed anchor waypoints (`data/sidrisca.json`,
  itself explicitly a placeholder) and smoothing with Chaikin corner-cutting. Every generated
  feature is stamped `"status": "shematsko"`. Re-run with `npm run generate:poti` any time
  `tocke.seed.json` changes.
- `data/poti/zica-1943.geojson` (the approximate 1942–43 defensive wire ring) is hand-authored,
  not generated — `scripts/generate-poti.ts` never touches it. Every feature carries
  `"status": "PLACEHOLDER — ni zgodovinsko potrjeno"`.

When real trail data eventually exists (a club GPX, a professional survey), replace the
relevant file(s) in `data/poti/` and drop the `status` property (or set it once the trail is
actually surveyed) — no other change needed.

### Conventions (see CLAUDE.md for the full list)

- Data access only through `lib/data.ts` — never call Supabase from a component.
- `localStorage` only through `lib/progress.ts`, always wrapped in try/catch.
- All user-facing strings are Slovenian; code and comments are English.
- No new dependencies without asking first.

### Known accepted risks

- `xlsx` (SheetJS) has open advisories (prototype pollution, ReDoS) with no fix released.
  It's a dev-only script dependency (`scripts/import-xlsx.ts`), run locally against a single
  trusted file supplied by the client — never bundled into the deployed app or exposed to user
  input. Flagged here rather than swapped, since a replacement is a new-dependency decision.
- `next build`'s bundled `postcss` has open advisories fixed only in `next@16`, a major
  version bump. `CLAUDE.md` pins Next.js 15 — not upgraded without asking.

### Scripts

```bash
npm run dev              # start dev server (no .env needed)
npm run build            # production build, must pass with zero TS errors
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run import:xlsx      # regenerate tocke.seed.json from the client's Excel
npm run import:xlsx:check # same, but only prints a diff — writes nothing
npm run generate:poti    # regenerate the 8 schematic stage GeoJSON files
npm run seed              # push tocke.seed.json into Supabase (idempotent)
```
