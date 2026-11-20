# Popravki 3 — zemljevid, seznam etap, noga strani

> Ima prednost pred vsemi prejšnjimi specifikacijami. Referenca za seznam: https://pot-ob-zici.lovable.app/

---

--- START ---

Four changes from the client's review of the live site. Fetch the reference page before starting — its list styling is what §3 asks for.

## 1 — Normal wheel zoom on the map

The map currently requires Ctrl + wheel to zoom. Remove that: the wheel alone zooms, as on any map.

Keep the page scrollable:

- **Pointer devices:** `scrollZoom` on, no modifier. The page still scrolls when the cursor is outside the map, and the map is not full-bleed vertically (see §2), so there is always page surface to scroll from.
- **Touch:** keep cooperative gestures — one finger pans the page, two fingers pan and zoom the map. On a phone a one-finger map pan traps the user on a tall map with no way to scroll past it. Show the usual brief hint overlay when a one-finger drag is attempted.
- Keep the visible **+ / −** buttons and make them keyboard reachable. They are the accessible path to zoom and must not be removed.
- Double-click to zoom in, double-click with Shift to zoom out, as standard.

## 2 — The map takes most of the screen

It currently sits in the narrow text column, a third of the way down the page, behind six stacked elements.

- The map is **full width of the page**, not confined to the text column. Edge to edge, or with only the page's outer gutter.
- Height: about `70svh` on desktop, minimum 560 px; at least `60svh` on phones. Use `svh`, never `vh` — mobile browser chrome cuts `vh` off.
- Above it only: the eyebrow, the title, one line of subtitle, the coordinates notice, and the stage chips. Fold the search field and the "Filtri" control into a single compact row, or move them onto the map as an overlay. The visitor must reach the map after one short block, not after six.
- The "Prikazano 50 od 50 obeležij" counter moves next to the search field or onto the map; it does not get a line of its own above the map.

## 3 — The stage list below the map: vertical, grouped, with a clear selection

Below the map, the memorials are listed **grouped by stage**, in the reference's style.

Current layout puts cards in a three-column grid, which reads as a wall. Make it vertical:

- **One card per row**, stacked, full width of the content column. Not a grid.
- Card contents, in this order, as in the reference: the ID in small monospace grey (`NMZ-017`), the name in bold, the area in grey, the coordinates in small monospace. Rounded corners, white card on the warm page background, generous padding, clear gap between cards.
- Each stage is a section with a heading: a dot in the stage colour, **"Etapa 3"**, its section name, and the point count. The heading carries the stage colour as a left rule or an underline so the grouping is visible while scrolling.
- Clicking a card pans the map to that point and opens its popup, as now.

**Make the active selection obvious.** Today it is not clear which stage is selected. When one or more stages are active:

- the active chip is filled with its stage colour, the inactive ones stay outlined;
- the sections of inactive stages are hidden, not merely dimmed;
- a line above the list states the selection in words — "Prikazana je Etapa 3: Bučna vas – Ragovo (7 obeležij)" — with a "Pokaži vse etape" link next to it;
- the selected stage's line on the map is at full weight while the others fade.

The same must hold when the selection came from clicking the map rather than a chip.

## 4 — Footer with the funders

Add a site-wide footer, present on every page, below all content.

**Logos, left to right:** ZZB NOB Novo mesto (Združenje borcev za vrednote NOB Novo mesto) · CNVOS · 4IMPACT VALUES · the EU emblem with "Sofinancira Evropska unija".

The logo files are not in the repository. **Do not draw, redraw or approximate any of these marks, and do not substitute a text label for a logo.** Create `public/logotipi/` with a short README naming the four files you expect (`zzb-nob-nm.svg`, `cnvos.svg`, `4impact-values.svg`, `eu-sofinancira.svg`), render a neutral placeholder box of the right proportions where a file is missing, and list what is missing in your report. The client will supply them.

**Disclaimer text, to the right of the logos, reproduced exactly — do not paraphrase, shorten or re-translate it:**

> Financirano s strani Evropske unije. Izražena stališča in mnenja so zgolj stališča in mnenja avtorja(-ev) in ne nujno, da odražajo stališča in mnenja Evropske unije ali Evropske izvajalske agencije za izobraževanje in kulturo (EACEA). Zanje ne moreta biti odgovorna niti Evropska unija niti EACEA.

This wording is a condition of the funding, so it is fixed text, not copy to improve.

Layout: logos in a row with a vertical rule before the disclaimer, on a light panel distinct from the page background. On phones the logos wrap and the disclaimer sits below them. Logos keep their aspect ratio and a minimum legible height (about 40 px); the EU emblem must not be recoloured or cropped.

Below that, a small line with the project name, the link to `/o-projektu`, and the attributions already on the site — OpenFreeMap / OpenStreetMap, and partizanstvo.si for the coordinates once those are in.

## Order

1. Wheel zoom (§1) — small, do it first.
2. Map size and the block above it (§2).
3. The list (§3), including the selection state.
4. Footer (§4).

Commit per step, report after each. Check at 1440 px and at 390 px before reporting done, and confirm on a touch viewport that the page can still be scrolled past the map with one finger.

--- END ---
