/**
 * Admin view /admin/trase: the state of every stage route and connector,
 * and the »Ponovno izračunaj trase« action. Read fresh from the database,
 * so a point saved a moment ago shows its stage as stale here at once.
 */

import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import { redirect } from "next/navigation";
import { formatDistance, formatMinutes } from "@/lib/geo";
import { OZNAKE_STANJA, imeGradnika, oviraZaIzracun, stanjeTrasAliNapaka } from "@/cms/trase";
import { PreracunajTraseGumb } from "@/cms/components/PreracunajTraseGumb";

const BARVA_STANJA: Record<string, string> = {
  izracunano: "var(--theme-success-750)",
  zastarelo: "var(--theme-warning-750)",
  ni_izracunano: "var(--theme-elevation-600)",
  ni_uspelo: "var(--theme-error-750)",
};

const celica: React.CSSProperties = {
  padding: "calc(var(--base) * 0.5)",
  borderBottom: "1px solid var(--theme-elevation-100)",
  verticalAlign: "top",
  textAlign: "left",
};

function datum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Ljubljana" });
}

export async function TraseView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult;
  if (!req.user) redirect("/admin/login?redirect=%2Fadmin%2Ftrase");

  const stanje = await stanjeTrasAliNapaka();
  let vsebina: React.ReactNode;
  if ("napaka" in stanje) {
    vsebina = (
      <p role="alert" style={{ color: "var(--theme-error-750)" }}>
        Stanja tras ni bilo mogoče prebrati: {stanje.napaka}
      </p>
    );
  } else {
    const { etape, gradniki } = stanje;
    const ovira = oviraZaIzracun();
    const potrebujejo = gradniki.filter((g) => g.stanje !== "izracunano").length;
    vsebina = (
      <>
        <p style={{ maxWidth: "48rem" }}>
          Trasa etape se izračuna po pešpoteh skozi njena objavljena obeležja. Ko se obeležju spremeni lokacija, etapa ali
          zaporedje (in je sprememba objavljena), postane trasa njegove etape <strong>zastarela</strong>: javni zemljevid
          jo do ponovnega izračuna riše shematsko, s črtkano črto.
        </p>
        {ovira ? (
          <p role="alert" style={{ color: "var(--theme-error-750)", fontWeight: 600, maxWidth: "48rem" }}>
            {ovira}
          </p>
        ) : (
          <PreracunajTraseGumb potrebujejo={potrebujejo} />
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "var(--base)" }}>
          <caption style={{ textAlign: "left", fontWeight: 600, marginBottom: "calc(var(--base) * 0.5)" }}>
            {potrebujejo === 0 ? "Vse trase so izračunane." : `Trase, ki potrebujejo izračun: ${potrebujejo}`}
          </caption>
          <thead>
            <tr>
              <th style={celica}>Trasa</th>
              <th style={celica}>Stanje</th>
              <th style={celica}>Dolžina</th>
              <th style={celica}>Izračunano</th>
              <th style={celica}>Opombe</th>
            </tr>
          </thead>
          <tbody>
            {gradniki.map((g) => (
              <tr key={g.etapaIds.join("→")}>
                <td style={celica}>{imeGradnika(g, etape)}</td>
                <td style={{ ...celica, color: BARVA_STANJA[g.stanje], fontWeight: 600 }}>{OZNAKE_STANJA[g.stanje]}</td>
                <td style={celica}>
                  {g.dolzina_m !== null && g.trajanje_s !== null
                    ? `${formatDistance(g.dolzina_m)}, ${formatMinutes(Math.round(g.trajanje_s / 60))}`
                    : "—"}
                </td>
                <td style={celica}>{datum(g.izracunano_ob)}</td>
                <td style={celica}>
                  {[g.razlog, ...g.opozorila].filter(Boolean).map((o) => (
                    <div key={o}>{o}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1 style={{ marginTop: "calc(var(--base) * 2)" }}>Trase</h1>
        {vsebina}
      </Gutter>
    </DefaultTemplate>
  );
}
