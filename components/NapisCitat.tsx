import { razcleniNapis } from "@/lib/napis";

/**
 * A memorial inscription as a quote. Text is shown verbatim; the
 * register's markup is only styled apart (lib/napis.ts): symbol notes
 * such as »[zvezda]« small and muted, part labels such as »plošča na
 * levi strani:« as italic subheadings on their own line.
 */
export function NapisCitat({ napis }: { napis: string }) {
  const vrstice = razcleniNapis(napis);
  return (
    <blockquote className="rounded-r-xl border-l-4 border-poudarek bg-povrsina px-5 py-4 text-base">
      {vrstice.map((v, i) => {
        if (v.vrsta === "prazna") return <span key={i} aria-hidden="true" className="block h-[0.75lh]" />;
        if (v.vrsta === "podnaslov")
          return (
            <span key={i} className={`block italic text-crnilo-mehko ${i > 0 ? "mt-2" : ""}`}>
              {v.besedilo}
            </span>
          );
        return (
          <span key={i} className="block">
            {v.deli.map((d, j) =>
              d.vrsta === "simbol" ? (
                <span key={j} className="text-sm text-crnilo-mehko">
                  {d.besedilo}
                </span>
              ) : (
                <span key={j}>{d.besedilo}</span>
              ),
            )}
          </span>
        );
      })}
    </blockquote>
  );
}
