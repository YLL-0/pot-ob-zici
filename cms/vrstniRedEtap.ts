/**
 * Reordering stages (PROMPT_ADMIN.md: "Reordering stages changes their
 * `stevilka`"). `stevilka` is unique, so a swap can't be written one row
 * at a time; all stages first move to free temporary numbers above the
 * current maximum, then get 1…n in the new order — in one transaction, so
 * a failure leaves the old order intact.
 *
 * `etape.id` never changes (CLAUDE.md: stable slugs), so points, URLs and
 * data/poti/<id>.geojson stay attached. The order of the ring does change,
 * so the connectors between stages become stale (their key names the two
 * stages) until »Ponovno izračunaj trase«.
 */

import type { Endpoint, PayloadRequest } from "payload";
import { APIError, commitTransaction, initTransaction, killTransaction } from "payload";
import { jeAdmin } from "@/cms/access";
import { osveziPoPreurejanjuEtap } from "@/cms/revalidacija";

export const BREZ_OSVEZITVE = "brezOsvezitve";

/**
 * With `preizkus` the transaction is always rolled back: the new order is
 * read back inside it and returned, nothing is committed or revalidated.
 */
export async function preurediEtape(
  req: PayloadRequest,
  ids: string[],
  { preizkus = false }: { preizkus?: boolean } = {},
): Promise<string[]> {
  const zacel = await initTransaction(req);
  let prebrano: string[] = [];
  try {
    const { docs } = await req.payload.find({
      collection: "etape",
      depth: 0,
      limit: 0,
      pagination: false,
      req,
      overrideAccess: false,
    });
    const obstojece = new Set(docs.map((e) => e.id));
    if (ids.length !== obstojece.size || new Set(ids).size !== ids.length || ids.some((id) => !obstojece.has(id))) {
      throw new APIError("Seznam etap se ne ujema z etapami v bazi — osveži stran in poskusi znova.", 409, undefined, true);
    }
    const zamik = Math.max(0, ...docs.map((e) => e.stevilka)) + 1;
    const posodobi = (id: string, stevilka: number) =>
      req.payload.update({
        collection: "etape",
        id,
        data: { stevilka },
        req,
        overrideAccess: false,
        context: { [BREZ_OSVEZITVE]: true },
      });
    for (const [i, id] of ids.entries()) await posodobi(id, zamik + i);
    for (const [i, id] of ids.entries()) await posodobi(id, i + 1);
    const po = await req.payload.find({ collection: "etape", sort: "stevilka", depth: 0, limit: 0, pagination: false, req });
    prebrano = po.docs.map((e) => e.id);
    if (preizkus) {
      if (zacel) await killTransaction(req);
      return prebrano;
    }
    if (zacel) await commitTransaction(req);
  } catch (err) {
    if (zacel) await killTransaction(req);
    throw err;
  }
  osveziPoPreurejanjuEtap(req, ids);
  return prebrano;
}

/** POST /api/vrstni-red-etap — body `{ "ids": ["etapa-2", "etapa-1", …] }`. Admins only. */
export const vrstniRedEtapEndpoint: Endpoint = {
  path: "/vrstni-red-etap",
  method: "post",
  handler: async (req) => {
    if (!jeAdmin(req)) {
      return Response.json({ napaka: "Vrstni red etap lahko spreminja samo skrbnik." }, { status: 403 });
    }
    let ids: unknown;
    try {
      ids = ((await req.json?.()) as { ids?: unknown } | undefined)?.ids;
    } catch {
      ids = undefined;
    }
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
      return Response.json({ napaka: "Manjka seznam etap v novem vrstnem redu." }, { status: 400 });
    }
    try {
      await preurediEtape(req, ids as string[]);
    } catch (err) {
      const status = err instanceof APIError ? err.status : 500;
      return Response.json({ napaka: err instanceof Error ? err.message : String(err) }, { status });
    }
    return Response.json({ ok: true });
  },
};
