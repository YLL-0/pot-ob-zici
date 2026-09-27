/**
 * Supabase client factory. Only lib/data.ts (and, from Phase 4, the admin
 * API routes) may import this — components never call Supabase directly
 * (CLAUDE.md convention).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Public, anon-key client — safe for reads of published rows only (RLS-gated). */
export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase ni konfiguriran (manjka NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). " +
        "Preveri z isSupabaseConfigured() pred klicem.",
    );
  }
  return createClient(url, anonKey);
}

/**
 * Service-role client — bypasses RLS. Server-only: scripts/seed.ts and
 * future admin write routes. NEVER import this from a Client Component or
 * anything that ships to the browser.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Manjka NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY za servisni odjemalec.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
