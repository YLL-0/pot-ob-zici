# Changelog

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
