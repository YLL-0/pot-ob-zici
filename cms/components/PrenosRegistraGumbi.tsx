"use client";

/**
 * »Prenesi iz registra« buttons (PROMPT_PRENOS.md): on a memorial, and on a
 * stage for all its memorials in sequence. Both POST to
 * /api/tocke/prenos-registra (cms/prenosRegistra.ts), one memorial per
 * request. Nothing is published — the result is a new draft version.
 */

import { useState } from "react";
import { Button, useFormModified } from "@payloadcms/ui";
import type { RezultatPrenosa, StanjeBesedila } from "@/cms/prenosRegistra";

const POT = "/api/tocke/prenos-registra";

type Odziv = { ok: true; r: RezultatPrenosa } | { ok: false; id: string; napaka: string };

async function prenesi(id: string): Promise<Odziv> {
  try {
    const res = await fetch(POT, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const o = (await res.json().catch(() => ({}))) as RezultatPrenosa & { napaka?: string };
    if (!res.ok) return { ok: false, id, napaka: o.napaka ?? `Prenos ni uspel (HTTP ${res.status}).` };
    return { ok: true, r: o };
  } catch {
    return { ok: false, id, napaka: "Strežnik se ni odzval. Preveri povezavo in poskusi znova." };
  }
}

export function mb(b: number): string {
  return `${(b / 1024 / 1024).toLocaleString("sl-SI", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}

const BESEDILO: Record<StanjeBesedila, string> = {
  preneseno: "preneseno",
  "ze-izpolnjeno": "preskočeno, že izpolnjeno",
  "ni-v-registru": "register ga nima",
};

function niSprememb(r: RezultatPrenosa): boolean {
  return !r.spremenjeno && r.fotografije.preskocene.length === 0 && r.fotografije.posodobljenaOpomba === 0;
}

function PodrobnostiRezultata({ r }: { r: RezultatPrenosa }) {
  const f = r.fotografije;
  const fotoDeli = [`uvoženih ${f.uvozenih}`];
  if (f.zeUvozenih) fotoDeli.push(`že uvoženih ${f.zeUvozenih}`);
  if (f.ponovnoPripetih) fotoDeli.push(`ponovno pripetih ${f.ponovnoPripetih}`);
  if (f.posodobljenaOpomba) fotoDeli.push(`posodobljeno dovoljenje pri ${f.posodobljenaOpomba}`);
  fotoDeli.push(`preskočenih ${f.preskocene.length}`);
  return (
    <div style={{ display: "grid", gap: "calc(var(--base) * 0.25)" }}>
      {r.opozorilo ? (
        <p style={{ margin: 0, color: "var(--theme-warning-750)" }}>
          <strong>Ujemanje z registrom ni zanesljivo:</strong> {r.opozorilo}
        </p>
      ) : null}
      {niSprememb(r) ? (
        <p style={{ margin: 0 }}>Ni sprememb — vse gradivo iz registra je že v zapisu.</p>
      ) : null}
      <ul style={{ margin: 0, paddingLeft: "1.25em" }}>
        <li>Napis: {BESEDILO[r.napis]}</li>
        <li>Kako do obeležja: {BESEDILO[r.dostop]}</li>
        <li>
          Fotografije ({f.vRegistru} v registru): {fotoDeli.join(", ")}
          {f.preskocene.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "1.25em" }}>
              {f.preskocene.map((p) => (
                <li key={p.url} style={{ overflowWrap: "anywhere" }}>
                  {p.url.split("/").pop()}: {p.razlog}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
        <li>Shranjeno: {mb(r.shranjenoB)} (vse fotografije v shrambi: {mb(r.skupajVShrambiB)})</li>
      </ul>
      {r.ustavljeno ? (
        <p role="alert" style={{ margin: 0, color: "var(--theme-error-750)" }}>
          {r.ustavljeno}
        </p>
      ) : null}
    </div>
  );
}

/** On a memorial, inside the »Gradivo iz registra« panel. */
export function PrenesiIzRegistraGumb({ id }: { id: string }) {
  const spremenjeno = useFormModified();
  const [poteka, setPoteka] = useState(false);
  const [odziv, setOdziv] = useState<Odziv | null>(null);

  async function zazeni() {
    setPoteka(true);
    setOdziv(null);
    const o = await prenesi(id);
    setOdziv(o);
    setPoteka(false);
  }

  const novOsnutek = odziv?.ok && odziv.r.spremenjeno;

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
          disabled={poteka || spremenjeno || Boolean(novOsnutek)}
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
      <div role="status" aria-live="polite">
        {poteka ? <p style={{ margin: 0 }}>Fotografije se prenašajo ena za drugo — to lahko traja pol minute.</p> : null}
        {odziv && !odziv.ok ? (
          <p role="alert" style={{ margin: 0, color: "var(--theme-error-750)" }}>
            {odziv.napaka}
          </p>
        ) : null}
        {odziv?.ok ? <PodrobnostiRezultata r={odziv.r} /> : null}
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
  const [odzivi, setOdzivi] = useState<Odziv[]>([]);

  async function zazeni() {
    setPoteka(true);
    setOdzivi([]);
    const zbrani: Odziv[] = [];
    for (let i = 0; i < zRegistrom.length; i++) {
      setTrenutna(i + 1);
      // A failure on one memorial is reported and the run continues.
      zbrani.push(await prenesi(zRegistrom[i]!.id));
      setOdzivi([...zbrani]);
    }
    setPoteka(false);
  }

  const uspesni = odzivi.filter((o): o is Extract<Odziv, { ok: true }> => o.ok).map((o) => o.r);
  const vsota = {
    napisov: uspesni.filter((r) => r.napis === "preneseno").length,
    dostopov: uspesni.filter((r) => r.dostop === "preneseno").length,
    uvozenih: uspesni.reduce((s, r) => s + r.fotografije.uvozenih, 0),
    preskocenih: uspesni.reduce((s, r) => s + r.fotografije.preskocene.length, 0),
    shranjeno: uspesni.reduce((s, r) => s + r.shranjenoB, 0),
    novihOsnutkov: uspesni.filter((r) => r.spremenjeno).length,
    neuspelih: odzivi.length - uspesni.length,
  };
  const skupajVShrambi = uspesni.at(-1)?.skupajVShrambiB;

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
      {poteka || odzivi.length > 0 ? (
        <progress
          max={zRegistrom.length}
          value={odzivi.length}
          aria-label="Napredek prenosa"
          style={{ width: "100%", maxWidth: "32rem" }}
        />
      ) : null}
      <div role="status" aria-live="polite">
        {!poteka && odzivi.length > 0 ? (
          <p style={{ margin: 0 }}>
            <strong>Končano.</strong> Obeležij: {odzivi.length}, novih osnutkov: {vsota.novihOsnutkov}, napisov:{" "}
            {vsota.napisov}, opisov dostopa: {vsota.dostopov}, uvoženih fotografij: {vsota.uvozenih}, preskočenih:{" "}
            {vsota.preskocenih}, shranjeno {mb(vsota.shranjeno)}
            {skupajVShrambi !== undefined ? ` (vse fotografije v shrambi: ${mb(skupajVShrambi)})` : ""}
            {vsota.neuspelih ? `, neuspelih obeležij: ${vsota.neuspelih}` : ""}.
          </p>
        ) : null}
      </div>
      {odzivi.length > 0 ? (
        <ol style={{ margin: 0, paddingLeft: "1.25em", display: "grid", gap: "calc(var(--base) * 0.5)" }}>
          {odzivi.map((o) => {
            const id = o.ok ? o.r.id : o.id;
            const naziv = o.ok ? o.r.naziv : tocke.find((t) => t.id === id)?.naziv;
            return (
              <li key={id}>
                <a href={`/admin/collections/tocke/${id}`}>
                  {id} {naziv}
                </a>
                {o.ok ? (
                  <PodrobnostiRezultata r={o.r} />
                ) : (
                  <p role="alert" style={{ margin: 0, color: "var(--theme-error-750)" }}>
                    {o.napaka}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
