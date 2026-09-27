import type { MetadataRoute } from "next";
import { getPoints, getPoti } from "@/lib/data";
import { getBaseUrl } from "@/lib/qr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseUrl();
  const [points, poti] = await Promise.all([getPoints(), getPoti()]);

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/o-projektu`, changeFrequency: "monthly", priority: 0.5 },
    ...points.map((t) => ({
      url: `${base}/tocka/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...poti.map((p) => ({
      url: `${base}/pot/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
