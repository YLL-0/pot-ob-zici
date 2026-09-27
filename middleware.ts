import { NextResponse, type NextRequest } from "next/server";
import tocke from "@/tocke.seed.json";

/**
 * QR shortlink redirect: /nmz-001 … /nmz-050 (case-insensitive) -> 301 to
 * /tocka/[slug]. This is a plain JSON import (Edge-safe — no node:fs), not
 * lib/data.ts's getPoints(): that module also pulls in the fs-based poti
 * loader, which the Edge runtime can't bundle. Using the seed JSON directly
 * is safe here because slugs are stable IDs (never regenerated) — even
 * once Supabase is the source of truth for content, this id->slug mapping
 * doesn't change for an existing point.
 */
const ID_TO_SLUG = new Map(tocke.map((t) => [t.id.toUpperCase(), t.slug]));

const NMZ_PATTERN = /^\/(nmz-\d{3})$/i;

export function middleware(request: NextRequest) {
  const match = NMZ_PATTERN.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();

  const id = match[1]!.toUpperCase();
  const slug = ID_TO_SLUG.get(id);
  if (!slug) return NextResponse.next(); // unknown id -> normal 404

  console.debug("[analytics] qr_scan", { id, at: new Date().toISOString() });

  const url = request.nextUrl.clone();
  url.pathname = `/tocka/${slug}`;
  return NextResponse.redirect(url, 301);
}

export const config = {
  // Matcher syntax historically doesn't reliably support a param glued
  // directly after a literal with no separator (e.g. "/nmz-:id") — match
  // broadly instead and let the regex above do the real filtering.
  matcher: ["/((?!_next|api|.*\\.).*)"],
};
