/**
 * Publish → public site, without a redeploy. Public pages are static and
 * read the database only through Next's tagged data cache (lib/data.ts);
 * these hooks expire the tags and the affected paths after an admin save,
 * so the next visitor gets a freshly rendered page.
 *
 * Outside a Next request (tsx scripts using the Local API, e.g.
 * migrate-to-payload.ts) there is nothing to revalidate — the call throws
 * and is ignored.
 */

import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  PayloadRequest,
} from "payload";
import { revalidatePath, revalidateTag } from "next/cache";
import { OZNAKE_PREDPOMNILNIKA } from "@/lib/cacheOznake";

function idRelacije(ref: unknown): string | null {
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object" && "id" in ref) return String((ref as { id: unknown }).id);
  return null;
}

function osvezi(req: PayloadRequest, oznake: string[], poti: (string | null | undefined)[]): void {
  try {
    // expire: 0 — the next request re-renders instead of serving the old page once more.
    for (const oznaka of oznake) revalidateTag(oznaka, { expire: 0 });
    for (const pot of new Set(poti.filter((p): p is string => Boolean(p)))) revalidatePath(pot);
  } catch (err) {
    req.payload.logger.debug(`Osvežitev javne strani preskočena (ni Next zahteve): ${String(err)}`);
  }
}

type DokumentTocke = { slug?: string; etapa?: unknown; _status?: string | null };

function potiTocke(doc: DokumentTocke | undefined): string[] {
  if (!doc) return [];
  const etapa = idRelacije(doc.etapa);
  return [doc.slug ? `/tocka/${doc.slug}` : "", etapa ? `/pot/${etapa}` : ""];
}

/**
 * Only when the public version changed: on publish, on unpublish, or on a
 * save of a published point. A draft saved over a draft changes nothing
 * the public can see.
 */
export const osveziPoSpremembiTocke: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
  const zdaj = doc as DokumentTocke;
  const prej = previousDoc as DokumentTocke | undefined;
  if (zdaj._status !== "published" && prej?._status !== "published") return doc;
  osvezi(req, [OZNAKE_PREDPOMNILNIKA.tocke], ["/", "/sitemap.xml", ...potiTocke(zdaj), ...potiTocke(prej)]);
  return doc;
};

export const osveziPoIzbrisuTocke: CollectionAfterDeleteHook = ({ doc, req }) => {
  osvezi(req, [OZNAKE_PREDPOMNILNIKA.tocke], ["/", "/sitemap.xml", ...potiTocke(doc as DokumentTocke)]);
  return doc;
};

/** A stage's colour, name or visibility shows on every page, so the tag covers them all. */
export const osveziPoSpremembiEtape: CollectionAfterChangeHook = ({ doc, req }) => {
  osvezi(req, [OZNAKE_PREDPOMNILNIKA.etape], ["/", "/sitemap.xml", `/pot/${(doc as { id: string }).id}`]);
  return doc;
};

export const osveziPoIzbrisuEtape: CollectionAfterDeleteHook = ({ doc, req }) => {
  osvezi(req, [OZNAKE_PREDPOMNILNIKA.etape], ["/", "/sitemap.xml", `/pot/${(doc as { id: string }).id}`]);
  return doc;
};

/** A photo's caption or credit is shown on its point's page. */
export const osveziPoSpremembiFotografije: CollectionAfterChangeHook = ({ doc, req }) => {
  osvezi(req, [OZNAKE_PREDPOMNILNIKA.tocke], []);
  return doc;
};

/** After a route recompute (cms/trase). */
export function osveziTrase(req: PayloadRequest): void {
  osvezi(req, [OZNAKE_PREDPOMNILNIKA.trase], ["/"]);
}
