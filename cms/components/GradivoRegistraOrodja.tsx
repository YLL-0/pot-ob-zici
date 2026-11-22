"use client";

/**
 * Interactive bits of the »Gradivo iz registra« panel: copying text to the
 * clipboard, and placing the register's inscription into the
 * »Poglobljeno besedilo« editor as a starting point. Nothing is saved —
 * the editor still has to review, write around it and save a draft.
 */

import { useState } from "react";
import { Button, useForm, useFormFields } from "@payloadcms/ui";

const POT_POGLOBLJENO = "besedilo_poglobljeno";

export function KopirajGumb({ besedilo, oznaka }: { besedilo: string; oznaka: string }) {
  const [stanje, setStanje] = useState<"" | "ok" | "napaka">("");
  async function kopiraj() {
    try {
      await navigator.clipboard.writeText(besedilo);
      setStanje("ok");
    } catch {
      setStanje("napaka");
    }
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "calc(var(--base) * 0.5)" }}>
      <Button buttonStyle="secondary" size="small" margin={false} onClick={kopiraj} aria-label={oznaka}>
        Kopiraj
      </Button>
      <span role="status" className="field-description" style={{ margin: 0 }}>
        {stanje === "ok" ? "Kopirano." : stanje === "napaka" ? "Kopiranje ni uspelo — označi besedilo in ga kopiraj ročno." : ""}
      </span>
    </span>
  );
}

type LexicalNode = Record<string, unknown>;

function besediloVOdstavke(besedilo: string): LexicalNode[] {
  return besedilo
    .split(/\n{2,}/)
    .map((odstavek) => odstavek.trim())
    .filter(Boolean)
    .map((odstavek) => {
      const children: LexicalNode[] = [];
      odstavek.split("\n").forEach((vrstica, i) => {
        if (i > 0) children.push({ type: "linebreak", version: 1 });
        children.push({ type: "text", version: 1, text: vrstica, format: 0, style: "", mode: "normal", detail: 0 });
      });
      return {
        type: "paragraph",
        version: 1,
        children,
        direction: "ltr",
        format: "",
        indent: 0,
        textFormat: 0,
        textStyle: "",
      };
    });
}

function jePrazno(vrednost: unknown): boolean {
  const otroci = (vrednost as { root?: { children?: LexicalNode[] } } | null)?.root?.children ?? [];
  return otroci.every((o) => !Array.isArray(o.children) || (o.children as unknown[]).length === 0);
}

export function PrenesiNapisGumb({ napis }: { napis: string }) {
  const { dispatchFields, setModified } = useForm();
  const polje = useFormFields(([fields]) => fields[POT_POGLOBLJENO]);
  const [sporocilo, setSporocilo] = useState("");

  function prenesi() {
    if (!polje) return;
    const trenutno = polje.value as { root?: Record<string, unknown> & { children?: LexicalNode[] } } | null;
    const prazno = jePrazno(trenutno);
    const obstojeci = prazno ? [] : (trenutno?.root?.children ?? []);
    const nova = {
      root: {
        type: "root",
        version: 1,
        direction: "ltr",
        format: "",
        indent: 0,
        ...(prazno ? {} : trenutno?.root),
        children: [...obstojeci, ...besediloVOdstavke(napis)],
      },
    };
    // Setting initialValue too makes the Lexical field re-mount with the
    // new content (it ignores value-only changes from outside).
    dispatchFields({ type: "UPDATE", path: POT_POGLOBLJENO, value: nova, initialValue: nova });
    setModified(true);
    setSporocilo(
      prazno
        ? "Napis je vstavljen v poglobljeno besedilo. Preveri ga, dopiši besedilo in shrani osnutek."
        : "Napis je dodan na konec poglobljenega besedila. Preveri ga, dopiši besedilo in shrani osnutek.",
    );
  }

  return (
    <div style={{ display: "grid", gap: "calc(var(--base) * 0.25)", justifyItems: "start" }}>
      <Button buttonStyle="secondary" size="small" margin={false} onClick={prenesi} disabled={!polje}>
        Prenesi v poglobljeno besedilo
      </Button>
      <span role="status" className="field-description" style={{ margin: 0 }}>
        {sporocilo}
      </span>
    </div>
  );
}
