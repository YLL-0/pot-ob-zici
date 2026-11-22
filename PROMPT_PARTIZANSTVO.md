# Gradivo iz registra partizanstvo.si

> Priložena je skripta `import-partizanstvo.ts` → v projekt v `scripts/`.

---

--- START ---

The client asked whether the memorial content on **partizanstvo.si** can be brought in. It can: the register has a public JSON API, and all 50 of our points have been matched to their records by name and position.

`scripts/import-partizanstvo.ts` (new file, in the project root — move it to `scripts/`) fetches, for every NMZ point: the **transcribed inscription**, the **location and access description**, object type, year of creation, the memorial's author where known, the **cadastral parcel and landowner**, who entered the record, source links, and the list of photographs with their photographers. It writes `data/partizanstvo.json` and rate-limits itself to one request per 250 ms.

Run it, report what came back, and commit the result.

## This is reference material, not publishable content

The register's descriptions and photographs are the work of its contributors — several are credited by name (M. Kermavnar, M. Hladnik, D. Divjak, S. Drole, Saša Šest), and one photo credits *ZB Novo mesto*, the client's own association. Copying any of it onto a public site needs permission, which is likely easy to obtain here but has not been obtained.

So:

- **Never publish any of it automatically.** Nothing from `data/partizanstvo.json` may appear on a public page without an editor deliberately putting it there.
- Every photo record carries `pravice: "NEUREJENO"`. That is the truth until someone changes it, and the existing rule stands: a photo whose rights are unresolved cannot be published.
- The one defensible exception is the **inscription text** (`napis`), which is a transcription of a public inscription on a monument rather than authored prose. Even so, treat it as a draft to be checked against the object, not as verified content.

## How the editors should see it

Add a read-only **"Gradivo iz registra"** panel to the point editor in the admin, below the content fields, showing for that point:

- the inscription, with a **"Prenesi v poglobljeno besedilo"** button that copies it into the editor as a starting point — the editor then writes around it. Never auto-fill a published field.
- the access description, the year, the memorial's author, and the source links;
- **the cadastral parcel and landowner** — this is the most immediately useful field in the whole import, because it answers who must grant permission to mount a QR plaque. The client's Excel has a "Dovoljenje za namestitev" column that is empty for all 50; this fills in who to ask. Surface it prominently and make it copyable;
- the photographs as thumbnails, each labelled with its photographer and a visible **"pravice neurejene"** marker, with the register's page linked. Do not copy the image files into our storage. The editor downloads one only after permission exists, then uploads it normally through the media collection so the rights field is filled in the usual way.
- for NMZ-030, NMZ-033 and NMZ-034, show the matching warning carried in the data — those three matches are probable, not certain.

The panel reads `data/partizanstvo.json` at build time. It must not fetch partizanstvo.si at runtime, and the public site must not load this file at all.

## Also

- Add a line to `/o-projektu` crediting the register as the source of coordinates and reference material, linked.
- Note in the README that the script is run manually, not on build, and that re-running it overwrites the file — so nothing an editor has written should ever live there.

Report after running: how many inscriptions, access texts and photographs came back, and which points have no inscription.

--- END ---
