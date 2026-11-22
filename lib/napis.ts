/**
 * Display structure for a memorial inscription (Tocka.napis).
 *
 * The register's transcriptions mix two kinds of editorial markup into the
 * inscription text. They are kept verbatim — only classified, so the page
 * can show them differently from the inscription itself:
 *
 *  - symbol notes in square brackets, "[zvezda]", "[srp in kladivo]",
 *    "[križ]" — they describe a symbol on the object, they aren't words
 *    on it. A line holding nothing but a bare symbol word ("zvezda",
 *    NMZ-042) is the same note without brackets.
 *  - part labels, "plošča na levi strani:", "na dodani plošči:",
 *    "prva plošča", "Obelisk:" — which panel or object the following
 *    lines are on. A label at the start of a line is broken onto its own.
 *  - register descriptions standing in for text it didn't transcribe,
 *    "Imena 129 borcev" (NMZ-010) — not words on the plaque.
 *  - part separators: a line of only dots, "." or "......" (shown as a
 *    rule; the dots are the register's, not the object's).
 *
 * Inscriptions on the objects are in capitals, so a label must contain
 * lower-case letters; "BORCI:" stays inscription text. Sentence-case
 * inscriptions (NMZ-001) don't end in ":" and don't open with a part noun.
 */

export type DelVrstice = { vrsta: "besedilo" | "simbol"; besedilo: string };

export type VrsticaNapisa =
  | { vrsta: "podnaslov"; besedilo: string }
  | { vrsta: "opis"; besedilo: string }
  | { vrsta: "locilo" }
  | { vrsta: "vrstica"; deli: DelVrstice[] }
  | { vrsta: "prazna" };

const SIMBOL_V_OKLEPAJIH = /\[[^\]\n]+\]/g;
const IMA_SIMBOL = /\[[^\]\n]+\]/;
const GOL_SIMBOL = /^(?:zvezda|križ|srp in kladivo|peterokraka zvezda)$/;

const DEL_OBELEZJA = "(?:plošč\\w*|spomeni\\w*|obelis\\w*|napis\\w*|stran\\w*)";
// "prva plošča", "Osrednja plošča", "Leva plošča", "Prvotni spomenik", "Obelisk", "Novo izdelan spomenik"
const KRATKA_OZNAKA = new RegExp(
  `^(?:(?:prv|drug|tretj|četrt|osrednj|srednj|lev|desn|zgornj|spodnj|večj|manjš|prvotn|nov)\\w*\\s+(?:izdelan\\w*\\s+)?)?${DEL_OBELEZJA}$`,
  "i",
);
// "napis na obelisku", "plošča na levi strani", "na dodani plošči", "napis ob vznožju obeliska"
const OPISNA_OZNAKA = new RegExp(`^(?:${DEL_OBELEZJA}|na|ob)\\s.*${DEL_OBELEZJA}`, "i");

// "Imena 129 borcev", "Imena dveh talcev", "Imena 58 žrtev"
const OPIS_REGISTRA = /^Imena\s+\S+(?:\s+\S+)*$/;
const LOCILO = /^[.…·]+$/;

function jeOpis(besedilo: string): boolean {
  const t = besedilo.trim();
  return OPIS_REGISTRA.test(t) && /[a-zčšžćđ]/.test(t.slice(1));
}

function jeOznaka(besedilo: string): boolean {
  const t = besedilo.trim().replace(/:$/, "").trim();
  if (!t || !/[a-zčšžćđ]/.test(t) || IMA_SIMBOL.test(t)) return false;
  return KRATKA_OZNAKA.test(t) || OPISNA_OZNAKA.test(t);
}

function razdeliSimbole(vrstica: string): DelVrstice[] {
  if (GOL_SIMBOL.test(vrstica.trim())) return [{ vrsta: "simbol", besedilo: vrstica.trim() }];
  const deli: DelVrstice[] = [];
  let zadnji = 0;
  for (const m of vrstica.matchAll(SIMBOL_V_OKLEPAJIH)) {
    if (m.index > zadnji) deli.push({ vrsta: "besedilo", besedilo: vrstica.slice(zadnji, m.index) });
    deli.push({ vrsta: "simbol", besedilo: m[0] });
    zadnji = m.index + m[0].length;
  }
  if (zadnji < vrstica.length) deli.push({ vrsta: "besedilo", besedilo: vrstica.slice(zadnji) });
  return deli;
}

export function razcleniNapis(napis: string): VrsticaNapisa[] {
  const izhod: VrsticaNapisa[] = [];
  for (const surova of napis.split("\n")) {
    const vrstica = surova.replace(/\s+$/, "");
    if (!vrstica.trim()) {
      izhod.push({ vrsta: "prazna" });
      continue;
    }
    if (LOCILO.test(vrstica.trim())) {
      izhod.push({ vrsta: "locilo" });
      continue;
    }
    if (jeOpis(vrstica)) {
      izhod.push({ vrsta: "opis", besedilo: vrstica.trim() });
      continue;
    }
    if (jeOznaka(vrstica)) {
      izhod.push({ vrsta: "podnaslov", besedilo: vrstica.trim() });
      continue;
    }
    // A label opening a line, "plošča na levi strani: PADLI BORCI" -> two lines.
    const m = vrstica.match(/^([^:]+:)\s+(\S.*)$/);
    const [, oznaka, ostalo] = m ?? [];
    if (oznaka && ostalo && jeOznaka(oznaka)) {
      izhod.push({ vrsta: "podnaslov", besedilo: oznaka.trim() });
      izhod.push({ vrsta: "vrstica", deli: razdeliSimbole(ostalo) });
      continue;
    }
    izhod.push({ vrsta: "vrstica", deli: razdeliSimbole(vrstica) });
  }
  return izhod;
}
