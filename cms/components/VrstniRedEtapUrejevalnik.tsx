"use client";

/**
 * Stage order editor. Move buttons rather than drag-and-drop: fully
 * keyboard-operable, and unambiguous for an editor with a mouse too.
 * Saves the whole order at once (POST /api/vrstni-red-etap).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface EtapaVrstica {
  id: string;
  stevilka: number;
  naziv: string;
  odsek: string | null;
  barva: string;
}

export function VrstniRedEtapUrejevalnik({ etape, lahkoUreja }: { etape: EtapaVrstica[]; lahkoUreja: boolean }) {
  const router = useRouter();
  const [vrstni, setVrstni] = useState(etape);
  const [shranjujem, setShranjujem] = useState(false);
  const [sporocilo, setSporocilo] = useState<{ napaka: boolean; besedilo: string } | null>(null);
  const [, startTransition] = useTransition();

  const spremenjeno = vrstni.some((e, i) => e.id !== etape[i]?.id);

  function premakni(i: number, smer: -1 | 1) {
    const j = i + smer;
    if (j < 0 || j >= vrstni.length) return;
    const nov = [...vrstni];
    [nov[i], nov[j]] = [nov[j]!, nov[i]!];
    setVrstni(nov);
    setSporocilo({ napaka: false, besedilo: `${nov[j]!.naziv} je zdaj na ${j + 1}. mestu. Shrani, da se sprememba ohrani.` });
  }

  async function shrani() {
    setShranjujem(true);
    setSporocilo(null);
    try {
      const res = await fetch("/api/vrstni-red-etap", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: vrstni.map((e) => e.id) }),
      });
      const o = (await res.json().catch(() => ({}))) as { napaka?: string };
      if (!res.ok) {
        setSporocilo({ napaka: true, besedilo: o.napaka ?? `Shranjevanje ni uspelo (HTTP ${res.status}).` });
        return;
      }
      setSporocilo({
        napaka: false,
        besedilo:
          "Vrstni red je shranjen in javna stran osvežena. Povezave med etapami so zdaj zastarele — " +
          "izračunaj jih v pogledu Trase.",
      });
      startTransition(() => router.refresh());
    } catch {
      setSporocilo({ napaka: true, besedilo: "Strežnik se ni odzval. Preveri povezavo in poskusi znova." });
    } finally {
      setShranjujem(false);
    }
  }

  const gumb: React.CSSProperties = { margin: 0, minWidth: "2.5rem" };

  return (
    <section
      aria-labelledby="vrstni-red-etap-naslov"
      style={{
        border: "1px solid var(--theme-elevation-150)",
        borderRadius: "var(--style-radius-m)",
        padding: "var(--base)",
        marginBottom: "calc(var(--base) * 1.5)",
        maxWidth: "48rem",
      }}
    >
      <h2 id="vrstni-red-etap-naslov" style={{ margin: 0, fontSize: "1.15rem" }}>
        Vrstni red etap
      </h2>
      <p style={{ margin: "calc(var(--base) * 0.25) 0 calc(var(--base) * 0.75)" }}>
        {lahkoUreja
          ? "Vrstni red določa številko etape in potek obroča na zemljevidu. ID etape (npr. »etapa-3«) se ne spremeni, zato povezave in obeležja ostanejo na mestu."
          : "Vrstni red etap lahko spreminja samo skrbnik."}
      </p>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "calc(var(--base) * 0.25)" }}>
        {vrstni.map((e, i) => (
          <li key={e.id} style={{ display: "flex", alignItems: "center", gap: "calc(var(--base) * 0.5)" }}>
            <span style={{ width: "1.75rem", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              {i + 1}.
            </span>
            <span
              aria-hidden="true"
              style={{ width: "1rem", height: "1rem", borderRadius: "50%", backgroundColor: e.barva, flex: "none" }}
            />
            <span style={{ flex: 1 }}>
              {e.naziv}
              {e.odsek ? ` — ${e.odsek}` : ""}{" "}
              <span style={{ color: "var(--theme-elevation-500)" }}>({e.id})</span>
            </span>
            {lahkoUreja && (
              <>
                <button
                  type="button"
                  className="btn btn--style-secondary btn--size-small"
                  style={gumb}
                  onClick={() => premakni(i, -1)}
                  disabled={i === 0 || shranjujem}
                  aria-label={`Premakni ${e.naziv} navzgor`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn--style-secondary btn--size-small"
                  style={gumb}
                  onClick={() => premakni(i, 1)}
                  disabled={i === vrstni.length - 1 || shranjujem}
                  aria-label={`Premakni ${e.naziv} navzdol`}
                >
                  ↓
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
      {lahkoUreja && (
        <div style={{ display: "flex", gap: "calc(var(--base) * 0.5)", marginTop: "var(--base)", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn--style-primary btn--size-small"
            style={{ margin: 0 }}
            onClick={shrani}
            disabled={!spremenjeno || shranjujem}
            aria-busy={shranjujem}
          >
            {shranjujem ? "Shranjujem …" : "Shrani vrstni red"}
          </button>
          <button
            type="button"
            className="btn btn--style-secondary btn--size-small"
            style={{ margin: 0 }}
            onClick={() => {
              setVrstni(etape);
              setSporocilo(null);
            }}
            disabled={!spremenjeno || shranjujem}
          >
            Prekliči
          </button>
        </div>
      )}
      {sporocilo && (
        <p
          role={sporocilo.napaka ? "alert" : "status"}
          style={{
            margin: "calc(var(--base) * 0.5) 0 0",
            color: sporocilo.napaka ? "var(--theme-error-750)" : "var(--theme-elevation-800)",
          }}
        >
          {sporocilo.besedilo}
        </p>
      )}
    </section>
  );
}
