import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "O projektu",
  description: "O projektu Pot ob žici, društvu ZZB NOB Novo mesto, virih in avtorskih pravicah.",
};

export default function OProjektuPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <nav className="pt-4 text-sm">
        <Link href="/" className="text-charcoal-600 hover:text-accent-red">
          ← Nazaj na zemljevid
        </Link>
      </nav>

      <h1 className="mt-4 font-heading text-2xl font-bold sm:text-3xl">O projektu</h1>

      <section className="mt-6 space-y-3 text-[15px] leading-relaxed">
        <p>
          <strong>Pot ob žici</strong> je digitalna učna pot 50 spominskih obeležij druge svetovne vojne,
          razporejenih na 8 etapah okoli Novega mesta. Vsako obeležje ima na terenu QR-tablico, ki obiskovalca
          pripelje na svojo stran s podatki, viri in — ko bodo pripravljeni — poglobljenim besedilom.
        </p>
        <p>
          Projekt izvaja <strong>Združenje borcev za vrednote NOB Novo mesto (ZZB NOB Novo mesto)</strong> v
          okviru aktivnosti digitalizacije Poti ob žici, znotraj širšega projekta o nevarnostih vzpona
          neonacizma in fašizma.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Stanje vsebin</h2>
        <p className="mt-2 text-[15px] leading-relaxed">
          Besedila za posamezna obeležja pripravljajo zgodovinarji društva in bodo dodana postopoma. Dokler
          besedilo za obeležje ni pripravljeno, stran namesto njega prikaže kratko iztočnico, morebitno EŠD
          številko in povezave na vire. Tri obeležja (za namen predstavitve) trenutno prikazujejo jasno
          označeno demonstracijsko besedilo, ki ni zgodovinski vir.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">GPS koordinate in trase</h2>
        <p className="mt-2 text-[15px] leading-relaxed">
          Koordinate obeležij so izhodiščni približki, izračunani iz javno dostopnih podatkov — ne s terenskim
          GPS-om — in bodo pred namestitvijo QR-tablic terensko usklajene. Črtkane trase etap in obroč
          nekdanje obrambne žice iz let 1942–43 so shematski: prikazujejo približen potek, ne izmerjene poti.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Fotografije</h2>
        <p className="mt-2 text-[15px] leading-relaxed">
          Fotografije bodo dodane sproti. Vsaka bo označena z avtorjem oziroma virom in navedbo pravic — javna
          spominska stran ne sme objaviti slikovnega gradiva neznanega izvora.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Viri</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          <li>
            <a href="https://www.zb-nob-nm.si/" target="_blank" rel="noopener noreferrer" className="text-accent-red hover:underline">
              zb-nob-nm.si
            </a>{" "}
            — ZZB NOB Novo mesto
          </li>
          <li>
            <a href="https://partizanstvo.si/" target="_blank" rel="noopener noreferrer" className="text-accent-red hover:underline">
              partizanstvo.si
            </a>
          </li>
          <li>
            <a href="https://www.novomesto.si/" target="_blank" rel="noopener noreferrer" className="text-accent-red hover:underline">
              novomesto.si
            </a>{" "}
            — Mestna občina Novo mesto
          </li>
          <li>
            <a href="https://www.dolenjskimuzej.si/" target="_blank" rel="noopener noreferrer" className="text-accent-red hover:underline">
              dolenjskimuzej.si
            </a>{" "}
            — Dolenjski muzej
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Zemljevid</h2>
        <p className="mt-2 text-[15px] leading-relaxed">
          Zemljevidne podlage: ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-accent-red hover:underline">
            OpenStreetMap
          </a>{" "}
          prispevki, prek{" "}
          <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer" className="text-accent-red hover:underline">
            OpenFreeMap
          </a>
          .
        </p>
      </section>
    </main>
  );
}
