/**
 * Payload document → public type (lib/types.ts). Pure functions, no
 * database access: lib/data.ts and scripts/export-seed.ts both use them,
 * so the live site and the regenerated tocke.seed.json can't disagree on
 * what a field means.
 */

import type { Etape as EtapaDoc, Media as MediaDoc, Tocke as TockaDoc } from "@/payload-types";
import type { Etapa, Foto, Status, Tocka } from "@/lib/types";
import { PRAVICE_MOZNOSTI } from "@/cms/moznosti";

type LexicalVozel = { type?: string; text?: string; children?: LexicalVozel[] };
export type LexicalDokument = NonNullable<TockaDoc["besedilo_poglobljeno"]>;

function idRelacije(ref: unknown): string | null {
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object" && "id" in ref) return String((ref as { id: unknown }).id);
  return null;
}

export function statusIzDokumenta(doc: Pick<TockaDoc, "_status" | "v_pregledu">): Status {
  if (doc._status === "published") return "objavljeno";
  return doc.v_pregledu ? "v_pregledu" : "osnutek";
}

/**
 * Lexical → plain text in the seed's format: paragraphs (and other blocks)
 * separated by a blank line, line breaks as "\n". Inverse of the
 * conversion in scripts/migrate-to-payload.ts. Formatting (bold, links) is
 * dropped — the seed is the fallback, the database keeps the original.
 */
export function lexicalVBesedilo(doc: LexicalDokument | null | undefined): string | null {
  if (!doc) return null;
  const vozel = (v: LexicalVozel): string => {
    if (v.type === "linebreak") return "\n";
    if (typeof v.text === "string") return v.text;
    return (v.children ?? []).map(vozel).join("");
  };
  const besedilo = (doc.root.children as LexicalVozel[]).map(vozel).join("\n\n");
  return besedilo.trim() === "" ? null : besedilo;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Plain text (seed) → the same HTML shape the Lexical converter produces
 * for plain paragraphs, so the point page renders both sources alike.
 */
export function besediloVHtml(besedilo: string | null): string | null {
  if (besedilo === null || besedilo.trim() === "") return null;
  return besedilo
    .split(/\n{2,}/)
    .map((odstavek) => `<p>${odstavek.split("\n").map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

const PRAVICE_OZNAKE = new Map(PRAVICE_MOZNOSTI.map((o) => [o.value, o.label]));

/**
 * Public photos of a point, in editor order. A photo with unknown rights
 * never reaches the public site — publishing is already refused for those
 * (cms/collections/Tocke.ts), this is the second line of defence.
 */
function fotoIzMedie(fotografije: TockaDoc["fotografije"]): Foto[] {
  return (fotografije ?? [])
    .filter((m): m is MediaDoc => typeof m === "object" && m !== null)
    .filter((m) => m.pravice !== "neznano" && typeof m.url === "string")
    // A free licence without its licence name or source is not a filled-in
    // right (validated in cms/collections/Media.ts; second line here).
    .filter((m) => m.pravice !== "prosta-licenca" || (!!m.licenca?.trim() && !!m.vir_url?.trim()))
    .map((m) => ({
      url: m.sizes?.naslovna?.url ?? m.url!,
      opis: m.podnapis,
      avtor_vir: m.avtor_vir,
      pravice: PRAVICE_OZNAKE.get(m.pravice) ?? m.pravice,
      licenca: m.licenca?.trim() || null,
      vir_url: m.vir_url?.trim() || null,
      tip: m.tip,
    }));
}

/**
 * `besedilo_poglobljeno` is returned as given by `poglobljeno` — HTML for
 * the site (lib/data.ts), plain text for the seed (scripts/export-seed.ts).
 * `qr_url` and `odsek` are left empty: lib/data.ts derives them on read.
 */
export function tockaIzDokumenta(doc: TockaDoc, poglobljeno: (d: LexicalDokument | null | undefined) => string | null): Tocka {
  return {
    id: doc.id,
    slug: doc.slug,
    naziv: doc.naziv,
    obmocje: doc.obmocje,
    vrsta_raw: doc.vrsta_raw ?? "",
    vrsta: doc.vrsta,
    lat: doc.lat,
    lon: doc.lon,
    gps_zanesljivost: doc.gps_zanesljivost,
    gps_vir: doc.gps_vir ?? null,
    gps_vir_id: doc.gps_vir_id ?? null,
    gps_vir_url: doc.gps_vir_url ?? null,
    gps_opomba: doc.gps_opomba ?? null,
    esd: doc.esd ?? null,
    esd_status: doc.esd_status,
    etapa: idRelacije(doc.etapa),
    zaporedje: doc.zaporedje ?? null,
    odsek: "",
    vkljucitev: doc.vkljucitev,
    iztocnica: doc.iztocnica,
    kljucna_tema: doc.kljucna_tema ?? "",
    zgodbe_predlog: doc.zgodbe_predlog ?? [],
    viri: (doc.viri ?? []).map((v) => v.url),
    qr_url: "",
    besedilo_kratko: doc.besedilo_kratko?.trim() ? doc.besedilo_kratko : null,
    besedilo_poglobljeno: poglobljeno(doc.besedilo_poglobljeno),
    napis: doc.napis?.trim() ? doc.napis.trim() : null,
    napis_iz_registra: doc.napis_iz_registra ?? true,
    foto: fotoIzMedie(doc.fotografije),
    kviz: Array.isArray(doc.kviz) ? (doc.kviz as Tocka["kviz"]) : [],
    status: statusIzDokumenta(doc),
    updated_at: doc.updatedAt ?? null,
    updated_by: null,
    foto_pravice_status: doc.foto_pravice_status,
    qr_generiran: doc.qr_generiran ?? false,
    qr_tablica_namescena: doc.qr_tablica_namescena ?? false,
    dovoljenje_qr: doc.dovoljenje_qr,
    strokovna_verifikacija: doc.strokovna_verifikacija,
    status_izvedbe: doc.status_izvedbe,
    odgovorna_oseba: doc.odgovorna_oseba ?? null,
    rok: doc.rok ? doc.rok.slice(0, 10) : null,
    napredek: doc.napredek ?? null,
    opombe: doc.opombe ?? null,
  };
}

export function etapaIzDokumenta(doc: EtapaDoc): Etapa {
  return {
    id: doc.id,
    stevilka: doc.stevilka,
    naziv: doc.naziv,
    odsek: doc.odsek ?? null,
    barva: doc.barva,
    opis: doc.opis ?? null,
    vidna: doc.vidna ?? true,
    updated_at: doc.updatedAt ?? null,
    updated_by: null,
  };
}
