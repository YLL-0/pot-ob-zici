/**
 * Routing service: (re)computes cached routes and reports their state.
 * Server-only — called from `npm run trase` now, and from the admin in
 * Phase 4 steps 4–5 (after a save, via next/server `after()` so the save
 * itself never waits on ORS; and from "Ponovno izračunaj trase").
 *
 * The public map never calls this. It reads cached rows and composes them
 * (lib/trase.ts sestaviTraso).
 */

import { getEtape, getPoints } from "@/lib/data";
import { ORS_ENGINE, OrsNapaka, SNAP_RADIUS_M, orsDirections } from "@/lib/ors";
import {
  krakiIzRezultata,
  opozorilaTrase,
  stanjeGradnika,
  vrsticaZa,
  vsiGradniki,
  type Gradnik,
  type StanjeTrase,
} from "@/lib/trase";
import { getTraseRepo, type TraseRepo } from "@/lib/traseRepo";
import type { Etapa, Tocka, Trasa } from "@/lib/types";

/** Spacing between ORS requests — stays under a 40/min limit with margin. */
const PRIVZETI_ZAMIK_MS = 1600;

export interface StanjeGradnika {
  vrsta: Gradnik["vrsta"];
  etapaIds: string[];
  stanje: StanjeTrase;
  /** Why it failed (ni_uspelo) or why it wasn't attempted. */
  razlog: string | null;
  opozorila: string[];
  dolzina_m: number | null;
  trajanje_s: number | null;
  izracunano_ob: string | null;
}

interface Vir {
  etape?: Etapa[];
  points?: Tocka[];
  repo?: TraseRepo;
}

async function naloziVir(vir: Vir) {
  const [etape, points] = await Promise.all([vir.etape ?? getEtape(), vir.points ?? getPoints()]);
  return { etape, points, repo: vir.repo ?? getTraseRepo() };
}

function stanjeIzVrstice(gradnik: Gradnik, vrstice: Trasa[], razlog: string | null = null): StanjeGradnika {
  const vrstica = vrsticaZa(gradnik, vrstice);
  const stanje = stanjeGradnika(gradnik, vrstice);
  const aktualna = stanje === "izracunano" || stanje === "ni_uspelo";
  return {
    vrsta: gradnik.vrsta,
    etapaIds: gradnik.etapaIds,
    stanje,
    razlog: razlog ?? (aktualna ? (vrstica?.razlog ?? null) : null),
    opozorila:
      stanje === "izracunano" && vrstica && (gradnik.vrsta === "etapa" || gradnik.sosednji) ? opozorilaTrase(vrstica) : [],
    dolzina_m: stanje === "izracunano" ? (vrstica?.dolzina_m ?? null) : null,
    trajanje_s: stanje === "izracunano" ? (vrstica?.trajanje_s ?? null) : null,
    izracunano_ob: vrstica?.izracunano_ob ?? null,
  };
}

/** Current state of every building block, without any routing call. */
export async function stanjeTras(vir: Vir = {}): Promise<StanjeGradnika[]> {
  const { etape, points, repo } = await naloziVir(vir);
  const vrstice = await repo.vse();
  return vsiGradniki(etape, points).map((g) => stanjeIzVrstice(g, vrstice));
}

export interface MoznostiPreracuna extends Vir {
  /** Only these stages (and connectors touching them). Default: all. */
  etapaIds?: string[];
  /** Recompute even routes that are current ("Ponovno izračunaj"). */
  vse?: boolean;
  /** Skip connectors (stage routes only). */
  brezPovezav?: boolean;
  zamikMs?: number;
  onNapredek?: (stanje: StanjeGradnika) => void;
}

/**
 * Recomputes every building block that is stale, missing or failed (or
 * all of them with `vse`). Sequential and rate-spaced. A missing key or an
 * ORS rate limit stops the batch without writing anything — those are not
 * facts about the route, so they must not be cached as failures.
 */
export async function preracunajTrase(moznosti: MoznostiPreracuna = {}): Promise<StanjeGradnika[]> {
  const { etape, points, repo } = await naloziVir(moznosti);
  const zamikMs = moznosti.zamikMs ?? PRIVZETI_ZAMIK_MS;
  let gradniki = vsiGradniki(etape, points, moznosti.etapaIds);
  if (moznosti.brezPovezav) gradniki = gradniki.filter((g) => g.vrsta === "etapa");

  let vrstice = await repo.vse();
  const rezultati: StanjeGradnika[] = [];
  let ustavljeno: string | null = null;
  let prviZahtevek = true;

  const zabelezi = (stanje: StanjeGradnika) => {
    rezultati.push(stanje);
    moznosti.onNapredek?.(stanje);
  };
  const shrani = async (gradnik: Gradnik, trasa: Omit<Trasa, "id" | "kljuc" | "etapa_ids" | "engine" | "izracunano_ob">) => {
    await repo.shrani({
      kljuc: gradnik.kljuc,
      etapa_ids: gradnik.etapaIds,
      engine: ORS_ENGINE,
      izracunano_ob: new Date().toISOString(),
      ...trasa,
    });
    vrstice = await repo.vse();
  };

  for (const gradnik of gradniki) {
    if (!moznosti.vse && stanjeGradnika(gradnik, vrstice) === "izracunano") {
      zabelezi(stanjeIzVrstice(gradnik, vrstice));
      continue;
    }
    // Decided locally, no request needed — so it runs even after a stop.
    if (gradnik.waypoints.length < 2) {
      await shrani(gradnik, {
        geometry: null,
        dolzina_m: null,
        trajanje_s: null,
        status: "ni_uspelo",
        razlog: "Etapa ima manj kot dve objavljeni točki — trase ni mogoče izračunati.",
        kraki: null,
      });
      zabelezi(stanjeIzVrstice(gradnik, vrstice));
      continue;
    }

    if (ustavljeno) {
      zabelezi(stanjeIzVrstice(gradnik, vrstice, ustavljeno));
      continue;
    }

    if (!prviZahtevek) await new Promise((r) => setTimeout(r, zamikMs));
    prviZahtevek = false;

    try {
      const coords = gradnik.waypoints.map((p): [number, number] => [p.lon, p.lat]);
      const rezultat = await orsDirections(coords);
      await shrani(gradnik, {
        geometry: rezultat.geometry,
        dolzina_m: rezultat.distance,
        trajanje_s: rezultat.duration,
        status: "izracunano",
        razlog: null,
        kraki: krakiIzRezultata(gradnik.waypoints, rezultat.segments, rezultat.geometry.coordinates, rezultat.wayPoints),
      });
      zabelezi(stanjeIzVrstice(gradnik, vrstice));
    } catch (err) {
      if (!(err instanceof OrsNapaka)) throw err;
      if (err.koda === "NI_KLJUCA" || err.koda === "OMEJITEV") {
        ustavljeno = err.message;
        zabelezi(stanjeIzVrstice(gradnik, vrstice, err.message));
        continue;
      }
      const tocka = err.indeksTocke !== undefined ? gradnik.waypoints[err.indeksTocke] : undefined;
      const razlog = tocka
        ? `${tocka.id} (${tocka.naziv}) je več kot ${SNAP_RADIUS_M} m od najbližje mapirane poti — preveri koordinate.`
        : err.message;
      await shrani(gradnik, {
        geometry: null,
        dolzina_m: null,
        trajanje_s: null,
        status: "ni_uspelo",
        razlog,
        kraki: null,
      });
      zabelezi(stanjeIzVrstice(gradnik, vrstice));
    }
  }
  return rezultati;
}
