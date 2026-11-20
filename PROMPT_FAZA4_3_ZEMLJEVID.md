# Faza 4.3 — izgled in obnašanje zemljevida (popravki po naročniku)

> Spada h koraku 3 iz `PROMPT_FAZA4.md` (javni zemljevid bere izračunane trase). Ta dokument natančneje določa, kako naj zemljevid izgleda in se obnaša. Kjer se razhaja s `PROMPT.md`, velja ta dokument.

---

--- START ---

This refines step 3 of `PROMPT_FAZA4.md`. The client has looked at the current map and at the earlier prototype (https://pot-ob-zici.lovable.app/) and specified how stages should read on the map. Fetch that prototype if you have not — its stage chips, each with its own number and colour dot, are the look being asked for.

## 1 — One colour per stage, used everywhere

Each stage has exactly one colour, and that colour is the stage's identity across the whole UI:

- the filter chip, as a coloured dot next to the label **"Etapa 1"** … **"Etapa 8"**,
- the stage's line on the map,
- the markers of the points belonging to that stage,
- the stage's row in the side panel, and its page at `/pot/[slug]`.

**`etape.barva` is the single source of truth.** No component may hold its own colour table or derive a colour from a stage number. An editor recolouring a stage in the admin must change every one of the places above at once. Audit the existing components for hardcoded stage colours and remove them.

The eight colours must be distinguishable from each other **and** readable on the map's base tiles, including for the most common forms of colour blindness. If the current eight fail that, propose a corrected set rather than keeping them — but do not change colours silently; tell me what you changed and why.

## 2 — The stages connect into one continuous trail

The eight stages are consecutive sections of a single loop around the town, not eight unrelated lines. Therefore:

- Stage *n* must **end where stage *n+1* begins**, and stage 8 must close back to stage 1. No visible gaps, no overlapping doubled-back ends.
- With all stages shown, the map must read as **one closed ring in eight colours**, not as eight separate strands.
- Where consecutive stages meet, the joint should look deliberate: the colours meet, they do not fade or stop short of each other.
- This applies to both the routed geometry from 4.2 and the schematic fallback. If routed stage ends do not currently meet, fix the construction in `lib/trase.ts` rather than papering over it in the renderer.

## 3 — Show all, or only the stages you pick

- **Default: all stages visible**, lines and markers.
- Selecting one or more stage chips shows **only** those stages — their lines and their points. Everything else leaves the map.
- Multiple selection keeps working as specified in `PROMPT_FAZA4.md`: the selected stages are drawn in their own colours, and consecutive selected stages still join into one continuous line.
- Selection stays in the URL query so a filtered view can be shared.
- When exactly one stage is selected, its markers additionally show their **sequence number** (`zaporedje`) — 1, 2, 3 … — so the walking order is visible. With several stages selected the numbers are dropped; they would be ambiguous.

## 4 — Clicking a point does both things

A click on a marker (on the map, or on its row in the panel — same shared state as today) does **both** of the following, together:

1. **Highlights that point's stage route.** The stage's line goes to full weight and opacity, every other line fades, and the stage's chip reads as active. The user immediately sees which section of the trail this memorial sits on, without having to guess from the colour.
2. **Opens the popup with "Pelji me tja"** — the walking route from the user's position to this memorial, exactly as built in Phase 3, with the external-maps link always available beside it.

These are two different routes on screen at once — the stage trail and the personal walking route — so they must be visually distinct and never confusable: the stage trail is a solid coloured line, the personal route a dashed line in a neutral accent, and the popup labels which is which. If that reads as clutter in practice, say so and propose how to separate them, rather than quietly dropping one.

Clicking empty map clears the point selection and restores whatever stage filter was in force.

## 5 — What must not regress

- Fit to bounds on load. The map never opens at world zoom.
- Marker clustering below zoom ~14, with cluster colour reflecting the stages inside it.
- The "Prikaži razširjene krake" toggle: 37 of 50 points sit off the main trail.
- Keyboard operation of chips, panel and popups; focus rings; `prefers-reduced-motion`.
- The honest labelling from 4.2: routed trails say they are computed and not an officially marked path; fallbacks say they are schematic.
- Phone first. Eight colours plus numbers plus two kinds of line must still be legible on a 390 px screen in sunlight. Check it at that width before reporting done.

## Acceptance

- With no filter, the eight stages form one visibly continuous coloured ring.
- Selecting stages 2, 3 and 4 shows one continuous line through those three, in three colours, and only their points.
- Selecting stage 5 numbers its markers in walking order.
- Clicking any marker highlights its stage's line and offers the walking route at the same time, with the two lines clearly distinct.
- Recolouring a stage in the admin changes the chip, line, markers and panel row together.
- `npm run build` and `npm run typecheck` pass, and you have viewed the result at 390 px wide before reporting done.

--- END ---
