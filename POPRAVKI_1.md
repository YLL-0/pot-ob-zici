# Popravki po pregledu naročnika — videz, etape, taksonomije, prave trase

> Ta dokument ima prednost pred `PROMPT.md`, `PROMPT_FAZA4.md` in `PROMPT_FAZA4_3_ZEMLJEVID.md` povsod, kjer se razhajajo.

---

--- START ---

The client has reviewed the live map and rejected four things. Fix them in the order below. Do not start until you have reported your plan.

Reference for look and for the stage list: **https://pot-ob-zici.lovable.app/** — fetch it.

## 1 — Taxonomies: use the client's lists, nothing invented

Two taxonomies in the code were extended or altered beyond what the client specified. That was wrong and must be reverted to their exact lists.

**Zgodbe — exactly these ten, no additions, no substitutions:**

Mesto v žici · Odpor · Žrtve · Talci · Železničarji · Partizanske enote · Otroci in mladi · Ženske v odporu · Bombardiranje · **Osvoboditev**

`kultura-spominjanja` was invented during the data import and must be removed. `osvoboditev` must exist as a theme even though no point currently maps to it — an empty filter chip is the honest state and tells the client a point is missing; silently replacing the theme is not.

Points currently tagged `kultura-spominjanja` must be re-tagged from the remaining nine themes, or left with no theme if none fits. **Do not guess a theme to avoid an empty field.** List every point you re-tag and what you chose, and report any point you left untagged.

**Vrsta objekta — exactly these five:**

Spomenik · Spominska plošča · Grobnica · Bunker · Kraj dogodka

The code currently has seven; `kompleks` and `muzej` were added during import. Collapse them into the five. **Propose the mapping for each affected point and wait for approval before applying it** — do not decide on your own which of the five a memorial complex or a museum hall belongs to.

Both lists live in one place each (`lib/zgodbe.ts`, `lib/vrsta.ts`) and the importer's mapping tables must agree with them. After the change, `npm run import:xlsx:check` must report only the differences you intended.

**Rule from here on:** any list, category or label the client specified is fixed. If the data does not fit it, say so and ask. Never extend, rename or substitute a client-specified value.

## 2 — Visual design: lighter, warmer, closer to the reference

The current look was built to a "dark, sober, documentary" brief that the client has rejected. Replace that direction with the reference's: **a light, warm, editorial page**.

From the reference, adopt:

- warm off-white page background, not grey, not dark;
- a serif heading in a large, confident size, with a small letter-spaced eyebrow label above it ("NOVO MESTO · DOLENJSKA");
- generous white space; content in a centred column with real breathing room;
- the notice bar style used there for the coordinates caveat — a tinted panel with a left accent rule, not a warning banner;
- pill-shaped filter chips with a coloured dot, the active one filled;
- restrained accent colour, used for emphasis and nothing else.

The map keeps a light base style to match the page. Drop the dark map UI.

This applies to the whole site, not only the home page: point pages, trail pages and the about page follow the same system. Define the palette, type scale and spacing as tokens in one place, and build every component from them.

Accessibility does not relax: WCAG AA contrast on the lighter palette, visible focus rings, keyboard operation throughout, `prefers-reduced-motion`, and the "Večja pisava" toggle. Check the result at 390 px width before reporting done.

Do not copy the reference's code or markup. Match its character, build it properly.

## 3 — Stages: a visible list, and clicking one shows it

As in the reference, stages are a first-class, always-visible control — not something buried in a filter menu.

- A row of chips: **"Vse etape"** followed by **Etapa 1 … Etapa 8**, each with its stage colour as a dot. The active chip is filled with that colour.
- Below or beside them, the stage list proper: one row per stage with its number, name, section (odsek) and point count, in its colour.
- **Clicking a chip or a row draws that stage on the map**: the map flies to its bounds, its line goes to full weight, its points stay and everything else leaves. Clicking "Vse etape" restores all eight.
- Multiple stages can be active at once; consecutive ones still join into one continuous line.
- Selection stays in the URL so a view can be shared.
- One stage colour per stage, from `etape.barva`, used by the chip, the row, the line and the markers alike — no component may hold its own colour table.

The eight stages are consecutive sections of one loop: stage *n* ends where stage *n+1* begins, and with all shown the map reads as one closed ring in eight colours.

## 4 — Real routes along roads, not straight lines

The client's screenshot shows a straight dashed line across Bršljin with the message "Trase ni bilo mogoče izračunati po poteh". The fallback is behaving correctly; the problem is that the routed path is never produced in the environment the client is looking at.

Two things are missing and both must be fixed:

**a) Configuration.** Routing needs `ORS_API_KEY` server-side, and a cache that survives a deployment. The current fallback cache writes to `.cache/trase.json`, which does not persist on Vercel — the filesystem there is ephemeral and rebuilt on every deploy. So in any deployed environment the cache is always empty and every stage falls back.

Make this impossible to miss: on startup, and in `npm run trase`, detect "no key" and "no durable cache" and report them as distinct, named conditions. Write a short section in the README stating exactly what must be set for routed trails to appear in production, and what the site does when it is not.

**b) Precomputation at build or publish, not at request time.** The public site must never call the routing service itself. Routes are computed once — by `npm run trase --preracunaj`, or from the admin after an edit — and read from storage thereafter.

Since Supabase is not yet configured, add a third storage option so routed geometry can ship without a database: **committed route files** under `data/trase/`, generated by `npm run trase --preracunaj --zapisi-v-repo`. These are generated artefacts, committed deliberately, each carrying its cache key so a stale one is detectable. Storage precedence at read time: Supabase if configured, else committed files, else the schematic fallback.

This gets real routes onto the deployed site today, with no database and no key in production.

**Report before building:** how many ORS requests a full recompute costs, which points fail to route and why, and whether any stage still falls back after a full recompute.

## Order and reporting

1. Taxonomies (§1) — propose the `vrsta` mapping and the re-tagging, wait for approval, then apply.
2. Routes (§4) — get real geometry committed and visible, so the client stops seeing straight lines.
3. Stage chips and list (§3).
4. Visual redesign (§2) — last, so it is applied to the finished structure rather than redone twice.

Commit per step. Stop and report after each. `npm run build` and `npm run typecheck` must pass, and you must have looked at the page at 390 px and at desktop width before reporting any step done.

--- END ---
