# Admin — Payload CMS 3 na Supabase

> Nova faza. Ne spreminja ničesar na javni strani, razen od kod bere podatke.

---

--- START ---

## Goal

The association must be able to edit all 50 memorials — texts, photos, GPS, stage assignment — and publish changes, without a developer. Build this with **Payload CMS 3** inside the existing Next.js app, backed by **Supabase Postgres**.

Payload is chosen over a hand-built admin because drafts/versions, authentication, roles, file uploads and change history come built in. Do not hand-roll any of those.

## Before you write code

Report your plan for these, and wait:

1. How Payload's generated tables will coexist with the existing schema (`tocke`, `etape`, `trase`, `profiles` from `supabase/migrations/`). Payload owns its collections' tables — propose whether to let it take over `tocke` and `etape` with a data migration, or to use new table names and migrate the data across. **`trase` stays outside Payload** — it is computed cache, not edited content.
2. How `lib/data.ts` keeps its current public API (`getPoints`, `getPoti`, `getEtape`) and its **no-`.env` fallback to `tocke.seed.json`**. That fallback is non-negotiable and must survive this change.
3. What breaks in `scripts/import-xlsx.ts`, `scripts/seed.ts` and `scripts/apply-koordinate.ts`.

## Collections

All admin labels, field names shown to the user, and validation messages are **in Slovenian**. Code stays English.

### `tocke`

Every field currently in `lib/types.ts`, plus drafts. Grouped in the editor as:

**Osnovno** — ID (read-only after creation), naziv, slug (auto from naziv, editable, never regenerated for an existing point), območje, vrsta (the client's five values only), EŠD, iztočnica.

**Lokacija** — a **custom field component: a map with a draggable pin.** The editor drags the pin; latitude and longitude are displayed read-only beside it. Also accept a paste field that parses `45.799489, 15.156234` for someone arriving with a field reading. The editor must never type into two separate number inputs. Alongside: `gps_zanesljivost` (priblizek / zunanji_vir / terensko / gis) and the read-only source fields from partizanstvo.si.

**Etapa** — relationship to `etape`, plus `zaporedje` (order within the stage).

**Vsebina** — kratko besedilo, poglobljeno besedilo (rich text), zgodbe (the client's ten, multi-select), viri (array of URLs).

**Fotografije** — relationship to `media`, ordered, first is the lead image.

**Delo** — the tracking fields from the client's Excel: status izvedbe, odgovorna oseba, rok, napredek, opombe.

Drafts on, versions on. **Public reads only published documents.**

### `etape`

stevilka, naziv, odsek, barva (colour picker), opis, vidna. Deleting a stage that still has points is refused with a list of them. Reordering stages changes their `stevilka`.

### `media`

Upload collection. Required on every file, enforced by validation, not by a hint:

- `podnapis`
- `avtor_vir`
- `pravice` — a select (lastno delo / dovoljenje pridobljeno / javna domena / neznano)

**A media item with `pravice: neznano` cannot be attached to a published point.** Enforce it in a `beforeValidate` hook on `tocke`, with a Slovenian error naming the offending photo. This is the single rule most likely to be quietly dropped — do not drop it.

Storage: Supabase Storage via the S3 adapter, or Vercel Blob. Pick one, say which and why. Generate the sizes the site actually uses — a thumbnail for cards, a wide one for the hero.

### `users`

Email login, **no public registration**. Roles `urednik` and `admin`. Urednik edits content; admin additionally manages users and stages. Access control enforced in Payload's `access` functions, not only hidden in the UI.

## Keeping the public site working

- Public pages must **not** query the database per request. Keep them static/ISR and revalidate on publish: an `afterChange` hook on `tocke` and `etape` calls `revalidatePath` for the point's page, the trail page and the home page.
  This matters beyond speed: a free Supabase project **pauses after a week without activity**. If the public site read the database live, it would go down in a quiet month — exactly when someone in the field scans a QR plaque. With this design a paused database inconveniences the editor, not the visitor.
- When a save changes `lat`, `lon`, `etapa` or `zaporedje`, mark the affected `trase` rows stale (the cache key already covers this). Add a **"Ponovno izračunaj trase"** action in the admin that runs the existing recompute. If `ORS_API_KEY` is not set in that environment, it must say so plainly rather than failing silently.

## Migration

Write `scripts/migrate-to-payload.ts` that moves the current 50 points and 8 stages into the collections, preserving IDs, slugs, coordinates, source fields and stage order. Idempotent, with a `--dry-run` that prints what it would do. Run it, report the result, and confirm the public site renders identically afterwards — same 50 points, same trails, same pages.

`tocke.seed.json` stays in the repo as the zero-config fallback and is regenerated from the database by a script, no longer from the Excel. The Excel is finished as a source.

## What is NOT in this phase

No quiz builder, no QR-scan analytics dashboard, no gamification, no trail hand-drawing, no GPX upload, no public submissions. Say so if you are tempted.

## Setup the client must do first

The project needs a Supabase project and its connection string in `.env.local` (`DATABASE_URI`), plus `PAYLOAD_SECRET`. Tell me exactly which variables you need before you start, and what each is for, so I can set them.

## Acceptance

- `npm run dev` with **no `.env`** still renders the public site from `tocke.seed.json`, with the admin disabled and saying so.
- With the database configured, an editor can log in, change a memorial's text, drag its pin, upload a photo with its rights filled in, and publish — and the public page shows the change without a redeploy.
- A photo with unknown rights cannot be published, and the error says which photo.
- Dragging the pin marks the stage's trail stale.
- A `urednik` cannot create users; an `admin` can.
- Deleting a stage with points is refused.
- `npm run build` and `npm run typecheck` pass.

Commit per step. Stop and report after the plan, after the migration, and after the admin is usable.

--- END ---
