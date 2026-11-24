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

Koordinate vseh 50 obeležij so prevzete iz javnega registra **[partizanstvo.si](https://partizanstvo.si/)**
(vsako obeležje je povezano s svojim zapisom v registru po ID-ju). Terensko še niso preverjene —
na strani obeležja to piše skupaj s povezavo na zapis v registru. Pred namestitvijo QR-tablic jih
je še vedno treba preveriti na terenu.

**Koordinate v Excelu so zdaj najšibkejši vir.** Ponovni uvoz Excela (`npm run import:xlsx`)
koordinat obeležja, ki ima vir iz registra (`zunanji_vir`), terensko meritev (`terensko-izmerjeno`)
ali preverbo v GIS (`preverjeno-v-gis`), nikoli ne prepiše. Spremembo lokacije takega obeležja
vnesite v admin (ko bo na voljo) ali v `koordinate_partizanstvo.json` in zaženite
`npm run apply:koordinate` — ne v Excel.

**Pred objavo terensko preveriti** — ime v registru se ne ujema povsem z našim, zato je ujemanje
verjetno, ne zanesljivo (polje `gps_opomba`):

| ID | Obeležje | Kaj preveriti |
|---|---|---|
| NMZ-030 | Spominska plošča padlim gasilcem | Zapis v registru leži ob pokopališču Ločna, naša opomba navaja gasilski dom na Seidlovi cesti. |
| NMZ-033 | Spominski sklop NOB na pokopališču Šmihel | Na pokopališču je več ločenih zapisov; potrditi, da je to skupno obeležje, ne posamezen grob. |
| NMZ-034 | Valantičevo obeležje | 45 m od NMZ-033, ločeno od NMZ-004 (Kandija); potrditi, da gre za tri različna obeležja. |

### Gradivo iz registra partizanstvo.si

`data/partizanstvo.json` vsebuje za vseh 50 obeležij gradivo iz registra: prepis napisa, opis lokacije
in dostopa, katastrske podatke, avtorje vnosov in seznam fotografij. Dovoljenje za uporabo besedil
in fotografij registra je pridobljeno (`PROMPT_PRENOS.md`); oznaka `pravice: "NEUREJENO"` v datoteki
je starejša od dovoljenja in se ne uporablja. Urednik gradivo vidi v adminu na zavihku »Vsebina«
(plošča »Gradivo iz registra«); javna stran te datoteke ne bere.

Datoteko zapiše skripta, ki se **zažene ročno, ne ob gradnji**:

```bash
npx tsx scripts/import-partizanstvo.ts
```

**Ponovni zagon datoteko v celoti prepiše.** Zato vanjo nikoli ne piši ničesar uredniškega —
vse, kar urednik napiše ali odloči, sodi v admin.

Prepise napisov v polje »Napis na obeležju« prenese `npm run prenesi:napise` (brez zastavice le
pokaže, kaj bi naredil; z `-- --zapisi` zapiše). Napis zapiše **v objavljeno različico**, zato je
takoj na javni strani — vedno z navedbo »Prepis napisa je prevzet iz registra partizanstvo.si«
(kljukica »Prepis napisa je iz registra«, privzeto vklopljena). Urednik jo izklopi šele, ko napis
preveri na terenu in popravi. Skripta spremeni samo polje `napis`; obeležij, ki napis že imajo, ali
imajo neobjavljen osnutek, ne spreminja. To je edina izjema od pravila, da se gradivo iz registra
ne objavlja samodejno: napis je prepis javnega napisa, ne avtorsko besedilo registra.

#### »Prenesi iz registra« (admin)

Gumb v plošči »Gradivo iz registra« na obeležju in v razdelku »Gradivo iz registra« na etapi (za vsa
obeležja etape, eno za drugim) prenese v **osnutek** obeležja — nikoli v objavljeno različico:

- napis (`napis`) in opis dostopa (`dostop`, na javni strani »Kako do obeležja«), le če sta prazna;
- fotografije v zbirko Fotografije, pomanjšane na najdaljši rob 2000 px (JPEG, kakovost 82), s
  pravicami »Dovoljenje pridobljeno«, avtorjem in licenco iz registra, povezavo na zapis v registru
  ter mero in povezavo izvirnika. Pripete so za obstoječimi, največja prva.

Ponovni zagon ničesar ne podvoji (fotografija se prepozna po `vir_url` + imenu datoteke v registru).
Vrstico o dovoljenju, ki jo dobi vsaka uvožena fotografija, nastaviš v konstanti
`DOVOLJENJE_OPOMBA` v `cms/prenosRegistra.ts`. Dokler so v njej oglati oklepaji, se fotografije ne
uvažajo; po popravku jo ponovni zagon posodobi tudi na že uvoženih fotografijah. Uvoz se ustavi,
preden bi shranjene fotografije presegle 600 MB (brezplačna shramba Supabase ima 1 GB).

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

No `.env` needed. `lib/data.ts` falls back to `tocke.seed.json` / `etape.seed.json` (all 50
points, 8 stages) when `DATABASE_URI` + `PAYLOAD_SECRET` are unset — this must keep working on
a completely fresh clone. The admin (`/admin`) then says editing is unavailable.

To run with the database and the admin, copy `.env.example` to `.env.local` and fill in the
values (Payload + Supabase Storage + `SUPABASE_SERVICE_ROLE_KEY` for the route cache). For a
brand-new database:

```bash
npm run payload -- migrate                 # create Payload's schema `payload`
# apply supabase/migrations/0005_trase.sql (route cache table public.trase)
npm run migrate:payload -- --dry-run       # what would be moved from the seed
npm run migrate:payload                    # move seed points + stages into Payload
```

To test the in-app walking route ("Pelji me tja") and to (re)compute stage routes, also set
`ORS_API_KEY` in `.env.local` (a free key from [openrouteservice.org](https://openrouteservice.org/dev/#/signup)).
Without it, `app/api/route/route.ts` returns 503, the UI shows the "route unavailable" state, and
the admin's »Ponovno izračunaj trase« says the key is missing.

### Data pipeline

```
admin (/admin, Payload) ──► Postgres schema `payload` ──► lib/data.ts (Next data cache, tagged)
        │                                                      │        ▲
        │ publish → revalidateTag/revalidatePath               ▼        │ no .env / paused DB at build
        └──────────────────────────────────────────► static pages    tocke.seed.json + etape.seed.json
                                                                                  ▲
                                       npm run export:seed (commit the result) ───┘
```

- **The admin is the source of truth.** Public pages are static and read the database only
  through Next's cache; a publish in the admin re-renders the affected pages. A paused free
  Supabase project therefore never takes the public site (or a QR plaque) down.
- **`tocke.seed.json` / `etape.seed.json` are generated, never hand-edited.** `npm run
  export:seed` regenerates them from the database (published points only); `-- --check`
  prints the diff without writing. Commit the result after a round of edits — the no-`.env`
  fallback and the QR redirects (`proxy.ts`) read the seed.
- **The Excel is finished as a source.** `npm run import:xlsx` (and `apply:koordinate`) only
  print what they would change and never write.
- Adding a new field: the Payload collection (`cms/collections/`, then
  `npm run payload -- migrate:create`), `lib/types.ts` and `lib/cmsMapiranje.ts` together.
- **Stages (etape) are data since Phase 4.** Payload collection `etape`, or `etape.seed.json`
  (`ETAPE_SEED` in `lib/etape.ts`) when there is no `.env`; read them through `lib/data.ts` `getEtape()`.
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

- **Building blocks:** each stage's route through its published on-trail points in `zaporedje`
  order (extended-branch "Razširjeni … krak" points stay markers, not stops on the line), and a
  connector from each stage's last point to the next stage's first point around the loop — the
  last stage closes back to the first. The map draws one closed ring composed from these on
  read (`lib/trase.ts` `sestaviObroc`): stage n's section runs up to stage n+1's first point, so
  consecutive stages always meet and any run of consecutive selected stages is one line.
  Non-consecutive selected stages are not joined. A full recompute is 7 stage + 8 connector
  requests (stage 7 has a single point on its line).
- **Staleness is derived, not stored:** each cached row carries a key hashing profile, stage IDs
  and the ordered `(id, lat, lon)` waypoints. Moving, reordering, reassigning or (un)publishing
  a point changes the key; a row whose key no longer matches is never served.
- **Honest fallback:** a part without a current routed row is drawn from the schematic file
  below (or a straight connector) and marked `"shematsko"`. Failures are cached with a reason; a
  missing key or an ORS rate limit stops the batch and writes nothing.
- **Storage, in read precedence:** Supabase `trase` when configured; otherwise the committed
  route files in `data/trase/` (one JSON file per stage / connector, each carrying its cache
  key, so a stale file is detected and not served); otherwise the schematic fallback.
- **The public site never calls the routing service for trails.** Routes are computed once —
  by `npm run trase` or, later, from the admin after an edit — and only read afterwards.

```bash
npm run trase                               # state of every route + named conditions, no ORS calls
npm run trase -- --preracunaj --zapisi-v-repo   # compute into data/trase/ (no Supabase needed)
npm run trase -- --preracunaj               # compute into Supabase (requires Supabase)
npm run trase -- --preracunaj --vse         # recompute everything
npm run trase -- --etapa=etapa-6            # one stage (+ connectors touching it)
npm run trase:preizkus                      # self-check of the acceptance criteria (3 requests)
```

Both scripts read `.env.local`. Quality warnings (leg > 2,5× the straight line, leg > 3 km,
point > 100 m from the nearest mapped path) are shown for stage routes and connectors between
consecutive stages.

#### Routed trails in production — what must be set

Two named conditions are reported on server start (`instrumentation.ts`, look for `[trase]` in
the logs) and by `npm run trase`:

| Condition | Meaning | What the site does |
|---|---|---|
| `NI_TRAJNE_SHRAMBE` | No Supabase **and** no files in `data/trase/` | Every stage is drawn schematically (dashed straight lines, "Trase ni bilo mogoče izračunati po poteh"). |
| `NI_ORS_KLJUCA` | `ORS_API_KEY` is not set | Stored routes are still shown. Nothing new can be routed; a route made stale by an edit falls back to the schematic line until it is recomputed. |

For routed trails on the deployed site **without a database**, nothing has to be set in
production. On a machine with `ORS_API_KEY` in `.env.local`:

```bash
npm run trase -- --preracunaj --zapisi-v-repo   # 15 ORS requests for the full ring
git add data/trase && git commit -m "Trase: preračun"
```

and deploy. With Supabase configured, Supabase takes precedence and must hold the routes
(`npm run trase -- --preracunaj`); `ORS_API_KEY` is then needed server-side only for
recomputing from the admin. `.cache/` is no longer used: a deployment's file system is rebuilt
on every deploy, so a runtime file cache is always empty there.

### Trails (poti)

`data/poti/*.geojson` — one file per trail, loaded generically by `lib/data.ts` `getPoti()`.
**Dropping in a real GPX-derived GeoJSON file needs zero code changes**, as long as its
Feature `properties` carry: `slug`, `naziv`, `vrsta` (`"etapa"` | `"zica"`), `etapa` (number or
`null`), `odsek` (string or `null`), `barva` (hex colour — only for non-stage trails such as
the 1943 wire; a stage trail's colour, name and section always come from its `etape` row), `status` (`"shematsko"` | the 1943
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
npm run export:seed      # regenerate tocke.seed.json + etape.seed.json from the database
npm run import:xlsx      # compare the client's Excel with the seed (diff only, never writes)
npm run generate:poti    # regenerate the schematic stage GeoJSON files
npm run trase            # state of the routed stage trails (-- --preracunaj to recompute)
npm run migrate:payload  # one-time: move the seed into an empty Payload database (-- --dry-run first)
```
