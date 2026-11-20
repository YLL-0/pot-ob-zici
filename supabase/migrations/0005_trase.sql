-- 0005 — Payload CMS phase (PROMPT_ADMIN.md).
--
-- Content (tocke, etape, media, users) now lives in Payload's own schema
-- `payload`, created by Payload's migrations (migrations/ in the repo).
-- Migrations 0001–0004 were never applied to the production project; of
-- them only the `trase` table is still needed, so this file creates it on
-- its own. It is computed route cache, not edited content, and stays
-- outside Payload.
--
-- Writes come only from the server with the service-role key (admin
-- "Ponovno izračunaj trase", `npm run trase`), which bypasses RLS — so
-- there are no write policies, and no dependency on Supabase Auth
-- (the old is_editor() / profiles are gone: Payload handles login).

create table if not exists public.trase (
  id uuid primary key default gen_random_uuid(),
  -- hash of the ordered (point id, lat, lon) list + stage ids + routing
  -- profile. Staleness is derived from it, never stored.
  kljuc text not null unique,
  etapa_ids text[] not null,
  geometry jsonb, -- GeoJSON LineString; null when routing failed
  dolzina_m double precision,
  trajanje_s double precision,
  engine text not null, -- e.g. 'ors/foot-walking'
  izracunano_ob timestamptz not null default now(),
  status text not null check (status in ('izracunano', 'ni_uspelo')),
  razlog text, -- why routing failed, shown in the admin
  kraki jsonb, -- TrasaKrak[]: per-leg distance + straight-line distance
  check (status <> 'izracunano' or geometry is not null)
);

create index if not exists trase_etapa_ids_idx on public.trase using gin (etapa_ids);

alter table public.trase enable row level security;

drop policy if exists "Javnost bere trase" on public.trase;
create policy "Javnost bere trase"
  on public.trase for select
  using (true);
