# CLAUDE.md — Novo mesto v žici

Project rules for Claude Code. Read before every task in this repo.

## Non-negotiables

1. **Never invent historical content.** No dates, names, casualty numbers, event descriptions or quiz answers. Missing content renders as "Vsebina v pripravi" + the `iztocnica` + EŠD + source links. Only NMZ-001, NMZ-016, NMZ-023 may carry filler, and it must be labelled `[DEMO BESEDILO — ni zgodovinski vir]`.
2. **The app runs with no `.env`.** `lib/data.ts` falls back to `tocke.seed.json` / `etape.seed.json`. Never make the database (Payload / Supabase) a hard requirement for `npm run dev`.
3. **`tocke.seed.json` and `etape.seed.json` are generated, not hand-edited.** The admin (Payload) is the source of truth; `npm run export:seed` regenerates both from the database (published points only) — commit the result. The Excel is finished as a source: `npm run import:xlsx` only prints a diff and never writes. If you need a new field, add it to the Payload collection (+ migration), `lib/types.ts` and `lib/cmsMapiranje.ts` in the same commit.
4. **All user-facing strings are Slovenian.** Code and comments are English. No mixed-language UI.
5. **GPS coordinates are approximate.** Never present them as surveyed.
6. **No new dependencies without asking.** Stack is Next.js 15 + TS + Tailwind v4 + MapLibre + Supabase + lucide-react.

## Conventions

- App Router, server components by default; `"use client"` only where the map or interactivity needs it.
- Data access goes through `lib/data.ts` only — no direct Supabase calls in components.
- Filter state lives in the URL query string, not React state.
- Slovenian diacritics in slugs are transliterated (č→c, š→s, ž→z). Slugs are stable IDs — never regenerate them for existing points or stages (`etape.id`, e.g. `etapa-3`).
- Stages are data (`getEtape()` in `lib/data.ts`), not constants. Components receive the stage list as a prop; never hardcode "8 stages" or index `ETAPE_SEED` at runtime.
- `localStorage` access only through `lib/progress.ts`, always try/catch.
- Tailwind: use design tokens from `app/globals.css`, no arbitrary hex values in components.

## Accessibility (hard requirement)

WCAG AA contrast, full keyboard operation of map filters, stage chips and lists, visible focus rings, `prefers-reduced-motion`, labelled icon-only buttons, a "Večja pisava" toggle. Audience includes schools and elderly visitors using phones outdoors.

## Commands

```bash
npm run dev          # must work on a fresh clone with no .env
npm run build        # must pass with zero TS errors before you report done
npm run export:seed  # regenerate tocke.seed.json + etape.seed.json from the database (--check = diff only)
npm run import:xlsx  # compare the client's Excel with tocke.seed.json (diff only, never writes)
```

## Working style

- Small commits, one per phase or feature.
- Stop after each phase and report: what runs, what is stubbed, what is next.
- When a requirement is ambiguous, ask instead of guessing — especially anything touching historical accuracy or the data schema.
