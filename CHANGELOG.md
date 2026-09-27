# Changelog

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
