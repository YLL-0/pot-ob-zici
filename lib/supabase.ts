/**
 * Supabase API client factory. Since the Payload phase the only table read
 * through it is `public.trase` (computed route cache, lib/traseRepo.ts) —
 * content lives in Payload. Server-only; components never call Supabase
 * directly (CLAUDE.md convention).
 *
 * The anon key is optional: route reads happen on the server (static
 * pages), so with only the service-role key set the server reads with
 * that. Neither key ever ships to the browser.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

/** Whether routes can be written (admin "Ponovno izračunaj trase", `npm run trase`). */
export function isSupabaseWriteConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Read client: anon key (RLS: public select) if set, else the service key. Server-only. */
export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase ni konfiguriran (manjka NEXT_PUBLIC_SUPABASE_URL in ključ). Preveri z isSupabaseConfigured() pred klicem.",
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Service-role client — bypasses RLS. Server-only: route writes. NEVER
 * import this from a Client Component or anything that ships to the browser.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Manjka NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY za servisni odjemalec.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
