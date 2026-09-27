/**
 * Filter/selection state for the map page, and its URL query-string
 * encoding. CLAUDE.md convention: filter state lives in the URL, not React
 * state — this module is the single place that knows the param names and
 * how to (de)serialize them, so the URL stays the source of truth.
 */

import type { Tocka, Vrsta, Zgodba } from "@/lib/types";

export interface FilterState {
  /** Free-text search over naziv + obmocje. */
  q: string;
  /** Selected stage numbers (1–8). Empty = no filter (show all). */
  etape: number[];
  vrste: Vrsta[];
  zgodbe: Zgodba[];
  /** "Samo osnovna trasa" toggle — restrict to the 13 core-trail points. */
  samoOsnovna: boolean;
  /** "Prikaži obrambni obroč 1942–43" toggle — off by default (Phase 3). */
  zica: boolean;
  /** Selected point ID, or null. Mutually exclusive with `pot`. */
  tocka: string | null;
  /** Selected trail slug, or null. Mutually exclusive with `tocka`. */
  pot: string | null;
}

export const EMPTY_FILTERS: FilterState = {
  q: "",
  etape: [],
  vrste: [],
  zgodbe: [],
  samoOsnovna: false,
  zica: false,
  tocka: null,
  pot: null,
};

const PARAM = {
  q: "q",
  etape: "etapa",
  vrste: "vrsta",
  zgodbe: "zgodba",
  samoOsnovna: "osnovna",
  zica: "zica",
  tocka: "tocka",
  pot: "pot",
} as const;

function parseIntList(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));
}

function parseStringList<T extends string>(raw: string | null): T[] {
  if (!raw) return [];
  return raw.split(",").filter(Boolean) as T[];
}

export function parseFilters(params: URLSearchParams): FilterState {
  return {
    q: params.get(PARAM.q) ?? "",
    etape: parseIntList(params.get(PARAM.etape)),
    vrste: parseStringList<Vrsta>(params.get(PARAM.vrste)),
    zgodbe: parseStringList<Zgodba>(params.get(PARAM.zgodbe)),
    samoOsnovna: params.get(PARAM.samoOsnovna) === "1",
    zica: params.get(PARAM.zica) === "1",
    tocka: params.get(PARAM.tocka),
    pot: params.get(PARAM.pot),
  };
}

/** Serializes filter state back to a query string (no leading "?"). */
export function serializeFilters(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.q) params.set(PARAM.q, state.q);
  if (state.etape.length > 0) params.set(PARAM.etape, state.etape.join(","));
  if (state.vrste.length > 0) params.set(PARAM.vrste, state.vrste.join(","));
  if (state.zgodbe.length > 0) params.set(PARAM.zgodbe, state.zgodbe.join(","));
  if (state.samoOsnovna) params.set(PARAM.samoOsnovna, "1");
  if (state.zica) params.set(PARAM.zica, "1");
  if (state.tocka) params.set(PARAM.tocka, state.tocka);
  if (state.pot) params.set(PARAM.pot, state.pot);
  return params.toString();
}

function isCoreTrail(tocka: Tocka): boolean {
  return tocka.vkljucitev.startsWith("Osnovna");
}

/** True if `tocka` is on an extended branch, far from the main 8-stage loop. */
export function isRazsirjeniKrak(tocka: Tocka): boolean {
  return tocka.vkljucitev.startsWith("Razširjeni");
}

export function filterTocke(points: Tocka[], filters: FilterState): Tocka[] {
  const q = filters.q.trim().toLowerCase();
  return points.filter((t) => {
    if (filters.samoOsnovna && !isCoreTrail(t)) return false;
    if (filters.etape.length > 0 && !filters.etape.includes(t.etapa)) return false;
    if (filters.vrste.length > 0 && !filters.vrste.includes(t.vrsta)) return false;
    if (filters.zgodbe.length > 0 && !t.zgodbe_predlog.some((z) => filters.zgodbe.includes(z))) return false;
    if (q.length > 0) {
      const haystack = `${t.naziv} ${t.obmocje}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}
