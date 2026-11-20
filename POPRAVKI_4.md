# Popravki 4 — mreža kartic in noga z logotipi

> Nadomešča §3 in §4 v `POPRAVKI_3.md`.

---

--- START ---

Two corrections to the previous brief.

## 1 — The memorial grid: smaller cards, fixed columns, never stretched

My earlier instruction said one card per row. **That was wrong — the client wants the grid kept.** Revert any single-column change.

- Keep the grid: **three columns** from about 1024 px, **four** from about 1440 px, two on tablets, one on phones.
- **Cards are narrower than now.** Reduce the card's padding and the type sizes a step; the cards should read as a compact index, not as feature panels.
- **A card never stretches to fill an incomplete row.** A stage with seven memorials renders 3 + 3 + 1, and the last card keeps the same width as the others. Use fixed grid columns (`grid-template-columns: repeat(N, minmax(0, 1fr))`) — not flex with `flex-grow`, and not `auto-fit`, both of which stretch the stragglers.
- The grid sits inside the content column with a clear outer margin, not edge to edge.

**Card contents stay as they are** — ID in small monospace, name in bold, area in grey, coordinates in small monospace — and **the right-hand arrow is removed**.

**The whole card is one clickable control.** Clicking anywhere on it pans the map to that memorial, opens its popup, and scrolls the page back up to the map. Implement it as a real `<button>` (or a link to the point's page that the handler intercepts) so it is keyboard-reachable, has a focus ring, and responds to Enter and Space. Not a `div` with `onClick`.

Stage sections keep their heading — colour dot, "Etapa N", section name, point count — with the stage colour as a rule under the heading.

## 2 — The footer logos are supplied

The four logo files are in `public/logotipi/`:

| datoteka | kaj je | širina × višina |
|---|---|---|
| `zzb-nob-nm.png` | Združenje borcev za vrednote NOB Novo mesto | 444 × 240 |
| `cnvos.png` | CNVOS | 572 × 240 |
| `4impact-values.png` | 4IMPACT VALUES | 455 × 240 |
| `eu-sofinancira.png` | Sofinancira Evropska unija | 506 × 240 |

All four are PNG with transparency, trimmed of padding and normalised to the same 240 px height, so they align on a shared baseline when you set one display height for all of them.

- Order, left to right: ZZB NOB Novo mesto · CNVOS · 4IMPACT VALUES · Sofinancira Evropska unija.
- Display height about 44 px, each keeping its aspect ratio. Serve them at 2× (they are large enough).
- **Do not recolour, crop, outline, place on a coloured tile, or apply any filter** to any of them — least of all the EU emblem, whose form and colours are prescribed by the funder. The footer panel is a light neutral; the logos sit on it unmodified.
- Each logo gets `alt` with the organisation's full name. Link them to the organisations' sites only if the client supplies the URLs; otherwise leave them unlinked.
- On phones the four wrap to two rows, centred, keeping the shared height.

To the right of the logos, behind a vertical rule, the funding statement **reproduced exactly as written — do not paraphrase, shorten or re-translate**:

> Financirano s strani Evropske unije. Izražena stališča in mnenja so zgolj stališča in mnenja avtorja(-ev) in ne nujno, da odražajo stališča in mnenja Evropske unije ali Evropske izvajalske agencije za izobraževanje in kulturo (EACEA). Zanje ne moreta biti odgovorna niti Evropska unija niti EACEA.

On phones this statement moves below the logos.

Below the panel, a thin line with the project name, a link to `/o-projektu`, and the existing attributions: OpenFreeMap / OpenStreetMap for the map, and partizanstvo.si for the coordinates.

The footer appears on every page.

## Note for the client, include it in your report

`zzb-nob-nm.png` is a low-quality raster — visibly compressed, with colour fringing around the emblem. It will look poor at any size on a modern screen. Ask the association for the original vector (SVG, EPS or AI). The other three are clean.

--- END ---
