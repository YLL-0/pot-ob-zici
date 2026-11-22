/**
 * Read-only »Gradivo iz registra« panel in a point's »Vsebina« tab:
 * reference material from partizanstvo.si (PROMPT_PARTIZANSTVO.md).
 *
 * Nothing here is published or saved. The data is bundled at build time
 * from data/partizanstvo.json; thumbnails are shown straight from the
 * register (never copied into our storage) and are all marked as having
 * unresolved rights.
 */

import type { UIFieldServerProps } from "payload";
import { PRENESENO, gradivoZaTocko, razcleniKataster } from "@/cms/partizanstvo";
import { KopirajGumb, PrenesiNapisGumb } from "@/cms/components/GradivoRegistraOrodja";

const razmik = "calc(var(--base) * 0.5)";

const okvir: React.CSSProperties = {
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: "var(--style-radius-m)",
  padding: "var(--base)",
  display: "grid",
  gap: "var(--base)",
  marginBottom: "var(--base)",
};

const poudarjeno: React.CSSProperties = {
  border: "2px solid var(--theme-elevation-400)",
  background: "var(--theme-elevation-50)",
  borderRadius: "var(--style-radius-m)",
  padding: "calc(var(--base) * 0.75)",
  display: "grid",
  gap: razmik,
};

const opozorilo: React.CSSProperties = {
  border: "2px solid var(--theme-warning-500)",
  background: "var(--theme-warning-100)",
  color: "var(--theme-text)",
  borderRadius: "var(--style-radius-m)",
  padding: "calc(var(--base) * 0.75)",
  margin: 0,
};

const predOblikovano: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  fontFamily: "inherit",
  margin: 0,
  padding: "calc(var(--base) * 0.75)",
  background: "var(--theme-elevation-50)",
  borderRadius: "var(--style-radius-s)",
};

function Vrstica({ oznaka, children }: { oznaka: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "calc(var(--base) * 0.2)" }}>
      <dt style={{ fontWeight: 600 }}>{oznaka}</dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}

const niNavedeno = <span style={{ color: "var(--theme-elevation-600)" }}>V registru ni navedeno.</span>;

function datum(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export function GradivoRegistra({ data }: UIFieldServerProps) {
  const id = typeof data?.id === "string" ? data.id : null;
  const g = id ? gradivoZaTocko(id) : null;

  if (!g) {
    return (
      <section aria-labelledby="gradivo-registra-naslov" style={okvir}>
        <h3 id="gradivo-registra-naslov" style={{ margin: 0 }}>
          Gradivo iz registra
        </h3>
        <p className="field-description" style={{ margin: 0 }}>
          Za to obeležje ni zapisa iz registra partizanstvo.si.
        </p>
      </section>
    );
  }

  const { parcela, lastnik } = razcleniKataster(g.kataster);

  return (
    <section aria-labelledby="gradivo-registra-naslov" style={okvir}>
      <div style={{ display: "grid", gap: "calc(var(--base) * 0.25)" }}>
        <h3 id="gradivo-registra-naslov" style={{ margin: 0 }}>
          Gradivo iz registra
        </h3>
        <p className="field-description" style={{ margin: 0 }}>
          Referenčno gradivo iz javnega registra{" "}
          <a href={g.vir_url} target="_blank" rel="noopener noreferrer">
            partizanstvo.si (zapis {g.vir_id}
            {g.naziv_v_registru ? `: »${g.naziv_v_registru}«` : ""})
          </a>
          {PRENESENO ? `, preneseno ${datum(PRENESENO)}` : ""}. <strong>Ni za objavo.</strong> Besedila in
          fotografije so avtorsko delo prispevateljev registra — na javno stran gre le tisto, kar urednik zavestno
          prenese in za kar je urejeno dovoljenje. Na tej plošči se nič ne shrani.
        </p>
      </div>

      {g.opozorilo ? (
        <p role="note" style={opozorilo}>
          <strong>Ujemanje z registrom ni zanesljivo.</strong> {g.opozorilo}
        </p>
      ) : null}

      <div style={poudarjeno}>
        <strong>Dovoljenje za namestitev QR-tablice — katastrski podatki</strong>
        {g.kataster ? (
          <>
            <dl style={{ display: "grid", gap: razmik, margin: 0 }}>
              <Vrstica oznaka="Parcela">{parcela ?? niNavedeno}</Vrstica>
              <Vrstica oznaka="Lastnik">
                {lastnik ?? (
                  <span style={{ color: "var(--theme-elevation-600)" }}>
                    V registru ni naveden — lastnika parcele je treba poiskati posebej.
                  </span>
                )}
              </Vrstica>
            </dl>
            <div>
              <KopirajGumb besedilo={g.kataster} oznaka="Kopiraj katastrske podatke" />
            </div>
          </>
        ) : (
          <p style={{ margin: 0 }}>Register za to obeležje nima katastrskih podatkov.</p>
        )}
      </div>

      <div style={{ display: "grid", gap: razmik }}>
        <strong>Napis na obeležju (prepis iz registra)</strong>
        {g.napis ? (
          <>
            <pre style={predOblikovano}>{g.napis}</pre>
            <p className="field-description" style={{ margin: 0 }}>
              Osnutek prepisa — pred objavo ga preveri na obeležju.
            </p>
            <PrenesiNapisGumb napis={g.napis} />
          </>
        ) : (
          <p style={{ margin: 0 }}>Register za to obeležje nima prepisa napisa.</p>
        )}
      </div>

      <dl style={{ display: "grid", gap: razmik, margin: 0 }}>
        <Vrstica oznaka="Lokacija in dostop">{g.dostop ?? niNavedeno}</Vrstica>
        <Vrstica oznaka="Oblika obeležja">{g.vrsta ?? niNavedeno}</Vrstica>
        <Vrstica oznaka="Čas postavitve ali odkritja">{g.nastanek ?? niNavedeno}</Vrstica>
        <Vrstica oznaka="Avtor obeležja">{g.avtor_obelezja ?? niNavedeno}</Vrstica>
        <Vrstica oznaka="Zapis v registru vnesel">{g.vnesel ?? niNavedeno}</Vrstica>
        <Vrstica oznaka="Povezave iz registra">
          {g.povezave.length ? (
            <ul style={{ margin: 0, paddingLeft: "1.25em" }}>
              {g.povezave.map((u) => (
                <li key={u} style={{ overflowWrap: "anywhere" }}>
                  <a href={u} target="_blank" rel="noopener noreferrer">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            niNavedeno
          )}
        </Vrstica>
      </dl>

      <div style={{ display: "grid", gap: razmik }}>
        <strong>Fotografije v registru ({g.slike.length})</strong>
        <p className="field-description" style={{ margin: 0 }}>
          Pravice za nobeno od teh fotografij niso urejene. Fotografijo prenesi šele, ko imaš dovoljenje, in jo
          naloži kot običajno v zbirko Mediji, kjer izpolniš pravice uporabe.
        </p>
        {g.slike.length ? (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "var(--base)",
              gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
            }}
          >
            {g.slike.map((s, i) => (
              <li key={s.url} style={{ display: "grid", gap: "calc(var(--base) * 0.25)", alignContent: "start" }}>
                <a href={g.vir_url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- hotlinked thumbnail, never stored */}
                  <img
                    src={s.thumb ?? s.url}
                    alt={`Fotografija ${i + 1} v registru${s.opis ? `: ${s.opis}` : ""}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      borderRadius: "var(--style-radius-s)",
                      background: "var(--theme-elevation-100)",
                    }}
                  />
                </a>
                <span
                  style={{
                    justifySelf: "start",
                    fontSize: "0.85em",
                    fontWeight: 600,
                    padding: "0.1em 0.5em",
                    borderRadius: "var(--style-radius-s)",
                    border: "1px solid var(--theme-error-500)",
                    color: "var(--theme-error-750)",
                    background: "var(--theme-error-50)",
                  }}
                >
                  pravice neurejene
                </span>
                <span style={{ fontSize: "0.9em" }}>Avtor: {s.avtor ?? "ni naveden"}</span>
                {s.licenca_v_registru ? (
                  <span className="field-description" style={{ margin: 0, fontSize: "0.85em" }}>
                    Register navaja: {s.licenca_v_registru}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0 }}>Register za to obeležje nima fotografij.</p>
        )}
      </div>
    </section>
  );
}
