"use client";

/**
 * »Prenesi iz registra« buttons (PROMPT_PRENOS.md): on a memorial, and on a
 * stage for all its memorials in sequence. Both drive the step endpoint
 * /api/tocke/prenos-registra (cms/prenosRegistra.ts): one photo per
 * request, called again until the memorial's »konec« step, so no single
 * request runs into the hosting time limit. Nothing is published — the
 * result is a new draft version.
 */

import { useState } from "react";
import { Button, useFormModified } from "@payloadcms/ui";
import type {
  OdzivPrenosa,
  PreskocenaFotografija,
  StanjeBesedila,
  ZahtevekPrenosa,
} from "@/cms/prenosRegistra";

const POT = "/api/tocke/prenos-registra";
/** Guard against a loop that makes no progress; far above any memorial's photo count. */
const NAJVEC_KORAKOV = 100;

/** One memorial's run, summed over its steps. */
interface RezultatObelezja {
  id: string;
  naziv: string;
  opozorilo: string | null;
  /** null until the »konec« step arrived. */
  napis: StanjeBesedila | null;
  dostop: StanjeBesedila | null;
  vRegistru: number | null;
  uvozenih: number;
  zePripetih: number;
  pripetih: number;
  posodobljenaOpomba: number;
  preskocene: PreskocenaFotografija[];
  shranjenoB: number;
  skupajVShrambiB: number | null;
  spremenjeno: boolean;
  ustavljeno: string | null;
  /** The run broke off (server error, no response). Running again continues where it stopped. */
  napaka: string | null;
}

export interface Napredek {
  obdelanih: number;
  skupaj: number;
}

async function korak(zahtevek: ZahtevekPrenosa): Promise<OdzivPrenosa | { napaka: string }> {
  try {
    const res = await fetch(POT, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(zahtevek),
    });
    const o = (await res.json().catch(() => ({}))) as OdzivPrenosa & { napaka?: string };
    if (!res.ok) {
      return {
        napaka:
          o.napaka ??
          (res.status === 504
            ? "Strežnik je predolgo obdeloval fotografijo."
            : `Prenos ni uspel (HTTP ${res.status}).`),
      };
    }
    return o;
  } catch {
    return { napaka: "Strežnik se ni odzval. Preveri povezavo." };
  }
}

/** Calls the step endpoint until the memorial is finished. */
async function prenesiObelezje(
  id: string,
  naziv: string,
  obNapredku: (n: Napredek) => void,
): Promise<RezultatObelezja> {
  const r: RezultatObelezja = {
    id,
    naziv,
    opozorilo: null,
    napis: null,
    dostop: null,
    vRegistru: null,
    uvozenih: 0,
    zePripetih: 0,
    pripetih: 0,
    posodobljenaOpomba: 0,
    preskocene: [],
    shranjenoB: 0,
    skupajVShrambiB: null,
    spremenjeno: false,
    ustavljeno: null,
    napaka: null,
  };
  const preskoci: string[] = [];
  let zakljuci = false;

  for (let i = 0; i < NAJVEC_KORAKOV; i++) {
    const o = await korak({ id, preskoci, zakljuci });
    if ("napaka" in o) {
      r.napaka = `${o.napaka} Že uvožene fotografije so shranjene — ponovni zagon nadaljuje, kjer se je ustavil.`;
      return r;
    }
    r.naziv = o.naziv;
    r.opozorilo = o.opozorilo;
    r.skupajVShrambiB = o.skupajVShrambiB;

    if (o.korak === "konec") {
      r.napis = o.napis;
      r.dostop = o.dostop;
      r.vRegistru = o.vRegistru;
      r.zePripetih = o.zePripetih;
      r.pripetih = o.pripetih;
      r.posodobljenaOpomba = o.posodobljenaOpomba;
      r.preskocene.push(...o.preskocene);
      r.spremenjeno = o.spremenjeno;
      r.ustavljeno ??= o.ustavljeno;
      return r;
    }

    if (o.uvozena) {
      r.uvozenih++;
      r.shranjenoB += o.uvozena.shranjenoB;
    }
    if (o.preskocena) {
      r.preskocene.push(o.preskocena);
      preskoci.push(o.preskocena.url);
    }
    if (o.ustavljeno) {
      r.ustavljeno = o.ustavljeno;
      zakljuci = true;
    }
    if (!o.uvozena && !o.preskocena && !o.ustavljeno) {
      r.napaka = "Prenos ne napreduje — ustavljeno. Poskusi znova ali obvesti skrbnika.";
      return r;
    }
    const obdelanih = r.uvozenih + r.preskocene.length;
    obNapredku({ obdelanih, skupaj: obdelanih + o.preostalo });
  }
  r.napaka = "Preveč korakov — prenos je ustavljen. Ponovni zagon nadaljuje, kjer se je ustavil.";
  return r;
}

export function mb(b: number): string {
  return `${(b / 1024 / 1024).toLocaleString("sl-SI", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}

const BESEDILO: Record<StanjeBesedila, string> = {
  preneseno: "preneseno",
  "ze-izpolnjeno": "preskočeno, že izpolnjeno",
  "ni-v-registru": "register ga nima",
};

function niSprememb(r: RezultatObelezja): boolean {
  return !r.napaka && !r.spremenjeno && r.preskocene.length === 0 && r.posodobljenaOpomba === 0;
}

function PodrobnostiRezultata({ r }: { r: RezultatObelezja }) {
  const ponovnoPripetih = Math.max(0, r.pripetih - r.uvozenih);
  const fotoDeli = [`uvoženih ${r.uvozenih}`];
  if (r.zePripetih) fotoDeli.push(`že prej uvoženih ${r.zePripetih}`);
  if (ponovnoPripetih) fotoDeli.push(`ponovno pripetih ${ponovnoPripetih}`);
  if (r.posodobljenaOpomba) fotoDeli.push(`posodobljeno dovoljenje pri ${r.posodobljenaOpomba}`);
  fotoDeli.push(`preskočenih ${r.preskocene.length}`);
  return (
    <div style={{ display: "grid", gap: "calc(var(--base) * 0.25)" }}>
      {r.opozorilo ? (
        <p style={{ margin: 0, color: "var(--theme-warning-750)" }}>
          <strong>Ujemanje z registrom ni zanesljivo:</strong> {r.opozorilo}
        </p>
      ) : null}
      {niSprememb(r) ? <p style={{ margin: 0 }}>Ni sprememb — vse gradivo iz registra je že v zapisu.</p> : null}
      <ul style={{ margin: 0, paddingLeft: "1.25em" }}>
        <li>Napis: {r.napis ? BESEDILO[r.napis] : "ni obdelan (prenos se je prekinil)"}</li>
        <li>Kako do obeležja: {r.dostop ? BESEDILO[r.dostop] : "ni obdelano (prenos se je prekinil)"}</li>
        <li>
          Fotografije{r.vRegistru !== null ? ` (${r.vRegistru} v registru)` : ""}: {fotoDeli.join(", ")}
          {r.preskocene.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "1.25em" }}>
              {r.preskocene.map((p) => (
                <li key={p.url} style={{ overflowWrap: "anywhere" }}>
                  {p.url.split("/").pop()}: {p.razlog}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
        <li>
          Shranjeno: {mb(r.shranjenoB)}
          {r.skupajVShrambiB !== null ? ` (vse fotografije v shrambi: ${mb(r.skupajVShrambiB)})` : ""}
        </li>
      </ul>
      {r.ustavljeno ? (
        <p role="alert" style={{ margin: 0, color: "var(--theme-error-750)" }}>
          {r.ustavljeno}
        </p>
      ) : null}
      {r.napaka ? (
        <p role="alert" style={{ margin: 0, color: "var(--theme-error-750)" }}>
          {r.napaka}
        </p>
      ) : null}
    </div>
  );
}

function besediloNapredka(n: Napredek | null): string {
  if (!n || n.skupaj === 0) return "Pripravljam …";
  return `Fotografija ${Math.min(n.obdelanih + 1, n.skupaj)} od ${n.skupaj} …`;
}

/** On a memorial, inside the »Gradivo iz registra« panel. */
export function PrenesiIzRegistraGumb({ id }: { id: string }) {
  const spremenjeno = useFormModified();
  const [poteka, setPoteka] = useState(false);
  const [napredek, setNapredek] = useState<Napredek | null>(null);
  const [rezultat, setRezultat] = useState<RezultatObelezja | null>(null);

  async function zazeni() {
    setPoteka(true);
    setRezultat(null);
    setNapredek(null);
    setRezultat(await prenesiObelezje(id, id, setNapredek));
    setPoteka(false);
  }

  const novOsnutek = Boolean(rezultat?.spremenjeno);

  return (
    <div style={{ display: "grid", gap: "calc(var(--base) * 0.5)", justifyItems: "start" }}>
      <p className="field-description" style={{ margin: 0 }}>
        Prenese napis, opis dostopa in fotografije iz registra v <strong>osnutek</strong> tega obeležja. Izpolnjenih
        polj ne prepiše, že uvoženih fotografij ne podvoji. Objaviš sam, ko gradivo pregledaš.
      </p>
      <div>
        <Button
          buttonStyle="primary"
          size="small"
          margin={false}
          onClick={zazeni}
          disabled={poteka || spremenjeno || novOsnutek}
          aria-busy={poteka}
        >
          {poteka ? "Prenašam iz registra …" : "Prenesi iz registra"}
        </Button>
      </div>
      {spremenjeno && !poteka ? (
        <p className="field-description" style={{ margin: 0 }}>
          Obrazec ima neshranjene spremembe. Najprej jih shrani ali zavrzi, sicer bi jih prenos prepisal.
        </p>
      ) : null}
      {poteka && napredek && napredek.skupaj > 0 ? (
        <progress
          max={napredek.skupaj}
          value={napredek.obdelanih}
          aria-label="Napredek prenosa fotografij"
          style={{ width: "100%", maxWidth: "32rem" }}
        />
      ) : null}
      <div role="status" aria-live="polite">
        {poteka ? <p style={{ margin: 0 }}>{besediloNapredka(napredek)}</p> : null}
        {rezultat ? <PodrobnostiRezultata r={rezultat} /> : null}
      </div>
      {novOsnutek ? (
        <div style={{ display: "grid", gap: "calc(var(--base) * 0.25)" }}>
          <p style={{ margin: 0, color: "var(--theme-success-750)" }}>
            Shranjen je nov osnutek. Osveži stran, da ga vidiš v obrazcu, ga pregledaš in objaviš.
          </p>
          <div>
            <Button buttonStyle="secondary" size="small" margin={false} onClick={() => window.location.reload()}>
              Osveži stran
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** On a stage: every memorial of the stage, one after another. */
export function PrenosEtapeGumb({ tocke }: { tocke: { id: string; naziv: string; vRegistru: boolean }[] }) {
  const zRegistrom = tocke.filter((t) => t.vRegistru);
  const [poteka, setPoteka] = useState(false);
  const [trenutna, setTrenutna] = useState(0);
  const [napredek, setNapredek] = useState<Napredek | null>(null);
  const [rezultati, setRezultati] = useState<RezultatObelezja[]>([]);

  async function zazeni() {
    setPoteka(true);
    setRezultati([]);
    const zbrani: RezultatObelezja[] = [];
    for (let i = 0; i < zRegistrom.length; i++) {
      const t = zRegistrom[i]!;
      setTrenutna(i + 1);
      setNapredek(null);
      // A failure on one memorial is reported and the run continues.
      zbrani.push(await prenesiObelezje(t.id, t.naziv, setNapredek));
      setRezultati([...zbrani]);
      // After a storage stop the bucket is full for every memorial: don't keep downloading.
      if (zbrani.at(-1)?.ustavljeno?.startsWith("Uvoz je ustavljen")) break;
    }
    setPoteka(false);
  }

  const vsota = {
    napisov: rezultati.filter((r) => r.napis === "preneseno").length,
    dostopov: rezultati.filter((r) => r.dostop === "preneseno").length,
    uvozenih: rezultati.reduce((s, r) => s + r.uvozenih, 0),
    preskocenih: rezultati.reduce((s, r) => s + r.preskocene.length, 0),
    shranjeno: rezultati.reduce((s, r) => s + r.shranjenoB, 0),
    novihOsnutkov: rezultati.filter((r) => r.spremenjeno).length,
    neuspelih: rezultati.filter((r) => r.napaka).length,
  };
  const skupajVShrambi = [...rezultati].reverse().find((r) => r.skupajVShrambiB !== null)?.skupajVShrambiB;
  const trenutnaTocka = zRegistrom[trenutna - 1];

  return (
    <div style={{ display: "grid", gap: "calc(var(--base) * 0.5)" }}>
      <p className="field-description" style={{ margin: 0 }}>
        Za vsako obeležje te etape ({zRegistrom.length} z zapisom v registru
        {zRegistrom.length < tocke.length ? `, ${tocke.length - zRegistrom.length} brez` : ""}) prenese napis, opis
        dostopa in fotografije v <strong>osnutek</strong>. Ničesar ne objavi in ničesar ne prepiše. Obeležij, ki jih
        ima kdo prav zdaj odprta z neshranjenimi spremembami, med prenosom ne shranjuj.
      </p>
      <div>
        <Button
          buttonStyle="primary"
          size="small"
          margin={false}
          onClick={zazeni}
          disabled={poteka || zRegistrom.length === 0}
          aria-busy={poteka}
        >
          {poteka ? `Prenašam ${trenutna} od ${zRegistrom.length} …` : "Prenesi iz registra za vsa obeležja etape"}
        </Button>
      </div>
      {poteka || rezultati.length > 0 ? (
        <progress
          max={zRegistrom.length}
          value={rezultati.length}
          aria-label="Napredek prenosa po obeležjih"
          style={{ width: "100%", maxWidth: "32rem" }}
        />
      ) : null}
      <div role="status" aria-live="polite">
        {poteka && trenutnaTocka ? (
          <p style={{ margin: 0 }}>
            {trenutnaTocka.id} {trenutnaTocka.naziv}: {besediloNapredka(napredek)}
          </p>
        ) : null}
        {!poteka && rezultati.length > 0 ? (
          <p style={{ margin: 0 }}>
            <strong>Končano.</strong> Obeležij: {rezultati.length}, novih osnutkov: {vsota.novihOsnutkov}, napisov:{" "}
            {vsota.napisov}, opisov dostopa: {vsota.dostopov}, uvoženih fotografij: {vsota.uvozenih}, preskočenih:{" "}
            {vsota.preskocenih}, shranjeno {mb(vsota.shranjeno)}
            {skupajVShrambi != null ? ` (vse fotografije v shrambi: ${mb(skupajVShrambi)})` : ""}
            {vsota.neuspelih ? `, prekinjenih obeležij: ${vsota.neuspelih}` : ""}.
          </p>
        ) : null}
      </div>
      {rezultati.length > 0 ? (
        <ol style={{ margin: 0, paddingLeft: "1.25em", display: "grid", gap: "calc(var(--base) * 0.5)" }}>
          {rezultati.map((r) => (
            <li key={r.id}>
              <a href={`/admin/collections/tocke/${r.id}`}>
                {r.id} {r.naziv}
              </a>
              <PodrobnostiRezultata r={r} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
