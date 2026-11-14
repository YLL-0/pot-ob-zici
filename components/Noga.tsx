import Link from "next/link";

/**
 * The funders, left to right (POPRAVKI_4 §2). Supplied by the client into
 * public/logotipi/ as PNGs trimmed to a common 240 px height, so one display
 * height aligns them. Shown exactly as supplied: no recolouring, cropping,
 * tiles or filters (the EU emblem's form and colours are prescribed), and
 * not re-encoded by next/image. The source is >2× the display height.
 * Unlinked until the client supplies the organisations' URLs.
 */
const LOGOTIPI = [
  { datoteka: "zzb-nob-nm.png", ime: "Združenje borcev za vrednote NOB Novo mesto", sirina: 444, visina: 240 },
  { datoteka: "cnvos.png", ime: "CNVOS — Center za informiranje, sodelovanje in razvoj nevladnih organizacij", sirina: 572, visina: 240 },
  { datoteka: "4impact-values.png", ime: "4IMPACT VALUES", sirina: 455, visina: 240 },
  { datoteka: "eu-sofinancira.png", ime: "Sofinancira Evropska unija", sirina: 506, visina: 240 },
] as const;

/** Funding condition: reproduced exactly, never paraphrased, shortened or re-translated. */
const IZJAVA_EU =
  "Financirano s strani Evropske unije. Izražena stališča in mnenja so zgolj stališča in mnenja avtorja(-ev) in ne nujno, da odražajo stališča in mnenja Evropske unije ali Evropske izvajalske agencije za izobraževanje in kulturo (EACEA). Zanje ne moreta biti odgovorna niti Evropska unija niti EACEA.";

/** Display height in px (Tailwind h-11); width follows each file's aspect ratio. */
const VISINA_PX = 44;

const zunanjaPovezava = "underline underline-offset-4 hover:text-crnilo";

/** Site-wide footer: funders' logos, the EU disclaimer, then credits. */
export default function Noga() {
  return (
    <footer className="mt-8 text-crnilo">
      {/* Light neutral panel; the logos sit on it unmodified. */}
      <div className="border-t border-crta bg-povrsina">
        <div className="mx-auto flex max-w-zemljevid flex-col items-center gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center">
          <ul
            aria-label="Financerji in partnerji"
            className="grid grid-cols-2 items-center justify-items-center gap-x-8 gap-y-5 sm:flex sm:flex-wrap sm:justify-center lg:shrink-0 lg:flex-nowrap lg:justify-start"
          >
            {LOGOTIPI.map(({ datoteka, ime, sirina, visina }) => (
              <li key={datoteka} className="flex">
                {/* eslint-disable-next-line @next/next/no-img-element -- shown byte-for-byte as supplied */}
                <img
                  src={`/logotipi/${datoteka}`}
                  alt={ime}
                  width={Math.round((VISINA_PX * sirina) / visina)}
                  height={VISINA_PX}
                  loading="lazy"
                  decoding="async"
                  className="h-11 w-auto"
                />
              </li>
            ))}
          </ul>
          <p className="border-crta-mocna text-sm leading-relaxed text-crnilo-mehko lg:border-l lg:pl-6">{IZJAVA_EU}</p>
        </div>
      </div>

      <div className="mx-auto max-w-zemljevid px-4 py-4 sm:px-6">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-crnilo-mehko">
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
