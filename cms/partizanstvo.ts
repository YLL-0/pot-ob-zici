/**
 * Reference material from the public register partizanstvo.si
 * (data/partizanstvo.json, written by scripts/import-partizanstvo.ts).
 *
 * ADMIN ONLY. The JSON is bundled into the admin at build time — nothing
 * here fetches partizanstvo.si, and nothing on the public site may import
 * this module: the texts and photos are the register contributors' work
 * and need permission before publication (PROMPT_PARTIZANSTVO.md).
 */

import gradivo from "@/data/partizanstvo.json";

export interface SlikaRegistra {
  url: string;
  thumb: string | null;
  avtor: string | null;
  opis: string | null;
  licenca_v_registru: string | null;
  izvor_v_registru: string | null;
  /** Always "NEUREJENO" until permission is actually obtained. */
  pravice: string;
}

export interface GradivoRegistra {
  vir: string;
  vir_id: number;
  vir_url: string;
  naziv_v_registru: string | null;
  lat: number | null;
  lon: number | null;
  napis: string | null;
  dostop: string | null;
  vrsta: string | null;
  nastanek: string | null;
  avtor_obelezja: string | null;
  kataster: string | null;
  vnesel: string | null;
  povezave: string[];
  slike: SlikaRegistra[];
  opozorilo: string | null;
}

const obelezja = (gradivo as unknown as { obelezja: Record<string, GradivoRegistra> }).obelezja;

export const PRENESENO: string = (gradivo as { _preneseno?: string })._preneseno ?? "";

export function gradivoZaTocko(id: string): GradivoRegistra | null {
  return obelezja[id] ?? null;
}

/** Splits "K. o. …, parc. št. …, lastnik: …" into parcel and owner when the register names one. */
export function razcleniKataster(kataster: string | null): { parcela: string | null; lastnik: string | null } {
  if (!kataster) return { parcela: null, lastnik: null };
  const m = kataster.match(/^(.*?)[,;]?\s*lastnik\s*:?\s*(.+)$/i);
  if (m) return { parcela: m[1]?.trim() || null, lastnik: m[2]?.trim() || null };
  return { parcela: kataster, lastnik: null };
}
