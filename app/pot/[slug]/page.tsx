import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getObroc, getPot, getPoti, getPoints } from "@/lib/data";
import { tockeTrase } from "@/lib/trase";
import { koordinateOdsekov, statusOdsekov, vidniOdseki, SPOROCILO_ZICA } from "@/lib/trasaIzris";
import { VRSTA_ICONS } from "@/lib/vrsta";
import { estimateWalkingMinutes, formatDistance, formatMinutes, lineLengthMeters } from "@/lib/geo";
import MiniMap from "@/components/LazyMiniMap";
import type { Tocka } from "@/lib/types";
import SiteHeader from "@/components/SiteHeader";
import Nadnaslov from "@/components/Nadnaslov";
import Obvestilo from "@/components/Obvestilo";
import { besediloNaBarvi, stevnikObelezij } from "@/lib/etape";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pot = await getPot(slug);
  if (!pot) return { title: "Pot ni najdena" };
  return {
    title: pot.naziv,
    description: pot.odsek ? `${pot.naziv} — ${pot.odsek}` : pot.naziv,
  };
}

export default async function PotPage({ params }: PageProps) {
  const { slug } = await params;
  const [pot, vsePoti, vseTocke, obroc] = await Promise.all([getPot(slug), getPoti(), getPoints(), getObroc()]);
  if (!pot) notFound();

  // A stage page shows the same ring section as the map (its own route up
  // to the next stage's first point) and its points in walking order.
  const odsek = pot.vrsta === "etapa" ? vidniOdseki(obroc, [pot.slug]) : [];
  const status = statusOdsekov(odsek);
  const deli = odsek.flatMap((o) => o.deli);
  const tockeByIdMap = new Map(vseTocke.map((t) => [t.id, t]));
  const tockeVVrstnemRedu =
    pot.vrsta === "etapa"
      ? tockeTrase(pot.slug, vseTocke)
      : pot.tocke_ids.map((id) => tockeByIdMap.get(id)).filter((t): t is Tocka => Boolean(t));
  const sporocilo = pot.vrsta === "zica" ? SPOROCILO_ZICA : (status?.sporocilo ?? null);

  const meters = lineLengthMeters(deli.length > 0 ? koordinateOdsekov(odsek) : pot.geometry.coordinates);
  const minutes = estimateWalkingMinutes(meters);

  return (
    <div className="flex-1 bg-papir">
    <SiteHeader />
    <main className="mx-auto max-w-stolpec space-y-8 px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
      <nav aria-label="Drobtine" className="text-sm">
        <Link href="/" className="font-medium text-poudarek underline-offset-4 hover:underline">
          ← Nazaj na zemljevid
        </Link>
      </nav>

      <header className="space-y-4">
        <Nadnaslov
          nadnaslov={pot.vrsta === "etapa" ? "Etapa poti ob žici" : "Zgodovinski sloj"}
          naslov={
            <span className="inline-flex items-center gap-3">
              <span aria-hidden="true" className="inline-block h-5 w-5 shrink-0 rounded-full" style={{ backgroundColor: pot.barva }} />
              {pot.naziv}
            </span>
          }
          uvod={pot.odsek && !pot.naziv.includes(pot.odsek) ? pot.odsek : undefined}
        />
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-base text-crnilo-mehko">
        <span>{stevnikObelezij(tockeVVrstnemRedu.length)} na trasi</span>
        <span>pribl. {formatDistance(meters)}</span>
        <span>pribl. {formatMinutes(minutes)} hoje</span>
      </div>

      </header>

      {sporocilo && (
        <Obvestilo>
          <p>{sporocilo}</p>
        </Obvestilo>
      )}

      <div className="h-80 overflow-hidden rounded-xl border border-crta sm:h-[28rem]">
        <MiniMap variant="pot" pot={pot} tocke={tockeVVrstnemRedu} deli={deli.length > 0 ? deli : undefined} />
      </div>

      <section>
        <h2 className="font-heading text-2xl font-semibold">Obeležja na trasi</h2>
        <p className="mt-1 text-sm text-crnilo-mehko">V vrstnem redu hoje.</p>
        <ol className="mt-4 divide-y divide-crta overflow-hidden rounded-xl border border-crta bg-povrsina">
          {tockeVVrstnemRedu.map((t, i) => {
            const Icon = VRSTA_ICONS[t.vrsta];
            return (
              <li key={t.id}>
                <Link
                  href={`/tocka/${t.slug}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-papir"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                      besediloNaBarvi(pot.barva) === "svetlo" ? "text-white" : "text-crnilo"
                    }`}
                    style={{ backgroundColor: pot.barva }}
                  >
                    {i + 1}
                  </span>
                  <Icon size={18} aria-hidden="true" className="shrink-0 text-crnilo-mehko" />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug font-medium">{t.naziv}</span>
                    <span className="block text-sm text-crnilo-mehko">{t.obmocje}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        {tockeVVrstnemRedu.length === 0 && (
          <p className="mt-2 text-sm text-crnilo-mehko">Ta sloj nima neposredno pripisanih obeležij.</p>
        )}
      </section>

      <nav aria-labelledby="druge-poti" className="border-t border-crta pt-6 text-sm">
        <h2 id="druge-poti" className="mb-3 font-heading text-xl font-semibold">Druge poti</h2>
        <div className="flex flex-wrap gap-2">
          {vsePoti
            .filter((p) => p.slug !== pot.slug)
            .map((p) => (
              <Link
                key={p.slug}
                href={`/pot/${p.slug}`}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-crta bg-povrsina px-3.5 py-1.5 text-sm font-medium hover:border-crta-mocna"
              >
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.barva }} />
                {p.naziv}
              </Link>
            ))}
        </div>
      </nav>
    </main>
    </div>
  );
}
