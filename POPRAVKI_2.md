# Popravki 2 — točne koordinate in večji zemljevid

> Ima prednost pred vsemi prejšnjimi specifikacijami. Priložena je datoteka `koordinate_partizanstvo.json`.

---

--- START ---

Two changes. The first replaces data, the second is layout.

## 1 — Replace the GPS coordinates with sourced ones

The coordinates in `tocke.seed.json` are the Excel's "izhodiščni približki" and they are wrong — the median error against surveyed positions is **1.1 km**, the worst is **4.35 km**. Points in Prečna, Kuzarjev Kal and Velika Bučna vas are kilometres from where they stand.

Accurate coordinates for all 50 points exist in the public register at **partizanstvo.si**, which publishes a JSON API per memorial. All 50 have been matched to their register entry and exported to **`koordinate_partizanstvo.json`** in the project root. Each record holds:

```jsonc
{
  "id": "NMZ-001",
  "naziv": "Bunker na Drski",
  "lat": 45.799489, "lon": 15.156234,     // use these
  "gps_zanesljivost": "zunanji_vir",
  "vir": "partizanstvo.si",
  "vir_id": 2453,
  "vir_url": "https://partizanstvo.si/sl/zemljevid/?layer=partisanmemorial&id=2453",
  "vir_naziv": "Bunker na Drski",          // the register's own name, for verification
  "prejsnji_lat": 45.7957, "prejsnji_lon": 15.1617,
  "premik_m": 430
}
```

**What to do:**

- Add `gps_zanesljivost` value `zunanji_vir` alongside the existing `priblizek` / `terensko` / `gis`, and the fields `gps_vir`, `gps_vir_id`, `gps_vir_url` to the schema and the Supabase migration.
- Write `scripts/apply-koordinate.ts` that reads `koordinate_partizanstvo.json` and updates `tocke.seed.json` in place: coordinates, reliability, source fields. It must **match on `id` only**, refuse to run if any id is missing or unknown, and print every change as `ID · naziv · premik`. Idempotent — running it twice changes nothing the second time.
- `scripts/import-xlsx.ts` must stop overwriting coordinates from the Excel for any point whose reliability is `zunanji_vir`, `terensko` or `gis`. The Excel's approximations are now the weakest source and must never win. Say so in a comment and in the README.
- **Recompute every trail afterwards** — all the routed geometry in `data/trase/` was built from the wrong positions and is now meaningless. Report which stages change materially and whether any point that routed before now fails.
- The on-page caveat changes. Points sourced this way are no longer "izhodiščni približki": label them **"Lokacija iz registra partizanstvo.si — terensko še ni preverjena"**, with the source URL linked on the point's page. Keep the stronger caveat only for points that still have `priblizek`.

**Three matches to verify in the field before the site is published** — the register name does not exactly match the client's name, so the match is probable, not certain:

| ID | Naš naziv | Zapis v registru | Kaj preveriti |
|---|---|---|---|
| NMZ-030 | Spominska plošča padlim gasilcem, Seidlova cesta | "Novo mesto, gasilcem" (45.813526, 15.174022) | Register position is near the Ločna cemetery, our note says the fire station on Seidlova cesta. One of the two is wrong. |
| NMZ-033 | Spominski sklop NOB na pokopališču Šmihel | "Šmihel pokopališče" (45.796391, 15.162200) | The Šmihel cemetery holds several separate register entries very close together; confirm this is the collective one, not an individual grave. |
| NMZ-034 | Valantičevo obeležje | "Valantič, Šmihel" (45.796781, 15.162094) | Also in the Šmihel cemetery, 45 m from NMZ-033 and distinct from NMZ-004 (Valantičeva družina, Kandija). Confirm these are three different memorials. |

Flag all three in the data with a note field so the admin shows them as needing field verification. Do not quietly treat them as confirmed.

Attribute the source on `/o-projektu`: coordinates come from partizanstvo.si, with a link.

## 2 — The map gets most of the screen

The current page follows the reference layout, which the client accepted — but the map is too small. Keep the structure, enlarge the map.

- On desktop the map fills the viewport below the header: roughly `calc(100svh - <header>)`, with a floor of about 560 px. It is the page's main element, not an illustration between two blocks of text.
- Above it stay the title, the coordinates notice and the stage chips — compact, one or two lines, not a tall hero. The eyebrow label and heading can shrink once the user scrolls.
- The stage list and the memorial list stay **below** the map, as now.
- On phones the map takes at least 60svh, with the stage chips scrollable horizontally above it.
- Keep what already works: two-finger / Ctrl+wheel panning so the map doesn't hijack page scrolling, fit-to-bounds on load, clustering.

Use `svh`, not `vh` — mobile browser chrome makes `vh` cut the map off.

Do not rebuild the design system for this. It is a sizing and layout change.

## Order

1. Schema and `apply-koordinate.ts`, applied, with the change report.
2. Importer precedence fix.
3. Recompute trails, report.
4. Map sizing.
5. Caveat wording and the `/o-projektu` attribution.

Commit per step. Report after each. Before reporting done, open the map and confirm a few points sit where they belong — NMZ-001 by the flats on Šegova, NMZ-017 at the school, the Prečna group together in Prečna and not in the city centre.

--- END ---
