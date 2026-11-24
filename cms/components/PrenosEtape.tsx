/**
 * »Gradivo iz registra« on a stage: the »Prenesi iz registra« action for
 * every memorial of the stage (PROMPT_PRENOS.md). Available to editors as
 * well as admins — it writes memorial drafts, never the stage itself.
 */

import type { UIFieldServerProps } from "payload";
import { gradivoZaTocko } from "@/cms/partizanstvo";
import { PrenosEtapeGumb } from "@/cms/components/PrenosRegistraGumbi";

export async function PrenosEtape({ data, payload }: UIFieldServerProps) {
  const id = typeof data?.id === "string" ? data.id : null;

  const okvir: React.CSSProperties = {
    border: "1px solid var(--theme-elevation-150)",
    borderRadius: "var(--style-radius-m)",
    padding: "var(--base)",
    display: "grid",
    gap: "calc(var(--base) * 0.5)",
    marginBottom: "var(--base)",
  };

  if (!id) {
    return (
      <section style={okvir} aria-labelledby="prenos-etape-naslov">
        <h3 id="prenos-etape-naslov" style={{ margin: 0 }}>
          Gradivo iz registra
        </h3>
        <p className="field-description" style={{ margin: 0 }}>
          Na voljo, ko je etapa shranjena in ima obeležja.
        </p>
      </section>
    );
  }

  // Drafts included: a draft memorial still belongs to the stage.
  const { docs } = await payload.find({
    collection: "tocke",
    where: { etapa: { equals: id } },
    draft: true,
    sort: "zaporedje",
    depth: 0,
    limit: 0,
    pagination: false,
    select: { naziv: true },
  });
  const tocke = docs.map((t) => ({ id: t.id, naziv: t.naziv, vRegistru: gradivoZaTocko(t.id) !== null }));

  return (
    <section style={okvir} aria-labelledby="prenos-etape-naslov">
      <h3 id="prenos-etape-naslov" style={{ margin: 0 }}>
        Gradivo iz registra
      </h3>
      {tocke.length === 0 ? (
        <p className="field-description" style={{ margin: 0 }}>
          Etapa nima obeležij.
        </p>
      ) : (
        <PrenosEtapeGumb tocke={tocke} />
      )}
    </section>
  );
}
