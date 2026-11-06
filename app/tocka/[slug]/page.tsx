import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getEtape, getPoint, getPoints } from "@/lib/data";
import { getPrevNextVEtapi } from "@/lib/navigacija";
import { VRSTA_LABELS } from "@/lib/vrsta";
import { ZGODBA_LABELS } from "@/lib/zgodbe";
import { besediloNaBarvi, findEtapa, getEtapaBarva } from "@/lib/etape";
import FotoPlaceholder from "@/components/FotoPlaceholder";
import PeljiMeTjaZemljevid from "@/components/PeljiMeTjaZemljevid";
import TrackPointView from "@/components/TrackPointView";
import SiteHeader from "@/components/SiteHeader";
import Nadnaslov from "@/components/Nadnaslov";
import Obvestilo from "@/components/Obvestilo";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tocka = await getPoint(slug);
  if (!tocka) return { title: "Obeležje ni najdeno" };
  return {
    title: tocka.naziv,
    description: tocka.iztocnica,
    openGraph: { title: tocka.naziv, description: tocka.iztocnica },
  };
}

function isDemo(text: string | null): boolean {
  return text?.startsWith("[DEMO BESEDILO") ?? false;
}

export default async function TockaPage({ params }: PageProps) {
  const { slug } = await params;
  const [tocka, vseTocke, etape] = await Promise.all([getPoint(slug), getPoints(), getEtape()]);
  if (!tocka) notFound();

  const { prev, next } = getPrevNextVEtapi(tocka, vseTocke);
  const etapa = findEtapa(etape, tocka.etapa);
  const barva = getEtapaBarva(etape, tocka.etapa);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LandmarksOrHistoricalBuildings",
    name: tocka.naziv,
    description: tocka.iztocnica,
    address: { "@type": "PostalAddress", addressLocality: tocka.obmocje, addressCountry: "SI" },
    geo: { "@type": "GeoCoordinates", latitude: tocka.lat, longitude: tocka.lon },
    ...(tocka.viri.length > 0 ? { sameAs: tocka.viri } : {}),
  };

  return (
    <div className="min-h-dvh bg-papir">
    <SiteHeader />
    <main className="mx-auto max-w-stolpec space-y-8 px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
      <TrackPointView slug={tocka.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Drobtine" className="text-sm">
        <Link href="/" className="font-medium text-poudarek underline-offset-4 hover:underline">
          ← Nazaj na zemljevid
        </Link>
      </nav>

      {/* Hero */}
      <header className="space-y-4">
        <Nadnaslov
          nadnaslov={tocka.obmocje}
          naslov={tocka.naziv}
          uvod={etapa?.odsek ? `${etapa.naziv}: ${etapa.odsek}` : undefined}
        />
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${besediloNaBarvi(barva) === "svetlo" ? "text-white" : "text-crnilo"}`}
            style={{ backgroundColor: barva }}
          >
            {VRSTA_LABELS[tocka.vrsta]}
          </span>
          {tocka.zgodbe_predlog.map((z) => (
            <span key={z} className="rounded-full border border-crta bg-povrsina px-3 py-1 text-sm font-medium">
              {ZGODBA_LABELS[z]}
            </span>
          ))}
        </div>
      </header>

      <div className="h-56 overflow-hidden rounded-xl sm:h-80">
        <FotoPlaceholder tocka={tocka} />
      </div>


      {/* Content */}
      <section className="max-w-besedilo space-y-5 text-lg leading-relaxed">
        {tocka.besedilo_kratko ? (
          <>
            {isDemo(tocka.besedilo_kratko) && (
              <Obvestilo>
                <p className="font-semibold">To besedilo je demonstracijsko in ni zgodovinski vir.</p>
              </Obvestilo>
            )}
            <p>{tocka.besedilo_kratko}</p>
            {tocka.besedilo_poglobljeno && (
              <details className="rounded-xl border border-crta bg-povrsina p-4">
                <summary className="cursor-pointer font-heading text-base font-semibold">
                  Poglobljeno besedilo
                </summary>
                <div className="mt-3 space-y-2 text-base whitespace-pre-line">{tocka.besedilo_poglobljeno}</div>
              </details>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-crta bg-povrsina p-5">
            <p className="text-nadnaslov font-semibold text-crnilo-mehko uppercase">Vsebina v pripravi</p>
            <p className="mt-2">{tocka.iztocnica}</p>
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base text-crnilo-mehko">
          <dt className="font-medium">EŠD</dt>
          <dd>{tocka.esd ?? "Obeležje (še) nima EŠD številke."}</dd>
        </dl>

        {tocka.viri.length > 0 && (
          <div>
            <h2 className="font-heading text-xl font-semibold">Viri</h2>
            <ul className="mt-2 list-inside list-disc text-base">
              {tocka.viri.map((v) => (
                <li key={v} className="truncate">
                  <a href={v} target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
                    {v}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Photo comparison slot */}
      <section>
        <h2 className="mb-3 font-heading text-xl font-semibold">Danes / nekoč</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-36 overflow-hidden rounded-xl">
            <FotoPlaceholder tocka={tocka} label="Danes" />
          </div>
          <div className="h-36 overflow-hidden rounded-xl">
            <FotoPlaceholder tocka={tocka} label="Arhivsko" />
          </div>
        </div>
      </section>

      <PeljiMeTjaZemljevid tocka={tocka} barva={barva} />

      {/* Prev/next */}
      <nav aria-label="Prejšnje in naslednje obeležje v etapi" className="flex items-start justify-between gap-4 border-t border-crta pt-6 text-sm">
        {prev ? (
          <Link href={`/tocka/${prev.slug}`} className="flex items-center gap-1 font-medium text-poudarek underline-offset-4 hover:underline">
            <ChevronLeft size={16} aria-hidden="true" /> {prev.naziv}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/tocka/${next.slug}`} className="flex items-center gap-1 text-right font-medium text-poudarek underline-offset-4 hover:underline">
            {next.naziv} <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
    </div>
  );
}
