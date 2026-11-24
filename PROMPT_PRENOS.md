# Prenos vsebine iz registra v obeležje — na gumb

> Dovoljenje imetnika je pridobljeno. Prejšnje omejitve iz `PROMPT_PARTIZANSTVO.md` glede objave fotografij registra s tem odpadejo.

---

--- START ---

## What changes

The client has obtained permission from partizanstvo.si to use its texts and photographs. The "reference only, never publish" rule from `PROMPT_PARTIZANSTVO.md` is lifted for this project.

Build a **"Prenesi iz registra"** action that pulls the register's material into a memorial, on demand, from the admin.

## Where the button lives

**On a memorial** (`/admin/collections/tocke/<id>`): a button in the "Gradivo iz registra" panel.

**On a stage** (`/admin/collections/etape/<id>`): the same action for every memorial in that stage at once, with a progress report and a per-memorial result.

Both are available to `urednik` and `admin`. Neither publishes anything — the material lands in the record as a draft for the editor to review and publish.

## What it copies

**Inscription** (`napis`) — already handled by `prenesi:napise`; reuse that logic. Skip if the memorial already has one.

**Access description** — add a new field `dostop` (multi-line text) to `tocke`. This is genuinely useful on a walking trail: it is the text that tells a visitor the plaque is "on the side wall of the house at Valantičevo 5" or that the bunker "is entered by the steps at either end". Show it on the public memorial page under a heading **"Kako do obeležja"**, below the inscription. Skip if already filled.

**Photographs** — download from the register and create `media` documents attached to the memorial:

- `avtor_vir` ← the register's author where given, otherwise `partizanstvo.si`
- `pravice` ← `Dovoljenje pridobljeno`
- `licenca` ← whatever the register states for that photo, verbatim
- `vir_url` ← the memorial's page in the register
- `podnapis` ← the register's caption, or the memorial's name
- a note field recording **who granted permission and when** — add `dovoljenje_opomba` to `media` if there is no suitable field. Prefill it from a single constant in the script that I will set, so every imported photo carries the same provenance line.

Attach largest first. **Idempotent: match on `vir_url` + file name, never create a duplicate.** Re-running the action on a memorial that already has its photos must change nothing and say so.

## Storage — check before you bulk-import

The register holds 156 photographs for our 50 memorials, some up to 4000 px. Supabase Storage on the free plan has **1 GB**. Importing originals could consume most or all of it.

So: **before writing anything, report the total download size.** Then resize on import — longest edge 2000 px, JPEG quality ~82, keeping the original aspect ratio — and store only the resized file plus the sizes the site already generates. Record the original's dimensions and the register URL in the media document so the full-resolution file can always be fetched again.

If the projected total still exceeds 600 MB, stop and tell me rather than filling the bucket.

## Rate limiting and failure

One request at a time with a short pause, as in `import-partizanstvo.ts` — this is someone else's server. A failed download skips that photo and reports it; it never aborts the whole stage.

## Report

Per memorial: inscription copied or skipped, access text copied or skipped, how many photos imported, how many skipped and why, total bytes stored. For the stage action, a summary across all its memorials.

## Still unchanged

The public site shows only what an editor publishes. A photo without `pravice` filled still cannot be published. The three uncertain register matches (NMZ-030, NMZ-033, NMZ-034) keep their warnings.

--- END ---
