import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPot, getPoti, getPoints } from "@/lib/data";
import { VRSTA_ICONS } from "@/lib/vrsta";
import { estimateWalkingMinutes, formatDistance, formatMinutes, lineLengthMeters } from "@/lib/geo";
import MiniMap from "@/components/LazyMiniMap";
import type { Tocka } from "@/lib/types";

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
  const [pot, vsePoti, vseTocke] = await Promise.all([getPot(slug), getPoti(), getPoints()]);
  if (!pot) notFound();

  const tockeByIdMap = new Map(vseTocke.map((t) => [t.id, t]));
  const tockeVVrstnemRedu = pot.tocke_ids.map((id) => tockeByIdMap.get(id)).filter((t): t is Tocka => Boolean(t));

  const meters = lineLengthMeters(pot.geometry.coordinates);
  const minutes = estimateWalkingMinutes(meters);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <nav className="pt-4 text-sm">
        <Link href="/" className="text-charcoal-600 hover:text-accent-red">
          ← Nazaj na zemljevid
        </Link>
      </nav>

      <header className="mt-4 flex items-center gap-3">
        <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: pot.barva }} />
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{pot.naziv}</h1>
          {pot.odsek && <p className="text-sm text-charcoal-600">{pot.odsek}</p>}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-charcoal-700">
        <span>{tockeVVrstnemRedu.length} obeležij na trasi</span>
        <span>pribl. {formatDistance(meters)}</span>
        <span>pribl. {formatMinutes(minutes)} hoje</span>
      </div>

      {pot.status && (
        <p className="mt-3 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm font-medium text-accent-red-dark">
          Trasa je shematska — prava pot še ni vrisana.{" "}
          {pot.vrsta === "zica" && "Obroč je ročno postavljen za ponazoritev in ni zgodovinsko potrjen."}
        </p>
      )}

      <div className="mt-5 h-72 overflow-hidden rounded-lg border border-charcoal-200 sm:h-96">
        <MiniMap variant="pot" pot={pot} tocke={tockeVVrstnemRedu} />
      </div>

      <section className="mt-6">
        <h2 className="font-heading text-lg font-semibold">Obeležja na trasi (vrstni red hoje)</h2>
        <ol className="mt-3 space-y-1">
          {tockeVVrstnemRedu.map((t, i) => {
            const Icon = VRSTA_ICONS[t.vrsta];
            return (
              <li key={t.id}>
                <Link
                  href={`/tocka/${t.slug}`}
                  className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-offwhite-100"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-offwhite-50"
                    style={{ backgroundColor: pot.barva }}
                  >
                    {i + 1}
                  </span>
                  <Icon size={15} aria-hidden="true" className="shrink-0 text-charcoal-600" />
                  <span className="flex-1">{t.naziv}</span>
                  <span className="text-xs text-charcoal-600">{t.obmocje}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        {tockeVVrstnemRedu.length === 0 && (
          <p className="mt-2 text-sm text-charcoal-600">Ta sloj nima neposredno pripisanih obeležij.</p>
        )}
      </section>

      <nav className="mt-8 border-t border-charcoal-200 pt-4 text-sm">
        <p className="mb-2 font-medium text-charcoal-700">Druge poti</p>
        <div className="flex flex-wrap gap-2">
          {vsePoti
            .filter((p) => p.slug !== pot.slug)
            .map((p) => (
              <Link
                key={p.slug}
                href={`/pot/${p.slug}`}
                className="rounded-full border border-charcoal-300 px-3 py-1 text-xs font-medium hover:bg-offwhite-100"
              >
                {p.naziv}
              </Link>
            ))}
        </div>
      </nav>
    </main>
  );
}
