import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPoint, getPoints, getPoti } from "@/lib/data";
import { getPrevNextVEtapi } from "@/lib/navigacija";
import { VRSTA_LABELS } from "@/lib/vrsta";
import { ZGODBA_LABELS } from "@/lib/zgodbe";
import { getEtapaBarva } from "@/lib/etape";
import FotoPlaceholder from "@/components/FotoPlaceholder";
import PeljiMeTjaZemljevid from "@/components/PeljiMeTjaZemljevid";
import TrackPointView from "@/components/TrackPointView";

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
  const [tocka, vseTocke, poti] = await Promise.all([getPoint(slug), getPoints(), getPoti()]);
  if (!tocka) notFound();

  const { prev, next } = getPrevNextVEtapi(tocka, vseTocke);
  const etapaPot = poti.find((p) => p.etapa === tocka.etapa) ?? null;
  const barva = getEtapaBarva(tocka.etapa);

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
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <TrackPointView slug={tocka.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="pt-4 text-sm">
        <Link href="/" className="text-charcoal-600 hover:text-accent-red">
          ← Nazaj na zemljevid
        </Link>
      </nav>

      {/* Hero */}
      <div className="mt-4 h-56 overflow-hidden rounded-lg sm:h-72">
        <FotoPlaceholder tocka={tocka} />
      </div>

      <header className="mt-5">
        <p className="text-sm text-charcoal-600">
          {tocka.obmocje} · Etapa {tocka.etapa}
          {etapaPot ? `: ${etapaPot.odsek}` : ""}
        </p>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{tocka.naziv}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium text-offwhite-50"
            style={{ backgroundColor: barva }}
          >
            {VRSTA_LABELS[tocka.vrsta]}
          </span>
          {tocka.zgodbe_predlog.map((z) => (
            <span key={z} className="rounded-full border border-charcoal-600/30 px-2.5 py-0.5 text-xs font-medium text-charcoal-800">
              {ZGODBA_LABELS[z]}
            </span>
          ))}
        </div>
      </header>

      {/* Content */}
      <section className="mt-6 space-y-4 text-[15px] leading-relaxed text-charcoal-950">
        {tocka.besedilo_kratko ? (
          <>
            {isDemo(tocka.besedilo_kratko) && (
              <p className="rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs font-semibold text-accent-red-dark">
                To besedilo je demonstracijsko in ni zgodovinski vir.
              </p>
            )}
            <p>{tocka.besedilo_kratko}</p>
            {tocka.besedilo_poglobljeno && (
              <details className="rounded border border-charcoal-200 p-3">
                <summary className="cursor-pointer font-heading text-sm font-semibold">
                  Poglobljeno besedilo
                </summary>
                <div className="mt-2 space-y-2 whitespace-pre-line text-sm">{tocka.besedilo_poglobljeno}</div>
              </details>
            )}
          </>
        ) : (
          <div className="rounded border border-charcoal-200 bg-offwhite-100 p-4">
            <p className="font-heading text-sm font-semibold tracking-wide text-charcoal-600 uppercase">
              Vsebina v pripravi
            </p>
            <p className="mt-2">{tocka.iztocnica}</p>
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-charcoal-700">
          <dt className="font-medium">EŠD</dt>
          <dd>{tocka.esd ?? "Obeležje (še) nima EŠD številke."}</dd>
        </dl>

        {tocka.viri.length > 0 && (
          <div>
            <p className="text-sm font-medium text-charcoal-700">Viri</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {tocka.viri.map((v) => (
                <li key={v} className="truncate">
                  <a href={v} target="_blank" rel="noopener noreferrer" className="text-accent-red hover:underline">
                    {v}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Photo comparison slot */}
      <section className="mt-6">
        <p className="mb-2 text-sm font-medium text-charcoal-700">Danes / nekoč</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-32 overflow-hidden rounded">
            <FotoPlaceholder tocka={tocka} label="Danes" />
          </div>
          <div className="h-32 overflow-hidden rounded">
            <FotoPlaceholder tocka={tocka} label="Arhivsko" />
          </div>
        </div>
      </section>

      <PeljiMeTjaZemljevid tocka={tocka} />

      {/* Prev/next */}
      <nav className="mt-8 flex items-center justify-between border-t border-charcoal-200 pt-4 text-sm">
        {prev ? (
          <Link href={`/tocka/${prev.slug}`} className="flex items-center gap-1 text-charcoal-700 hover:text-accent-red">
            <ChevronLeft size={16} aria-hidden="true" /> {prev.naziv}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/tocka/${next.slug}`} className="flex items-center gap-1 text-right text-charcoal-700 hover:text-accent-red">
            {next.naziv} <ChevronRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
