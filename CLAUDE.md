# CLAUDE.md — Novo mesto v žici

Project rules for Claude Code. Read before every task in this repo.

## Non-negotiables

1. **Never invent historical content.** No dates, names, casualty numbers, event descriptions or quiz answers. Missing content renders as "Vsebina v pripravi" + the `iztocnica` + EŠD + source links. Only NMZ-001, NMZ-016, NMZ-023 may carry filler, and it must be labelled `[DEMO BESEDILO — ni zgodovinski vir]`.
2. **The app runs with no `.env`.** `lib/data.ts` falls back to `tocke.seed.json`. Never make Supabase a hard requirement for `npm run dev`.
3. **`tocke.seed.json` is generated, not hand-edited.** Changes come from the client's Excel via `npm run import:xlsx`. If you need a new field, add it to the importer AND the schema.
4. **All user-facing strings are Slovenian.** Code and comments are English. No mixed-language UI.
5. **GPS coordinates are approximate.** Never present them as surveyed.
6. **No new dependencies without asking.** Stack is Next.js 15 + TS + Tailwind v4 + MapLibre + Supabase + lucide-react.

## Conventions

- App Router, server components by default; `"use client"` only where the map or interactivity needs it.
- Data access goes through `lib/data.ts` only — no direct Supabase calls in components.
- Filter state lives in the URL query string, not React state.
- Slovenian diacritics in slugs are transliterated (č→c, š→s, ž→z). Slugs are stable IDs — never regenerate them for existing points.
- `localStorage` access only through `lib/progress.ts`, always try/catch.
- Tailwind: use design tokens from `app/globals.css`, no arbitrary hex values in components.

## Accessibility (hard requirement)

WCAG AA contrast, full keyboard operation of map filters and bottom sheet, visible focus rings, `prefers-reduced-motion`, labelled icon-only buttons, a "Večja pisava" toggle. Audience includes schools and elderly visitors using phones outdoors.

## Commands

```bash
npm run dev          # must work on a fresh clone with no .env
npm run build        # must pass with zero TS errors before you report done
npm run seed         # push tocke.seed.json into Supabase
npm run import:xlsx  # regenerate tocke.seed.json from the client's Excel
```

## Working style

- Small commits, one per phase or feature.
- Stop after each phase and report: what runs, what is stubbed, what is next.
- When a requirement is ambiguous, ask instead of guessing — especially anything touching historical accuracy or the data schema.
