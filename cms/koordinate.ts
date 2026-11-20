/**
 * Parses a pasted coordinate pair for the admin location field
 * (cms/components/LokacijaPolje.tsx), e.g. "45.799489, 15.156234" from a
 * phone or Google Maps. Decimal point or comma; comma, semicolon or space
 * between the two numbers. Pure, so scripts can test it without a browser.
 */

/** Generous bounding box of Slovenia — anything outside is a typo, not a memorial. */
const MEJE = { latMin: 45.4, latMax: 46.9, lonMin: 13.3, lonMax: 16.6 };

export type RezultatKoordinat =
  | { ok: true; lat: number; lon: number; zamenjano: boolean }
  | { ok: false; napaka: string };

const STEVILO = String.raw`(-?\d{1,3}(?:[.,]\d+)?)`;
const PAR = new RegExp(String.raw`^\s*${STEVILO}\s*°?\s*[NnSs]?\s*(?:[,;]\s*|\s+)${STEVILO}\s*°?\s*[EeWwVv]?\s*$`);

/** 6 decimals ≈ 0.1 m — finer than any phone fix. */
export function zaokrozi(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function vSloveniji(lat: number, lon: number): boolean {
  return lat >= MEJE.latMin && lat <= MEJE.latMax && lon >= MEJE.lonMin && lon <= MEJE.lonMax;
}

export function razberiKoordinate(vnos: string): RezultatKoordinat {
  const m = PAR.exec(vnos);
  if (!m) {
    return {
      ok: false,
      napaka: "Koordinat ni bilo mogoče prebrati. Vpiši dve decimalni števili, npr. »45.799489, 15.156234«.",
    };
  }
  const a = Number(m[1]!.replace(",", "."));
  const b = Number(m[2]!.replace(",", "."));
  if (vSloveniji(a, b)) return { ok: true, lat: zaokrozi(a), lon: zaokrozi(b), zamenjano: false };
  if (vSloveniji(b, a)) return { ok: true, lat: zaokrozi(b), lon: zaokrozi(a), zamenjano: true };
  return {
    ok: false,
    napaka: `Točka ${a}, ${b} ni v Sloveniji. Preveri, ali sta širina in dolžina pravilno prepisani.`,
  };
}
