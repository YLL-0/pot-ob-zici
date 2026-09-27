# Changelog

## Faza 3 — navigacija (ORS + geolokacija), pravo stikalo za žico

- `app/api/route/route.ts`: strežniški ovoj za OpenRouteService foot-walking/geojson. Ključ
  (`ORS_API_KEY`) samo strežniško. Predpomnjenje v pomnilniku (~11 m natančnost, 1h) + HTTP
  Cache-Control. Brez ključa vrne 503 z jasnim sporočilom — privzeto stanje te demo aplikacije.
- `lib/routing.ts`: deljena logika geolokacije + klica API-ja, z jasnimi napakami
  (zavrnjeno dovoljenje, brskalnik ne podpira, ni ključa, napaka pri izračunu).
- "Pelji me tja" v pojavnem oknu na zemljevidu nariše črtkano traso in prikaže
  razdaljo/čas/navodila po korakih v novi sekciji "Navigacija" v panelu, s preklicem. Zunanja
  povezava (Google/Apple Zemljevidi) ostane vedno vidna zraven.
- `components/PeljiMeTjaZemljevid.tsx`: isti tok na `/tocka/[slug]`, rezultat v kompaktni
  kartici ob kontekstnem zemljevidu (ki zdaj zna narisati tudi traso).
- Obroč žice 1942–43 dobi pravo stikalo "Prikaži obrambni obroč 1942–43" (`?zica=1`, privzeto
  izklopljeno) — nadomesti Faza-1 začasno rešitev (klik na vrstico).

Preverjeno v headless Chromiumu z mock geolokacijo: stikalo za žico, celoten tok "Pelji me tja"
(geolokacija → klic API-ja → graceful "ni na voljo" sporočilo, ker v tem okolju ni ORS_API_KEY)
na obeh mestih, `/api/route` neposredno vrne 503 z jasnim sporočilom. Uspešna pot skozi pravi
ORS API ni preverjena v živo (ni ključa v tem okolju) — koda sledi dokumentiranemu ORS
kontraktu; ko naročnik priskrbi ključ, velja preveriti uspešen primer.

## Faza 2 — pojavna okna, strani obeležij/poti, /nmz-nnn, SEO

- Pojavna okna na klik (marker ali trasa, na zemljevidu ali v panelu — isto deljeno stanje iz
  Faze 1): obeležje dobi foto-placeholder, naziv, območje, čipe, iztočnico in gumba "Več o
  obeležju →" / "Pelji me tja"; trasa dobi naziv, odsek, št. točk, dolžino in "Odpri pot →".
- `/tocka/[slug]`: polna stran obeležja — naslovna slika, čipi, polno besedilo ali "Vsebina v
  pripravi" + iztočnica, EŠD, viri, primerjava danes/nekoč (placeholder), kontekstni
  mini-zemljevid, prev/next znotraj etape, "Pelji me tja". `generateMetadata`,
  `opengraph-image.tsx` (next/og), JSON-LD `LandmarksOrHistoricalBuildings`.
- `/pot/[slug]`: mini-zemljevid s številčenimi točkami v vrstnem redu hoje, dolžina, ocenjen čas
  hoje, opozorilo o shematski trasi, seznam obeležij, povezave na druge poti.
- `/o-projektu`: o projektu, društvu, stanju vsebin, GPS/trasah, fotografijah, virih.
- `/nmz-001` … `/nmz-050` (case-insensitive) → 301 na `/tocka/[slug]` prek `middleware.ts`.
- `app/sitemap.ts`.
- NMZ-001, NMZ-016, NMZ-023 zdaj nosijo dovoljeno demo besedilo (CLAUDE.md izjema), jasno
  označeno `[DEMO BESEDILO — ni zgodovinski vir]` in namerno napisano tako, da opisuje samo
  postavitev strani — brez izmišljenih datumov, imen ali številk.

Dva popravka med gradnjo: `next/dynamic(ssr:false)` ni dovoljen neposredno v server komponenti,
zato `components/LazyMiniMap.tsx` kot tanek client ovoj — brez njega bi maplibre-gl pristal v
prvem JS payloadu vsebinskih strani (390 kB namesto 110 kB). Matcher `"/nmz-:id"` v middleware
tiho ni ujel nobene poti (path-to-regexp ne poveže parametra brez ločila za literalom) —
popravljeno na širši matcher z notranjim regexom.

Verificirano v headless Chromiumu: obe pojavni okni, obe detajlni strani, redirect (301,
case-insensitive) in 404 za neznan ID, sitemap.xml, opengraph-image — brez konzolnih napak.

## Faza 1 — zemljevid, gručenje, trase, stranski panel

- `components/MapView.tsx`: MapLibre GL + OpenFreeMap `liberty`, lazy-loaded client island.
  Točke v gručenem GeoJSON viru, krogci barvani po etapi, ikona po vrsti (`lib/vrsta.ts`,
  rasterizirana prek `<canvas>` — `map.loadImage()` ne zna dekodirati SVG data-URI-jev
  zanesljivo). Trase iz `data/poti/*.geojson`, črtkane po `status`, `zica-1943` privzeto skrita.
- Prileganje ob nalaganju: 35 točk brez razširjenih krakov (Novo mesto), gumb "prikaži vseh 50"
  za preostalih 15.
- Deljena izbira med zemljevidom in panelom prek URL poizvedbe (`lib/filters.ts`,
  `hooks/useFilterState.ts`): klik na točko/traso kjerkoli vodi v isto stanje, izbrana točka
  dobi obroč + fly-to, izbrana trasa se odebeli/ostane polno vidna medtem ko druge zbledijo,
  panel vrstica se samodejno prikaže v pogledu.
- `components/SidePanel.tsx`: iskanje, filtrirni čipi (etapa/vrsta/tema), preklop "Samo osnovna
  trasa (13)", sekciji "Poti" in "Obeležja". En `PanelBody`, dva CSS-preklopljena ovoja
  (docked panel na desktopu, bottom sheet na mobilnem) — namerno brez JS-pogojenega mountanja,
  da se izogne hidracijskemu neujemanju.
- `components/TopBar.tsx`, `components/Legend.tsx`, "Večja pisava" preklop.
- `scripts/copy-maplibre-worker.mjs` (predev/prebuild): popravek za znano napako
  "Worker failed to load" pri maplibre-gl v webpack/Next.js okolju.
- `app/page.tsx`: `export const dynamic = "force-dynamic"`, da Faza-4 objave niso ujete v
  statični build.

Znane poenostavitve: desktopski panel se ob strnitvi skrči na 0 (ne na ikonsko letev); mobilni
bottom sheet cikla peek/half/full s klikom na ročico (brez pravega povleci-in-spusti); klik na
vrstico "žica" jo začasno pokaže na zemljevidu (pravi vklop/izklop je Faza 3); izbira točke, ki
jo aktivni filtri sicer skrijejo, lahko pusti obroč brez markerja (robni primer).

Verificirano v headless Chromium (Playwright): vseh 50 markerjev, gručenje, vseh 9 trajektorij,
sinhronizacija zemljevid↔panel↔URL, mobilni pogled — brez konzolnih napak.

## Faza 0 — ogrodje (scaffold)

- Next.js 15 + TypeScript + Tailwind v4 project scaffold.
- `lib/types.ts`: `Tocka`/`Pot` schema, extended with 10 tracking fields from the client's
  Excel (EŠD status, photo-rights status, QR rollout, expert review, responsible person,
  deadline, progress, notes) and a `status` publish gate for the future admin (Phase 4).
- `lib/data.ts`: `getPoints()`/`getPoti()` with Supabase-or-seed-JSON fallback — works with no
  `.env`. `lib/qr.ts`, `lib/slug.ts`, `lib/analytics.ts`, `lib/progress.ts`, `lib/etape.ts`,
  `lib/supabase.ts`.
- `scripts/import-xlsx.ts`: regenerates `tocke.seed.json` from the client's Excel, with a
  `--check` diff mode, curated mapping tables (`vrsta_raw`→`vrsta`, `kljucna_tema`→
  `zgodbe_predlog`), slug preservation for existing IDs, and a loud warning if real content
  ever appears in a workflow-status Excel column instead of being entered via the admin.
- `scripts/generate-poti.ts`: builds the 8 schematic stage trail lines from a closed loop of
  9 hand-placed anchor waypoints, Chaikin-smoothed.
- `data/poti/zica-1943.geojson`: hand-authored placeholder ring for the 1942–43 wire layer.
- `supabase/migrations/0001_init.sql`: `tocke`, `poti`, `profiles` tables with RLS (public
  reads only `status = 'objavljeno'` on `tocke`).
- `app/page.tsx`: temporary data-pipeline check page (not the Phase 1 map) — confirms all 50
  points and 9 trails load with no `.env`.
- `.env.example`, README (Slovenian client section + English developer section).

Verified: `npm run dev` with no `.env` shows all 50 points and 9 trails; `npm run build` and
`npm run typecheck` pass with zero errors; `npm run lint` is clean;
`npm run import:xlsx:check` reports no diff against the committed seed.
