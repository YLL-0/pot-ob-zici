"use client";

/** Sidebar link to the Trase view (/admin/trase), under the collections. */

import Link from "next/link";
import { usePathname } from "next/navigation";

export function TraseNavPovezava() {
  const aktivna = usePathname() === "/admin/trase";
  return (
    <Link href="/admin/trase" className="nav__link" aria-current={aktivna ? "page" : undefined} prefetch={false}>
      <span className="nav__link-label">Trase</span>
    </Link>
  );
}
