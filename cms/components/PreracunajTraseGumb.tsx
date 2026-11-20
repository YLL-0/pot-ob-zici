"use client";

/** »Ponovno izračunaj trase« — POSTs to /api/trase/preracunaj (cms/trase.ts), then refreshes the view. */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Odgovor {
  napaka?: string;
  izracunanih?: number;
  neuspelih?: number;
  neizvedenih?: number;
  ustavljeno?: string | null;
}

export function PreracunajTraseGumb({ potrebujejo }: { potrebujejo: number }) {
  const router = useRouter();
  const [poteka, setPoteka] = useState(false);
  const [vse, setVse] = useState(false);
  const [sporocilo, setSporocilo] = useState<{ napaka: boolean; besedilo: string } | null>(null);
  const [, startTransition] = useTransition();

  async function preracunaj() {
    setPoteka(true);
    setSporocilo(null);
    try {
      const res = await fetch("/api/trase/preracunaj", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vse }),
      });
      const o = (await res.json().catch(() => ({}))) as Odgovor;
      if (!res.ok) {
        setSporocilo({ napaka: true, besedilo: o.napaka ?? `Izračun ni uspel (HTTP ${res.status}).` });
      } else {
        const deli = [`izračunanih ${o.izracunanih ?? 0}`];
        if (o.neuspelih) deli.push(`neuspelih ${o.neuspelih} (razlog je v tabeli)`);
        if (o.neizvedenih) deli.push(`neizvedenih ${o.neizvedenih}`);
        setSporocilo({
          napaka: Boolean(o.ustavljeno || o.neuspelih),
          besedilo: `Končano: ${deli.join(", ")}.${o.ustavljeno ? ` Izračun je bil ustavljen: ${o.ustavljeno}` : ""} Javni zemljevid je osvežen.`,
        });
      }
    } catch {
      setSporocilo({ napaka: true, besedilo: "Strežnik se ni odzval. Preveri povezavo in poskusi znova." });
    } finally {
      setPoteka(false);
      startTransition(() => router.refresh());
    }
  }

  return (
    <div style={{ display: "grid", gap: "calc(var(--base) * 0.5)", maxWidth: "48rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--base)" }}>
        <button
          type="button"
          className="btn btn--style-primary btn--size-medium"
          style={{ margin: 0 }}
          onClick={preracunaj}
          disabled={poteka || (potrebujejo === 0 && !vse)}
          aria-busy={poteka}
        >
          {poteka ? "Računam trase …" : "Ponovno izračunaj trase"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: "calc(var(--base) * 0.25)" }}>
          <input type="checkbox" checked={vse} onChange={(e) => setVse(e.target.checked)} disabled={poteka} />
          Izračunaj znova tudi trase, ki so že aktualne
        </label>
      </div>
      {poteka && <p role="status">Izračun lahko traja do pol minute — med trasami je premor zaradi omejitve storitve.</p>}
      {sporocilo && (
        <p
          role={sporocilo.napaka ? "alert" : "status"}
          style={{ margin: 0, color: sporocilo.napaka ? "var(--theme-error-750)" : "var(--theme-success-750)" }}
        >
          {sporocilo.besedilo}
        </p>
      )}
    </div>
  );
}
