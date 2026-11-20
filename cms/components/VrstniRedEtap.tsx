/**
 * Above the Etape list: the stage order, editable by admins (beforeList).
 * Editors see the order but can't change it — stages are admin-only
 * (cms/collections/Etape.ts access), which the endpoint enforces again.
 */

import type { ServerProps } from "payload";
import { VrstniRedEtapUrejevalnik } from "@/cms/components/VrstniRedEtapUrejevalnik";

export async function VrstniRedEtap({ payload, user }: ServerProps) {
  const { docs } = await payload.find({
    collection: "etape",
    sort: "stevilka",
    depth: 0,
    limit: 0,
    pagination: false,
  });
  const etape = docs.map((e) => ({ id: e.id, stevilka: e.stevilka, naziv: e.naziv, odsek: e.odsek ?? null, barva: e.barva }));
  const jeAdmin = (user as { vloga?: string } | undefined)?.vloga === "admin";
  return <VrstniRedEtapUrejevalnik etape={etape} lahkoUreja={jeAdmin} />;
}
