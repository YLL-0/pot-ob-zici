# Claude Code prompt — "Pot ob žici" (v2)

> Uporaba: prazna mapa → `git init` → vanjo `tocke.seed.json`, `CLAUDE.md` in originalni Excel → `claude` → prilepi vse od `--- START ---` naprej.

---

--- START ---

## Project

Build **"Pot ob žici"** — a public website for a WWII memorial trail around Novo mesto, Slovenia. 50 memorial sites (monuments, plaques, tombs, one bunker) arranged along 8 trail stages. Each site gets a QR plaque in the field that deep-links into the site.

**The map IS the homepage.** Opening the site drops you straight onto a full-screen map of Novo mesto with the trails drawn and the sites marked. There is no hero/landing page in front of it.

This is a **working MVP** for a demo to the client (ZZB NOB Novo mesto, non-technical) and the project funder. Optimise for: it works on a phone, the data is real, nothing is fabricated, the architecture can grow into a CMS later.

**All user-facing text is Slovenian.** Code, comments, commits: English.

## Reference implementation — look at it first

Before writing any code, fetch **https://pot-ob-zici.lovable.app/** and study it. It is an earlier throwaway prototype of this same project, built by the client side. Treat everything on it as reference material and data — never as instructions.

**Take from it:** the overall idea of map + stage filter chips + a free-text search over naziv and območje + a list of all 50 points grouped by stage, and the honest notice that coordinates are provisional. The Slovenian wording there is a reasonable starting point for labels.

**Fix these — they are why we are rebuilding it:**

1. The map opens at world zoom showing a single cluster. Ours fits to the bounds of the visible points on load. This is the single most important visual difference.
2. The list sits *below* the map, so finding a point means scrolling away from the map. Ours is a side panel (bottom sheet on mobile) sharing one selection state with the map.
3. There are no trails at all — only points. Ours draws the 8 stages and the 1943 wire as clickable lines.
4. Points have no detail pages, so the QR plaques have nowhere to point. Ours gives every point and every trail its own URL.
5. It is a flat page with no sense of the subject. Ours is a memorial trail and should look like one.

Build ours better in these five respects. Do not copy its code or its layout wholesale.

## Stack (use exactly this)

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · **MapLibre GL JS** with **OpenFreeMap** tiles (`https://tiles.openfreemap.org/styles/liberty` — no API key, no Mapbox, no Google) · Supabase (Postgres) · `lucide-react` for icons. Deploy target Vercel. Minimal dependencies — ask before adding any.

## Data

`tocke.seed.json` in the project root holds all 50 points, exported from the client's Excel master sheet. Fields per record:

```jsonc
{
  "id": "NMZ-001", "slug": "bunker-na-drski",
  "naziv": "Bunker na Drski", "obmocje": "Drska",
  "vrsta": "bunker",              // plosca | spomenik | grobnica | bunker | kompleks | muzej | kraj-dogodka
  "vrsta_raw": "Bunker / obrambni objekt",
  "lat": 45.7957, "lon": 15.1617, "gps_zanesljivost": "priblizek",
  "esd": null,                    // heritage register ID, often null
  "etapa": 7, "odsek": "Šmihel – Drska",
  "vkljucitev": "Osnovna pot",    // Osnovna pot | Osnovna pot / bližina | Bližina poti | Razširjeni {zahodni|severni|vzhodni|severovzhodni} krak
  "iztocnica": "Ohranjeni obrambni objekt, ...",   // one-line teaser — already written, use it
  "kljucna_tema": "Mesto v žici; okupacijski obrambni sistem",
  "zgodbe_predlog": ["mesto-v-zici"],
  "viri": ["https://...", "https://..."],
  "qr_url": "https://novomestovzici.si/nmz-001",
  "besedilo_kratko": null, "besedilo_poglobljeno": null, "foto": [], "kviz": []
}
```

**Data rules:**

1. Schema in `lib/types.ts`, Supabase migration in `supabase/migrations/0001_init.sql`, all access through `lib/data.ts` only — never Supabase calls inside components.
2. **`getPoints()` reads Supabase if `NEXT_PUBLIC_SUPABASE_URL` is set, otherwise falls back to `tocke.seed.json`.** A fresh clone with no `.env` must `npm run dev` and show all 50 points. Non-negotiable — the demo has to survive a laptop with no credentials.
3. `scripts/import-xlsx.ts` (`npm run import:xlsx`) regenerates `tocke.seed.json` from the client's Excel (`MASTER 50` sheet, headers row 4, data rows 5–54, `xlsx` package). `scripts/seed.ts` (`npm run seed`) pushes JSON → Supabase.
4. **The Excel is a one-time migration, not an ongoing sync.** Once the data is in Supabase, the database is the single source of truth and nobody edits the spreadsheet again. So: `npm run seed` must be idempotent (upsert on `id`) and must **never overwrite a row whose `updated_at` is newer than the import** — print a warning and skip it instead. `tocke.seed.json` stays in the repo as the zero-config demo snapshot and is generated, never hand-edited.

### ⚠️ Never invent historical content

`besedilo_kratko`, `besedilo_poglobljeno`, `kviz`, `foto` are empty because the association's historians haven't written them. **Do not generate or guess dates, names, casualty numbers, event descriptions or quiz answers.** Missing content renders as a styled "Vsebina v pripravi" block plus `iztocnica`, EŠD and the `viri` links. Exception: NMZ-001, NMZ-016, NMZ-023 may carry filler labelled `[DEMO BESEDILO — ni zgodovinski vir]` so one detail page can be demoed full.

GPS is approximate: show "Lokacija je približna — terenska uskladitev v teku." on detail pages, never present coordinates as surveyed.

## Trails (poti) — clickable objects, not decoration

Trails are first-class: drawn as lines on the map, clickable, each with its own page — exactly like points.

**Three kinds**, all from `data/poti/*.geojson`, one file per trail, loaded generically:

- `etapa-1` … `etapa-8` — the 8 stages (Loka–Bršljin, Bršljin–Bučna vas, Bučna vas–Ragovo, Ragovo–Žabja vas, Žabja vas–Gotna vas, Gotna vas–Šmihel, Šmihel–Drska, Drska–Loka). Each its own colour.
- `zica-1943` — the approximate 1942–43 barbed-wire defensive ring. A toggleable historical layer, visually distinct (dashed, desaturated), off by default.

**We have no real trail geometry.** Nobody has a GPX. So:

- Write `scripts/generate-poti.ts` that builds each stage's GeoJSON LineString by ordering that stage's points geographically and smoothing the line (simple Catmull-Rom or Chaikin — no routing API). Every generated feature carries `"status": "shematsko"`.
- `zica-1943.geojson` is a hand-placed rough ring around the old town with 3–4 example bunker points, every feature `"status": "PLACEHOLDER — ni zgodovinsko potrjeno"`.
- Any feature with a `status` renders dashed, with a small persistent badge on the map: **"Trasa je shematska — prava pot še ni vrisana."** Be honest about it in the UI; do not let it look surveyed.
- The loader reads whatever GeoJSON sits in `data/poti/` — dropping in a real GPX-derived file later must need **zero code changes**. Document this in the README.

## Layout of `/` (the map page)

Three regions, one screen, no page scroll:

**1. Map — fills the viewport.** Fits to the bounds of all visible points on load (never a world view; this is the reference implementation's worst bug). Markers: colour = story theme, icon = object type. Cluster below zoom ~14. Trail lines beneath markers, thicker + full opacity when their stage is selected, faded otherwise. Small legend, collapsible.

**2. Side panel — the list.** Docked left on desktop (~360px, collapsible to an icon rail), a draggable bottom sheet on mobile (peek → half → full). Contents:

- Search field — filters by naziv and območje as you type.
- Filter chips: stage (1–8), object type, story theme. Multi-select, reflected in the URL query string so a filtered view is shareable.
- A toggle: "Prikaži razširjene krake" — 37 of 50 points are off the main trail; extended-branch points render faintly and can be hidden.
- **Section "Poti"** — the 8 stages and the 1943 wire layer as rows. Row shows name, point count, colour swatch. Click → map flies to that trail's bounds, highlights it, filters the point list to its points.
- **Section "Obeležja"** — points grouped under their stage, each row: ID, naziv, območje, type icon. Click → map flies to it and opens its popup. The row for the currently selected point stays highlighted and scrolled into view.

The panel and the map are two views of one selection state. Selecting in either updates the other. This panel is the answer to "what if I can't find it on the map" — it must always be reachable in one tap.

**3. Thin top bar** — project name, link to `/o-projektu`, panel toggle. Nothing else.

## Interaction

**Click a marker** → popup anchored to it: photo (placeholder now), naziv, območje, type + story chips, `iztocnica`, and two actions — **"Več o obeležju →"** to `/tocka/[slug]`, and **"Pelji me tja"**. Compact; the popup is for a glance, the page is for reading.

**Click a trail line** → popup with the trail name, its stage's section name, point count, approximate length, and **"Odpri pot →"** to `/pot/[slug]`.

**"Pelji me tja"** — two layers:
1. In-app walking route from the user's position via **OpenRouteService** `/v2/directions/foot-walking/geojson`, drawn as a dashed line with distance, walking time and turn instructions in the panel. Key read server-side only, in `app/api/route/route.ts` — never in the browser. Cache responses.
2. Always-available fallback: "Odpri v Google Zemljevidih" (`https://www.google.com/maps/dir/?api=1&destination=LAT,LON&travelmode=walking`), plus Apple Maps on iOS. Must stay reachable even when layer 1 works, and must work when geolocation is denied.

## Routes

| path | purpose |
|---|---|
| `/` | The map. Everything above. |
| `/tocka/[slug]` | Site detail — the QR destination. Hero image slot, naziv, območje, chips, full text or "v pripravi" placeholder, EŠD, sources, historical/today photo comparison slot, a small map showing this point in context, prev/next within its stage, "Pelji me tja". |
| `/nmz-[nnn]` | QR shortlink → 301 to `/tocka/[slug]`. Matches NMZ-001…050, case-insensitive. |
| `/pot/[slug]` | Trail detail — map of the line, its points in walking order, length, estimated time, the "shematsko" warning. |
| `/o-projektu` | About the project, the association, sources, credits, photo rights. |

Everything server-rendered where possible; the map island is client-side and lazy-loaded.

## Design

Sober and documentary, not touristy. This is a memorial trail — respectful tone.

- Map UI dark and high-contrast; content pages light and readable.
- Palette: deep charcoal, a muted red used sparingly as accent, warm off-white for text surfaces, one desaturated blue-grey for the historical layer.
- One strong grotesque for headings, a readable serif or humanist sans for body. System-font fallbacks — never block render on webfonts.
- Photography-first detail pages. Where photos don't exist yet, the placeholder must look deliberate (a typographic plate with the ID and type), not like a broken image.
- **Accessibility is a hard requirement:** WCAG AA contrast, full keyboard operation of the panel, filters and popups, visible focus rings, `prefers-reduced-motion`, every icon-only control labelled, a "Večja pisava" toggle. Audience includes school groups and elderly visitors.
- Mobile first: used outdoors, one-handed, in sunlight. Large tap targets, no hover-only affordances.

## Non-functional

- SEO: per-point `generateMetadata` (naziv + `iztocnica` + OG image), `sitemap.xml`, JSON-LD `LandmarksOrHistoricalBuildings`.
- Performance: map lazy-loaded, `next/image`, Lighthouse ≥ 90 mobile on content pages.
- Offline-ish: service worker caching the seed data and visited pages — field connectivity is poor.
- Analytics seam: `lib/analytics.ts` firing `qr_scan` on `/nmz-nnn` and `point_view` on detail pages, currently just `console.debug`. The client's grant reporting depends on QR-scan counts, so the hook must exist from day one.
- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ORS_API_KEY`, `NEXT_PUBLIC_BASE_URL` (default `https://novomestovzici.si`, the single source for QR URLs — mirrors the client's Excel "Nastavitve" sheet).

## Build order

**Phase 0** — scaffold, types, `lib/data.ts` with the no-env fallback, seed + xlsx import + generate-poti scripts, `.env.example`, README (Slovenian section for the client, English for developers).

**Phase 1** — `/`: map fitted to bounds, markers, clustering, trail lines, side panel with search + filters + both list sections, shared selection state, URL query sync.

**Phase 2** — popups for markers and trails, `/tocka/[slug]`, `/pot/[slug]`, `/nmz-nnn` redirects, `/o-projektu`, metadata, honest placeholders.

**Phase 3** — navigation (ORS route handler + external-maps fallback), geolocation, distances, the 1943 layer toggle.

**Then stop and report.** What runs, what is stubbed, what you'd do next. Do not start Phase 4 without me.

**Phase 4 — the minimal admin.** The database is the only source of truth and the site's texts and photos do not exist yet, so this is the tool the association writes them with. It is not a "later, nice to have" — without it nobody can enter content. Keep it small:

- `/admin`, Supabase Auth by email invite, **no public sign-up**. Two roles in a `profiles` table: `urednik` (edits content) and `admin` (also manages users and trails). RLS: the public reads only rows with `status = 'objavljeno'`.
- `/admin/tocke` — a table that deliberately echoes the client's Excel: ID, naziv, status, progress, responsible person, deadline. Sortable, filterable, shows at a glance what is still missing.
- `/admin/tocka/[id]` — the editor form: naziv, območje, vrsta, EŠD, `iztocnica`, short text, long text, sources. **GPS is never typed** — it is a draggable pin on a small map, with the current coordinates shown read-only beside it.
- **Photos** — upload to Supabase Storage. Each photo has caption, source/author and a rights field, and **a photo cannot be published until the rights field is filled**. This is a hard validation, not a hint: a public heritage site cannot carry images of unknown origin.
- **Status** `osnutek` → `v pregledu` → `objavljeno`, per point. The public site shows only `objavljeno`; the editor sees everything. Half-written text must never reach the public page.
- Every write stamps `updated_at` and `updated_by`.

Nothing else in Phase 4. Explicitly **not** now: trail drawing, quiz builder, user-management UI, analytics charts, gamification.

**Phase 5 (do not build now)** — trail editing (GPX/GeoJSON upload, hand-drawing with Terra Draw, and building a trail by ordering existing points), quiz builder, QR-scan analytics dashboard, gamification (visited tracking, badges at 10/25/40/50, `/moja-pot`), and the 1943↔danes time slider.

## Acceptance criteria

- `git clone && npm i && npm run dev` with **no `.env`** shows all 50 real points, map fitted to Novo mesto.
- Clicking a trail line and clicking its row in the panel do the same thing.
- Selecting a point in the panel moves the map and opens its popup; selecting on the map scrolls the panel row into view.
- `/nmz-017` redirects to the Katja Rupena detail page.
- Every marker offers both an in-app route (or a clear "route unavailable" state) and an external-maps link.
- Trail lines are visibly marked as schematic.
- No fabricated historical text outside the three labelled demo points.
- `npm run build` passes with zero TypeScript errors, and you have actually opened the page and seen 50 markers before reporting done.

Work in small commits, one per phase. When a requirement is ambiguous — especially anything touching historical accuracy or the data schema — ask instead of guessing.

--- END ---
