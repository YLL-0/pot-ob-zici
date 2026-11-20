/**
 * Payload access functions. Roles are enforced here, server-side, not only
 * hidden in the admin UI (PROMPT_ADMIN.md "users").
 *
 * - urednik: edits content (points, photos)
 * - admin:   additionally manages users and stages
 */

import type { Access, FieldAccess, PayloadRequest } from "payload";

export type Vloga = "urednik" | "admin";

function vloga(req: PayloadRequest): Vloga | null {
  const user = req.user as { vloga?: Vloga } | null | undefined;
  return user?.vloga ?? null;
}

export function jeAdmin(req: PayloadRequest): boolean {
  return vloga(req) === "admin";
}

export function jePrijavljen(req: PayloadRequest): boolean {
  return vloga(req) !== null;
}

export const samoPrijavljeni: Access = ({ req }) => jePrijavljen(req);

export const samoAdmin: Access = ({ req }) => jeAdmin(req);

export const samoAdminPolje: FieldAccess = ({ req }) => jeAdmin(req);

/** Public sees only published documents; logged-in editors see drafts too. */
export const objavljenoAliPrijavljen: Access = ({ req }) =>
  jePrijavljen(req) ? true : { _status: { equals: "published" } };

/** Admin manages every account; anyone else may only read/update their own. */
export const adminAliSam: Access = ({ req }) => {
  if (jeAdmin(req)) return true;
  if (!req.user) return false;
  return { id: { equals: req.user.id } };
};
