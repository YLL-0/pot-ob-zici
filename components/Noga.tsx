import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

/**
 * The funders, left to right (POPRAVKI_3 §4). The marks themselves are
 * supplied by the client into public/logotipi/ — never drawn, redrawn or
 * replaced by a text label here. `razmerje` (width / height) is only an
 * assumption for the empty slot; a real file's own viewBox wins.
 */
const LOGOTIPI = [
  { datoteka: "zzb-nob-nm.svg", ime: "ZZB NOB Novo mesto — Združenje borcev za vrednote NOB Novo mesto", razmerje: 2.5 },
  { datoteka: "cnvos.svg", ime: "CNVOS", razmerje: 3 },
  { datoteka: "4impact-values.svg", ime: "4IMPACT VALUES", razmerje: 3 },
  { datoteka: "eu-sofinancira.svg", ime: "Sofinancira Evropska unija", razmerje: 4.4 },
] as const;

/** Funding condition: reproduced exactly, never paraphrased, shortened or re-translated. */
const IZJAVA_EU =
  "Financirano s strani Evropske unije. Izražena stališča in mnenja so zgolj stališča in mnenja avtorja(-ev) in ne nujno, da odražajo stališča in mnenja Evropske unije ali Evropske izvajalske agencije za izobraževanje in kulturo (EACEA). Zanje ne moreta biti odgovorna niti Evropska unija niti EACEA.";

const VISINA_PX = 40;

/** Width / height from the SVG's viewBox, or null if the file is missing. */
function razmerjeDatoteke(datoteka: string): number | null {
  const pot = path.join(process.cwd(), "public", "logotipi", datoteka);
  if (!fs.existsSync(pot)) return null;
  try {
    const m = fs.readFileSync(pot, "utf8").match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    const w = Number(m?.[1]);
    const h = Number(m?.[2]);
    return w > 0 && h > 0 ? w / h : 0;
  } catch {
    return 0;
  }
}

const zunanjaPovezava = "underline underline-offset-4 hover:text-crnilo";

/** Site-wide footer: funders' logos, the EU disclaimer, then credits. */
export default function Noga() {
  return (
    <footer className="mt-8 border-t border-crta bg-tonirano text-crnilo">
      <div className="mx-auto max-w-zemljevid space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <ul aria-label="Financerji in partnerji" className="flex flex-wrap items-center gap-x-8 gap-y-4 lg:shrink-0">
            {LOGOTIPI.map(({ datoteka, ime, razmerje }) => {
              const r = razmerjeDatoteke(datoteka);
              const sirina = Math.round(VISINA_PX * (r || razmerje));
              return (
                <li key={datoteka} className="flex">
                  {r === null ? (
                    // Missing file: neutral empty slot of the expected size, no text.
                    <span
                      role="img"
                      aria-label={`${ime} (logotip manjka)`}
                      data-manjka={datoteka}
                      className="block rounded border border-dashed border-crta-mocna"
                      style={{ width: sirina, height: VISINA_PX }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- static SVG, shown as supplied
                    <img
                      src={`/logotipi/${datoteka}`}
                      alt={ime}
                      height={VISINA_PX}
                      width={r ? sirina : undefined}
                      className="h-10 w-auto"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="border-crta-mocna text-sm leading-relaxed text-crnilo-mehko lg:border-l lg:pl-6">{IZJAVA_EU}</p>
        </div>

        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-crta pt-4 text-xs text-crnilo-mehko">
          <span className="font-medium text-crnilo">Pot ob žici</span>
          <Link href="/o-projektu" className={zunanjaPovezava}>
            O projektu
          </Link>
          <span>
            Zemljevid: ©{" "}
            <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer" className={zunanjaPovezava}>
              OpenFreeMap
            </a>
            , ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className={zunanjaPovezava}>
              avtorji OpenStreetMap
            </a>
          </span>
          <span>
            Koordinate:{" "}
            <a href="https://partizanstvo.si/" target="_blank" rel="noopener noreferrer" className={zunanjaPovezava}>
              partizanstvo.si
            </a>
          </span>
        </p>
      </div>
    </footer>
  );
}
