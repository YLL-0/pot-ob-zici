# Faza 4 — admin, urejanje etap in izris pravih tras

> Prilepi v Claude Code v mapi projekta, po tem ko je Faza 3 commitana.

---

--- START ---

## Where this comes from

The client has specified Phase 4. Their words, translated:

> Each memorial needs an admin that allows: (1) entering GPS coordinates so it is located exactly, (2) editing each memorial — adding images and text.
>
> The map is divided into 8 stages. It must allow stages to be defined differently. In each memorial's admin you set which stage it belongs to, then the application itself draws the route between all memorials of that stage; if you select two or more stages, it draws the route across them. **The route must be drawn so that the map follows the actual paths and roads leading to each memorial.**

That last sentence changes the architecture, so read this whole brief before planning.

## What this replaces

`scripts/generate-poti.ts` currently produces smoothed straight-line stage trails marked `"status": "shematsko"`, because nobody had a GPX of the real trail. The client's requirement supersedes that: routes are now **computed by a routing engine along real roads and footpaths**, from the stage's points, on demand, and cached.

Keep `generate-poti.ts` and the committed `data/poti/*.geojson` as the **offline fallback** — they are what the app shows when routing is unavailable (no API key, engine down, a point unreachable on foot). Do not delete them.

## Part 1 — stages become data

Today a stage is a hardcoded number 1–8 (`lib/etape.ts`). The client wants to define stages differently, so stages become editable records.

- New table `etape`: `id`, `stevilka` (display order), `naziv`, `odsek`, `barva`, `opis`, `vidna` (bool), `updated_at`, `updated_by`.
- Seed it from the current eight so nothing visibly changes on first run.
- `tocke.etapa` becomes a foreign key to `etape.id`. **Migrate the existing integer values** — do not break the 50 committed points, `tocke.seed.json`, or the Excel importer (`import-xlsx.ts` maps stage numbers; keep it working by resolving the number to an `etape` row).
- `tocke` gains `zaporedje` (integer, order of the point within its stage). Default it from the current geographic ordering that `generate-poti.ts` computes, so the first routed result is sensible rather than random.
- A point with no stage is valid: it shows on the map but belongs to no route.
- `lib/etape.ts` stops being a constant table and becomes a data accessor through `lib/data.ts`, with the same no-`.env` seed fallback as points.

## Part 2 — routed trails

**Engine:** OpenRouteService `foot-walking`, through the existing server-side wrapper pattern in `app/api/route/route.ts`. Never call it from the browser; the key stays server-side.

**How a stage route is built:**

1. Take the stage's points, ordered by `zaporedje`.
2. Send their coordinates as a single `/v2/directions/foot-walking/geojson` request (ORS accepts a waypoint list; a stage has 2–12 points, well within limits).
3. Store the returned LineString, total distance and duration.

**Caching is mandatory, not an optimisation.** The free ORS tier is rate-limited, and a public map must never call it per page view.

- New table `trase`: `id`, `kljuc` (cache key), `etapa_ids` (array), `geometry` (jsonb), `dolzina_m`, `trajanje_s`, `engine`, `izracunano_ob`, `status`.
- The cache key is a hash of the ordered list of `(point id, lat, lon)` plus the stage ids and the routing profile. Any change to a point's coordinates, its stage, or its order changes the key, so a stale route can never be served silently.
- The public map reads `trase` only. It never triggers a routing call itself.
- Recomputation happens in the admin: automatically after a save that changes coordinates, stage or order (enqueue, don't block the save), and manually via a **"Ponovno izračunaj trase"** button that shows which stages are stale.

**Multiple stages:** selecting two or more stages produces one route across them, stages concatenated in their `stevilka` order, points within each stage in `zaporedje` order. Same cache table, key includes the stage id list. Compute on demand and cache; do not precompute all 255 combinations.

**Honest failure.** Routing fails in real life: a point far from any mapped path, an engine timeout, a missing key. When it does:

- Fall back to the committed schematic line for that stage, rendered dashed, with the message **"Trase ni bilo mogoče izračunati po poteh — prikazana je shematska povezava."**
- Never silently show a straight line as if it were a route.
- In the admin, show per-stage routing status (izračunano / zastarelo / ni uspelo) with the reason.

**Wording change on the public map.** The current badge says the trail is schematic. A routed trail is real road geometry but still a generated suggestion, not the association's official marked trail — so it reads: **"Trasa je izračunana po dejanskih poteh. Ni uradno označena pot."** Keep the stronger schematic warning for the fallback case and for `zica-1943`.

**Quality caveat to surface, not hide:** some of the 50 points sit on rural roads with no footpath mapping (Kuzarjev Kal, Trška Gora, Zagrad). Foot routing there may follow a road without a pavement. Add a per-stage note in the admin when a computed leg exceeds a reasonable straight-line ratio (say 2.5×) or when a leg is longer than 3 km, so the editor can check it rather than discovering it in the field.

## Part 3 — the admin

`/admin`, Supabase Auth by **email invite only, no public sign-up**. Roles `urednik` and `admin` in `profiles`. RLS already restricts public reads to `status = 'objavljeno'` — extend it to `etape` and `trase`.

**`/admin/tocke`** — a table that deliberately echoes the client's Excel: ID, naziv, etapa, status, napredek, odgovorna oseba, rok. Sortable and filterable. At a glance it must answer "what is still missing".

**`/admin/tocka/[id]`** — the editor:

- Naziv, območje, vrsta, EŠD, iztočnica, kratko besedilo, poglobljeno besedilo, viri.
- **GPS: a draggable pin on a map**, with the coordinates shown read-only beside it, plus an optional paste field that accepts `45.7957, 15.1617` for someone arriving with a reading from the field. The editor never types into two separate number boxes.
- **Etapa**: a select over the `etape` records, plus the point's `zaporedje` within it.
- **Photos**: upload to Supabase Storage. Each photo carries podnapis, avtor/vir and pravice. **A photo cannot be published until the rights field is filled** — a hard validation, not a hint. Reorder by dragging; the first is the lead image.
- **Status**: `osnutek` → `v pregledu` → `objavljeno`. The public site shows only `objavljeno`.
- Saving writes `updated_at` and `updated_by`, and flags affected stage routes as stale.

**`/admin/etape`** — list, create, rename, recolour, reorder, hide. Each row shows its point count and routing status. Deleting a stage that still has points is refused, with a list of them.

**`/admin/etapa/[id]`** — the stage's points in order, reorderable by dragging, with the computed route drawn beside the list so the editor sees immediately what the order produces. "Ponovno izračunaj" per stage.

Nothing else in Phase 4. Explicitly **not** now: quiz builder, QR-scan analytics dashboard, gamification, the 1943 time slider, trail hand-drawing, GPX upload.

## Build order

1. **Schema and migration** — `etape`, `trase`, `tocke.zaporedje`, the foreign key, RLS. Keep `import-xlsx.ts`, `tocke.seed.json` and the no-`.env` fallback working. Report before continuing.
2. **Routing service** — the server-side route builder, the cache table, the fallback, the staleness logic. Testable from a script before any UI exists.
3. **Public map** — read routed geometry, multi-stage selection, the reworded badge, the fallback state.
4. **Admin** — auth, the points table, the point editor, photos.
5. **Admin** — stage management and ordering with the live route preview.

Commit per step. Stop and report after each.

## Acceptance criteria

- `npm run dev` with **no `.env`** still shows all 50 points and falls back to the committed schematic trails, with the fallback message visible. The app must never require a routing key to run.
- With an ORS key configured, selecting one stage draws a route that follows streets and paths, not straight lines between markers.
- Selecting three stages draws one continuous route across them, in stage order.
- Moving a point's pin in the admin marks its stage route stale; recomputing produces different geometry.
- A routing failure shows the schematic fallback **and says so** — never a silent straight line.
- Changing a point's order in the admin changes the route.
- An editor can add a stage, assign points to it and get a route, without a developer.
- A photo without the rights field cannot be published.
- `npm run build` and `npm run typecheck` pass. You have opened the admin and the map and seen both work before reporting done.

## Before you start

Report back on these, do not guess:

1. How many ORS requests a full recompute of all 8 stages costs, and whether that fits the free tier's limits.
2. Whether any of the 50 points is unroutable on foot with the current data, and which.
3. Whether `zaporedje` defaulted from the existing geographic ordering produces sane routes, or whether some stages need manual ordering before they look right.

--- END ---
