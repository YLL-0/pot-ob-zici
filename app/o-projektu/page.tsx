import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Nadnaslov from "@/components/Nadnaslov";

export const metadata: Metadata = {
  title: "O projektu",
  description: "O projektu Pot ob žici, društvu ZZB NOB Novo mesto, virih in avtorskih pravicah.",
};

export default function OProjektuPage() {
  return (
    <div className="min-h-dvh bg-papir">
    <SiteHeader />
    <main className="mx-auto max-w-stolpec space-y-10 px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
      <nav aria-label="Drobtine" className="text-sm">
        <Link href="/" className="font-medium text-poudarek underline-offset-4 hover:underline">
          ← Nazaj na zemljevid
        </Link>
      </nav>

      <Nadnaslov nadnaslov="Novo mesto · Dolenjska" naslov="O projektu" />

      <section className="max-w-besedilo space-y-4 text-lg leading-relaxed">
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

      <section className="max-w-besedilo">
        <h2 className="font-heading text-2xl font-semibold">Stanje vsebin</h2>
        <p className="mt-3 text-lg leading-relaxed">
          Besedila za posamezna obeležja pripravljajo zgodovinarji društva in bodo dodana postopoma. Dokler
          besedilo za obeležje ni pripravljeno, stran namesto njega prikaže kratko iztočnico, morebitno EŠD
          številko in povezave na vire. Tri obeležja (za namen predstavitve) trenutno prikazujejo jasno
          označeno demonstracijsko besedilo, ki ni zgodovinski vir.
        </p>
      </section>

      <section className="max-w-besedilo">
        <h2 className="font-heading text-2xl font-semibold">GPS koordinate in trase</h2>
        <p className="mt-3 text-lg leading-relaxed">
          Koordinate obeležij so prevzete iz javnega registra partizanskih spomenikov{" "}
          <a href="https://partizanstvo.si/" target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
            partizanstvo.si
          </a>
          ; na strani posameznega obeležja je povezava na njegov zapis v registru. Terensko še niso
          preverjene — to bo storjeno pred namestitvijo QR-tablic. Trase etap so iz teh lokacij izračunane po javno
          dostopnih poteh (OpenStreetMap); kjer to ni mogoče, so prikazane kot črtkana shematska povezava.
          Nobena ni uradno označena pot. Obroč nekdanje obrambne žice iz let 1942–43 je shematski: prikazuje
          približen potek, ne izmerjene lege.
        </p>
      </section>

      <section className="max-w-besedilo">
        <h2 className="font-heading text-2xl font-semibold">Fotografije</h2>
        <p className="mt-3 text-lg leading-relaxed">
          Fotografije bodo dodane sproti. Vsaka bo označena z avtorjem oziroma virom in navedbo pravic — javna
          spominska stran ne sme objaviti slikovnega gradiva neznanega izvora.
        </p>
      </section>

      <section className="max-w-besedilo">
        <h2 className="font-heading text-2xl font-semibold">Viri</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-lg">
          <li>
            <a href="https://www.zb-nob-nm.si/" target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
              zb-nob-nm.si
            </a>{" "}
            — ZZB NOB Novo mesto
          </li>
          <li>
            <a href="https://partizanstvo.si/" target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
              partizanstvo.si
            </a>{" "}
            — register partizanskih spomenikov, vir koordinat obeležij
          </li>
          <li>
            <a href="https://www.novomesto.si/" target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
              novomesto.si
            </a>{" "}
            — Mestna občina Novo mesto
          </li>
          <li>
            <a href="https://www.dolenjskimuzej.si/" target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
              dolenjskimuzej.si
            </a>{" "}
            — Dolenjski muzej
          </li>
        </ul>
      </section>

      <section className="max-w-besedilo">
        <h2 className="font-heading text-2xl font-semibold">Zemljevid</h2>
        <p className="mt-3 text-lg leading-relaxed">
          Zemljevidne podlage: ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
            OpenStreetMap
          </a>{" "}
          prispevki, prek{" "}
          <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
            OpenFreeMap
          </a>
          .
        </p>
      </section>
    </main>
    </div>
  );
}
