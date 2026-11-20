/**
 * Server field in a point's »Etapa« tab: the state of this point's stage
 * route (and the connectors to its neighbours), read fresh from the
 * database. After a published move it reads »Zastarela« with a link to
 * the Trase view — the visible half of "dragging the pin marks the
 * stage's trail stale".
 */

import type { UIFieldServerProps } from "payload";
import Link from "next/link";
import { OZNAKE_STANJA, imeGradnika, stanjeTrasAliNapaka } from "@/cms/trase";

function idRelacije(ref: unknown): string | null {
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object" && "id" in ref) return String((ref as { id: unknown }).id);
  return null;
}

export async function TrasaTocke({ data }: UIFieldServerProps) {
  const etapaId = idRelacije(data?.etapa);
  if (!etapaId) {
    return <p className="field-description">Obeležje ni v nobeni etapi, zato ni del nobene trase.</p>;
  }
  const stanje = await stanjeTrasAliNapaka();
  if ("napaka" in stanje) {
    return (
      <p role="alert" style={{ color: "var(--theme-error-750)" }}>
        Stanja trase ni bilo mogoče prebrati: {stanje.napaka}
      </p>
    );
  }
  const { etape, gradniki } = stanje;
  const zadevajo = gradniki.filter((g) => g.etapaIds.includes(etapaId));
  const vrstice = zadevajo.map((g) => (
    <li key={g.etapaIds.join("→")}>
      {imeGradnika(g, etape)}: <strong>{OZNAKE_STANJA[g.stanje]}</strong>
    </li>
  ));
  const zastarele = zadevajo.some((g) => g.stanje !== "izracunano");
  return (
    <div className="field-type" style={{ marginBottom: "var(--base)" }}>
      <span className="field-label">Trasa etape</span>
      <ul style={{ margin: "calc(var(--base) * 0.25) 0" }}>{vrstice}</ul>
      <p className="field-description" style={{ margin: 0 }}>
        Stanje velja za objavljeno različico.{" "}
        {zastarele ? (
          <>
            Zastarelo traso izračunaš v pogledu <Link href="/admin/trase">Trase</Link>.
          </>
        ) : (
          "Če premakneš obeležje ali mu spremeniš zaporedje, bo trasa po objavi zastarela."
        )}
      </p>
    </div>
  );
}
