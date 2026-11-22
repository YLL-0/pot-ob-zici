/**
 * Prenos podatkov iz javnega registra partizanstvo.si za 50 obeležij Poti ob žici.
 *
 * Zažene se ročno:  npx tsx scripts/import-partizanstvo.ts
 * Zapiše:           data/partizanstvo.json
 *
 * Podatki so REFERENČNO GRADIVO za urednike, ne vsebina za objavo.
 * Besedila in fotografije so avtorsko delo prispevateljev registra —
 * preden karkoli od tega pride na javno stran, mora biti urejeno dovoljenje.
 * Edina izjema so dobesedni prepisi napisov na obeležjih, ki so prepis
 * javnega napisa, ne avtorsko besedilo registra — a tudi te je pred objavo
 * vredno preveriti na terenu, ker register ponekod označuje negotovost.
 */

const BASE = "https://partizanstvo.si";

/** NMZ ID -> ID zapisa v registru partizanstvo.si (ujemanje po nazivu in legi). */
const IDS: Record<string, number> = {
  "NMZ-001": 2453, "NMZ-002": 4041, "NMZ-003": 2856, "NMZ-004": 5755, "NMZ-005": 6718,
  "NMZ-006": 6719, "NMZ-007": 6734, "NMZ-008": 6733, "NMZ-009": 2832, "NMZ-010": 2831,
  "NMZ-011": 5761, "NMZ-012": 8220, "NMZ-013": 6396, "NMZ-014": 6732, "NMZ-015": 5763,
  "NMZ-016": 6563, "NMZ-017": 5760, "NMZ-018": 6739, "NMZ-019": 6879, "NMZ-020": 2833,
  "NMZ-021": 5757, "NMZ-022": 5758, "NMZ-023": 5756, "NMZ-024": 6394, "NMZ-025": 6560,
  "NMZ-026": 5764, "NMZ-027": 6395, "NMZ-028": 4965, "NMZ-029": 10390, "NMZ-030": 6738,
  "NMZ-031": 4964, "NMZ-032": 6874, "NMZ-033": 6875, "NMZ-034": 8412, "NMZ-035": 5765,
  "NMZ-036": 4642, "NMZ-037": 4644, "NMZ-038": 4645, "NMZ-039": 4643, "NMZ-040": 5091,
  "NMZ-041": 4262, "NMZ-042": 5093, "NMZ-043": 5072, "NMZ-044": 5071, "NMZ-045": 5094,
  "NMZ-046": 4962, "NMZ-047": 63,   "NMZ-048": 50,   "NMZ-049": 1362, "NMZ-050": 5601,
};

/** Ujemanje, ki ni zanesljivo — naziv v registru se ne ujema z našim. */
const NEGOTOVO: Record<string, string> = {
  "NMZ-030": "Register navaja lego pri pokopališču Ločna, naša evidenca Seidlovo cesto (gasilski dom).",
  "NMZ-033": "Na pokopališču Šmihel je več ločenih zapisov nekaj metrov narazen — preveri, ali je to skupinski sklop.",
  "NMZ-034": "Prav tako na pokopališču Šmihel, 45 m od NMZ-033; preveri, da ne gre za isto obeležje.",
};

const entitete = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** HTML -> plain text on one line. */
const strip = (s: unknown): string | null => {
  if (typeof s !== "string") return null;
  const t = entitete(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return t || null;
};

/**
 * HTML -> plain text keeping paragraphs (blank line) and <br> (newline).
 * Inscriptions are laid out in lines on the object; keep that structure.
 */
const stripOdstavki = (s: unknown): string | null => {
  if (typeof s !== "string") return null;
  const t = entitete(
    s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]*>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t\r]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t || null;
};

/** Empty strings from the API mean "unknown". */
const tekst = (s: unknown): string | null => (typeof s === "string" && s.trim() ? s.trim() : null);

/** The API returns Slovenian property names; accept the English ones too. */
const polje = (p: Record<string, unknown>, ...imena: string[]): unknown => {
  for (const i of imena) if (p[i] !== undefined && p[i] !== null) return p[i];
  return null;
};

async function json(path: string) {
  const r = await fetch(BASE + path, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${path}`);
  return r.json();
}

async function main() {
  const out: Record<string, unknown> = {};
  let slik = 0;

  for (const [nmz, pid] of Object.entries(IDS)) {
    const full = await json(`/api/full/partisanmemorial/${pid}/`);
    const p: Record<string, unknown> = full.properties ?? {};
    const coords = full.geometry?.coordinates ?? [];

    let images: unknown[] = [];
    try {
      const im = await json(`/api/get_images/?model_name=partisanmemorial&object_id=${pid}`);
      const list = Array.isArray(im) ? im : (im.images ?? im.results ?? []);
      images = list.map((x: Record<string, unknown>) => ({
        url: BASE + (x.url ?? x.image ?? x.file ?? ""),
        thumb: x.thumbnail_url ? BASE + x.thumbnail_url : null,
        avtor: tekst(x.author),
        opis: strip(x.caption ?? x.description ?? x.title),
        // What the register itself states — informational only. Our status
        // stays NEUREJENO until permission is actually obtained.
        licenca_v_registru: tekst(x.license),
        izvor_v_registru: tekst(x.source),
        pravice: "NEUREJENO",
      }));
    } catch (e) {
      console.warn(`  ${nmz}: slik ni bilo mogoče prebrati — ${String(e)}`);
    }
    slik += images.length;

    out[nmz] = {
      vir: "partizanstvo.si",
      vir_id: pid,
      vir_url: `${BASE}/sl/zemljevid/?layer=partisanmemorial&id=${pid}`,
      naziv_v_registru: tekst(polje(p, "Ime", "Name")),
      lat: coords[1] ?? null,
      lon: coords[0] ?? null,
      napis: stripOdstavki(polje(p, "Besedilo na spomeniku", "Text on the memorial")),
      dostop: strip(polje(p, "Lokacija in dostop", "Location and access")),
      vrsta: tekst(polje(p, "Oblika obeležja", "Type of memorial")),
      nastanek: tekst(polje(p, "Čas postavitve ali odkritja", "Time of creation")),
      avtor_obelezja: tekst(polje(p, "Avtor spomenika", "Author of the memorial")),
      kataster: tekst(polje(p, "Katastrski podatki", "Cadastral data")),
      vnesel: tekst(polje(p, "Ime vnašalca", "Entry author")),
      povezave: [
        ...new Set(
          (String(polje(p, "Opis", "Description") ?? "").match(/https?:\/\/[^\s"'<>)]+/g) ?? []).map((u) =>
            u.replace(/[.,;]+$/, ""),
          ),
        ),
      ],
      slike: images,
      opozorilo: NEGOTOVO[nmz] ?? null,
    };

    process.stdout.write(`${nmz} ✓  `);
    await new Promise((r) => setTimeout(r, 250)); // ne obremenjuj tujega strežnika
  }

  const fs = await import("node:fs/promises");
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(
    "data/partizanstvo.json",
    JSON.stringify(
      {
        _opomba:
          "Referenčno gradivo iz javnega registra partizanstvo.si. NI za neposredno objavo — " +
          "besedila in fotografije so avtorsko delo prispevateljev registra. Pred objavo uredi dovoljenja.",
        _preneseno: new Date().toISOString(),
        _stevilo: Object.keys(out).length,
        obelezja: out,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\n\nZapisano v data/partizanstvo.json`);
  console.log(`Obeležij: ${Object.keys(out).length}, fotografij: ${slik}`);
  console.log(`Negotova ujemanja: ${Object.keys(NEGOTOVO).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
