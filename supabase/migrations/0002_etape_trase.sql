-- Pot ob žici — Phase 4 step 1: stages as data, routed-trail cache, RLS fix.
--
-- Mirrors lib/types.ts (Etapa, Trasa, Tocka.etapa/zaporedje). Same rule as
-- 0001: schema, importer (scripts/import-xlsx.ts), seed (scripts/seed.ts)
-- and types move together.
--
-- 0001 is left untouched because it may already be applied somewhere;
-- everything here is an ALTER on top of it.

-- ---------------------------------------------------------------------------
-- RLS helpers. 0001's policies read `profiles` from inside policies — on
-- `profiles` itself that is infinite recursion ("infinite recursion
-- detected in policy for relation profiles"), and every `tocke` policy that
-- subqueries `profiles` inherits it. SECURITY DEFINER functions read
-- `profiles` without going through its RLS, which breaks the cycle.
-- ---------------------------------------------------------------------------

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('urednik', 'admin'));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.is_editor() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_editor() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Admin vidi vse profile" on profiles;
create policy "Admin vidi vse profile"
  on profiles for select
  using (public.is_admin());

drop policy if exists "Urednik in admin bereta vse točke" on tocke;
create policy "Urednik in admin bereta vse točke"
  on tocke for select
  using (public.is_editor());

drop policy if exists "Urednik in admin urejata točke" on tocke;
create policy "Urednik in admin urejata točke"
  on tocke for update
  using (public.is_editor())
  with check (public.is_editor());

create policy "Urednik in admin dodajata točke"
  on tocke for insert
  with check (public.is_editor());

create policy "Admin briše točke"
  on tocke for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- etape — stages, editable in the admin. `id` is a stable slug referenced
-- by tocke.etapa, URLs (/pot/etapa-3) and the offline fallback files
-- data/poti/<id>.geojson; never regenerate it. `stevilka` is display order
-- only (deferrable so a reorder can swap numbers in one transaction).
-- ---------------------------------------------------------------------------

create table etape (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  stevilka int not null,
  naziv text not null,
  odsek text,
  barva text not null check (barva ~ '^#[0-9a-f]{6}$'),
  opis text,
  vidna boolean not null default true,
  updated_at timestamptz,
  updated_by uuid references profiles (id),
  constraint etape_stevilka_key unique (stevilka) deferrable initially immediate
);

-- The original eight, identical to lib/etape.ts ETAPE_SEED, so nothing
-- changes visibly on first run. `opis` stays empty: a stage description is
-- content, and content is never invented (CLAUDE.md rule 1).
insert into etape (id, stevilka, naziv, odsek, barva) values
  ('etapa-1', 1, 'Etapa 1', 'Loka – Bršljin', '#96582c'),
  ('etapa-2', 2, 'Etapa 2', 'Bršljin – Bučna vas', '#84962c'),
  ('etapa-3', 3, 'Etapa 3', 'Bučna vas – Ragovo', '#2c9661'),
  ('etapa-4', 4, 'Etapa 4', 'Ragovo – Žabja vas', '#2c7c96'),
  ('etapa-5', 5, 'Etapa 5', 'Žabja vas – Gotna vas', '#2c4f96'),
  ('etapa-6', 6, 'Etapa 6', 'Gotna vas – Šmihel', '#582c96'),
  ('etapa-7', 7, 'Etapa 7', 'Šmihel – Drska', '#962c96'),
  ('etapa-8', 8, 'Etapa 8', 'Drska – Loka', '#967c2c');

alter table etape enable row level security;

create policy "Javnost bere vidne etape"
  on etape for select
  using (vidna);

create policy "Urednik in admin bereta vse etape"
  on etape for select
  using (public.is_editor());

create policy "Urednik in admin dodajata etape"
  on etape for insert
  with check (public.is_editor());

create policy "Urednik in admin urejata etape"
  on etape for update
  using (public.is_editor())
  with check (public.is_editor());

-- Deleting a stage that still has points is refused by the foreign key
-- below (ON DELETE RESTRICT), whoever tries it.
create policy "Admin briše etape"
  on etape for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- tocke.etapa: int 1–8 -> nullable foreign key to etape.id.
-- A point with no stage is valid: it shows on the map, in no route.
-- ---------------------------------------------------------------------------

alter table tocke add column etapa_id text references etape (id) on delete restrict;
update tocke set etapa_id = 'etapa-' || etapa;

drop index if exists tocke_etapa_idx;
alter table tocke drop column etapa; -- also drops its "between 1 and 8" check
alter table tocke rename column etapa_id to etapa;
alter table tocke rename constraint tocke_etapa_id_fkey to tocke_etapa_fkey;
create index tocke_etapa_idx on tocke (etapa);

-- odsek now lives on the stage; lib/data.ts derives it on read.
alter table tocke drop column odsek;

-- Order of the point within its stage. Defaults come from scripts/seed.ts
-- (computed by scripts/import-xlsx.ts via lib/zaporedje.ts) — the ordering
-- algorithm is deliberately not duplicated in SQL. Rows that existed
-- before this migration keep null until the next seed or an admin edit.
alter table tocke add column zaporedje int check (zaporedje > 0);
alter table tocke
  add constraint tocke_etapa_zaporedje_key unique (etapa, zaporedje) deferrable initially immediate;

-- ---------------------------------------------------------------------------
-- trase — cached routing results. The public map only reads this table;
-- routing calls happen server-side from the admin (Phase 4 step 2).
--
-- `kljuc` = hash of the ordered (point id, lat, lon) list + stage ids +
-- routing profile. Staleness is NOT stored: a route is stale exactly when
-- the key computed from the current points differs, so it can never be
-- served silently after a point moves.
-- ---------------------------------------------------------------------------

create table trase (
  id uuid primary key default gen_random_uuid(),
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

create index trase_etapa_ids_idx on trase using gin (etapa_ids);

alter table trase enable row level security;

create policy "Javnost bere trase"
  on trase for select
  using (true);

create policy "Urednik in admin pišeta trase"
  on trase for insert
  with check (public.is_editor());

create policy "Urednik in admin posodabljata trase"
  on trase for update
  using (public.is_editor())
  with check (public.is_editor());

create policy "Urednik in admin brišeta trase"
  on trase for delete
  using (public.is_editor());

-- ---------------------------------------------------------------------------
-- poti — reserved in 0001 for trail editing, never read or written.
-- Superseded by etape + trase; dropped so there is one source for trails.
-- ---------------------------------------------------------------------------

drop table if exists poti;
drop type if exists pot_vrsta_tip;
