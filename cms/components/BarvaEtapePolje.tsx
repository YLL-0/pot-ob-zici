"use client";

/**
 * Colour picker for a stage's `barva` (PROMPT_ADMIN.md "etape … barva
 * (colour picker)"). Native colour input + the hex value, a preview of the
 * marker and the stage chip as the public site draws them, and live
 * warnings from lib/barvePreverba.ts: contrast with the marker icon, and
 * colours too close to another stage (also under colour-vision
 * deficiencies). Warnings advise, they don't block — the format check
 * in cms/collections/Etape.ts is the only hard rule.
 */

import { useEffect, useMemo, useState } from "react";
import { FieldDescription, FieldError, useDocumentInfo, useField, useFormFields } from "@payloadcms/ui";
import { HEX, IKONA, MEJA_KONTRAST, VIDI, preveriBarvo, type PrimerjanaEtapa } from "@/lib/barvePreverba";
import { besediloNaBarvi } from "@/lib/etape";

interface EtapaVnos {
  id: string;
  stevilka: number;
  naziv: string;
  barva: string;
}

export function BarvaEtapePolje() {
  const { value, setValue, showError, errorMessage, disabled } = useField<string>({ path: "barva" });
  const { id } = useDocumentInfo();
  const stevilka = useFormFields(([fields]) => fields.stevilka?.value as number | undefined);
  const [ostale, setOstale] = useState<EtapaVnos[]>([]);

  useEffect(() => {
    let preklicano = false;
    fetch("/api/etape?limit=0&depth=0&sort=stevilka", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((j: { docs?: EtapaVnos[] }) => {
        if (!preklicano) setOstale(j.docs ?? []);
      })
      .catch(() => {});
    return () => {
      preklicano = true;
    };
  }, []);

  const barva = typeof value === "string" ? value : "";
  const veljavna = HEX.test(barva);

  const preverba = useMemo(() => {
    if (!veljavna) return null;
    const druge = ostale.filter((e) => e.id !== id).sort((a, b) => a.stevilka - b.stevilka);
    // Ring neighbours: the stages just before and after this one by number, wrapping.
    const vse = [...druge.map((e) => e.stevilka), stevilka ?? Number.MAX_SAFE_INTEGER].sort((a, b) => a - b);
    const i = vse.indexOf(stevilka ?? Number.MAX_SAFE_INTEGER);
    const sosedi = new Set([vse[(i - 1 + vse.length) % vse.length], vse[(i + 1) % vse.length]]);
    const primerjane: PrimerjanaEtapa[] = druge.map((e) => ({
      ime: `${e.naziv}`,
      barva: e.barva,
      sosednja: vse.length > 2 && sosedi.has(e.stevilka),
    }));
    return preveriBarvo(barva, primerjane);
  }, [barva, veljavna, ostale, id, stevilka]);

  return (
    <div className="field-type" style={{ display: "grid", gap: "calc(var(--base) * 0.5)", marginBottom: "var(--base)" }}>
      <label className="field-label" htmlFor="barva-etape-hex">
        Barva <span className="required">*</span>
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "calc(var(--base) * 0.75)" }}>
        <input
          type="color"
          aria-label="Izberi barvo etape"
          value={veljavna ? barva.toLowerCase() : "#000000"}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          style={{ width: "3rem", height: "2.5rem", padding: 0, border: "1px solid var(--theme-elevation-150)" }}
        />
        <input
          id="barva-etape-hex"
          type="text"
          value={barva}
          onChange={(e) => setValue(e.target.value.trim())}
          disabled={disabled}
          placeholder="#2c7c96"
          maxLength={7}
          spellCheck={false}
          style={{ width: "8rem", fontFamily: "monospace" }}
          aria-invalid={showError || undefined}
          aria-describedby="barva-etape-opis"
        />
        {veljavna && (
          <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: "calc(var(--base) * 0.5)" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                backgroundColor: barva,
                color: IKONA,
                fontWeight: 700,
              }}
            >
              {stevilka ?? "?"}
            </span>
            <span
              style={{
                borderRadius: "999px",
                padding: "0.25rem 0.75rem",
                backgroundColor: barva,
                color: besediloNaBarvi(barva) === "svetlo" ? "white" : "black",
                fontWeight: 500,
              }}
            >
              Etapa {stevilka ?? ""}
            </span>
          </div>
        )}
      </div>
      <span id="barva-etape-opis">
        <FieldDescription
          path="barva"
          description="Barva oznak, črte in vrstice etape. Izberi jo v izbirniku ali vpiši v obliki #rrggbb."
        />
      </span>
      <FieldError path="barva" message={errorMessage} showError={showError} />
      {preverba && (
        <div role="status" style={{ display: "grid", gap: "calc(var(--base) * 0.25)" }}>
          {preverba.kontrastOk ? (
            <p style={{ margin: 0, color: "var(--theme-success-750)" }}>
              Bela ikona na oznaki je dobro vidna (kontrast {preverba.kontrastZIkono.toFixed(1).replace(".", ",")} : 1).
            </p>
          ) : (
            <p style={{ margin: 0, color: "var(--theme-warning-750)" }}>
              Bela ikona na oznaki bo slabo vidna: kontrast {preverba.kontrastZIkono.toFixed(1).replace(".", ",")} : 1,
              priporočeno vsaj {MEJA_KONTRAST} : 1. Izberi temnejšo barvo.
            </p>
          )}
          {preverba.konflikti.length === 0 ? (
            ostale.length > 0 && (
              <p style={{ margin: 0, color: "var(--theme-success-750)" }}>
                Barva se dovolj razlikuje od drugih etap, tudi pri barvni slepoti.
              </p>
            )
          ) : (
            <div style={{ color: "var(--theme-warning-750)" }}>
              <p style={{ margin: 0 }}>Barva je preblizu barvam drugih etap:</p>
              <ul style={{ margin: 0 }}>
                {preverba.konflikti.map((k) => (
                  <li key={k.ime}>
                    {k.ime}
                    {k.sosednja ? " (sosednja na poti)" : ""} — {VIDI[k.vid]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
