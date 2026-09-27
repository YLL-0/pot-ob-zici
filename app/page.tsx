import { getPoints, getPoti } from "@/lib/data";
import { getEtapaBarva } from "@/lib/etape";

/**
 * Phase 0 placeholder. The real map homepage (fitted bounds, markers,
 * trail lines, side panel) is Phase 1 — see PROMPT.md build order. This
 * page exists only to prove the data pipeline works end to end: a fresh
 * clone with no .env must load and display all 50 points and all 9
 * trails (8 stages + the 1943 wire layer).
 */
export default async function HomePage() {
  const [points, poti] = await Promise.all([getPoints(), getPoti()]);
  const byEtapa = new Map<number, typeof points>();
  for (const point of points) {
    const list = byEtapa.get(point.etapa) ?? [];
    list.push(point);
    byEtapa.set(point.etapa, list);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold">Pot ob žici — Faza 0</h1>
      <p className="mt-2 text-sm text-charcoal-700">
        Prava domača stran (zemljevid čez cel zaslon, stranski panel, filtri) je Faza 1. Ta stran
        samo dokazuje, da se podatki naložijo brez <code>.env</code>.
      </p>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">
          Obeležja: {points.length} / 50
        </h2>
        <div className="mt-3 space-y-4">
          {[...byEtapa.entries()]
            .sort(([a], [b]) => a - b)
            .map(([etapa, tocke]) => (
              <div key={etapa}>
                <h3 className="flex items-center gap-2 font-heading text-sm font-semibold">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: getEtapaBarva(etapa) }}
                  />
                  Etapa {etapa} ({tocke.length})
                </h3>
                <ul className="mt-1 ml-5 list-disc text-sm">
                  {tocke.map((t) => (
                    <li key={t.id}>
                      <span className="text-charcoal-600">{t.id}</span> — {t.naziv}{" "}
                      <span className="text-charcoal-600">({t.obmocje})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Poti: {poti.length} / 9</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {poti.map((pot) => (
            <li key={pot.slug} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: pot.barva }}
              />
              <span className="font-medium">{pot.naziv}</span>
              <span className="text-charcoal-600">
                ({pot.tocke_ids.length} točk{pot.status ? `, ${pot.status}` : ""})
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
