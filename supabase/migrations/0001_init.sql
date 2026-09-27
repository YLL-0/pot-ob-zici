-- Pot ob žici — initial schema.
--
-- This mirrors lib/types.ts (Tocka, Pot). If you change a field in one,
-- change it in both, plus scripts/import-xlsx.ts and scripts/seed.ts
-- (CLAUDE.md rule: schema, importer and migration move together).
--
-- Applying this migration is entirely optional for local development —
-- lib/data.ts falls back to tocke.seed.json when NEXT_PUBLIC_SUPABASE_URL
-- is unset. It only matters once the client's Supabase project exists.

-- ---------------------------------------------------------------------------
-- profiles — Phase 4 admin roles. Table only for now; no admin UI yet.
-- ---------------------------------------------------------------------------

create type user_role as enum ('urednik', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'urednik',
  full_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Uporabnik vidi svoj profil"
  on profiles for select
  using (auth.uid() = id);

create policy "Admin vidi vse profile"
  on profiles for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- tocke — the 50 (and growing) memorial points.
-- ---------------------------------------------------------------------------

create type vrsta_obelezja as enum ('plosca', 'spomenik', 'grobnica', 'bunker', 'kompleks', 'muzej', 'kraj-dogodka');

create type vkljucitev_tip as enum (
  'Osnovna pot',
  'Osnovna pot / bližina',
  'Bližina poti',
  'Razširjeni zahodni krak',
  'Razširjeni vzhodni krak',
  'Razširjeni severni krak',
  'Razširjeni severovzhodni krak'
);

create type gps_zanesljivost_tip as enum ('priblizek', 'terensko-izmerjeno', 'preverjeno-v-gis');
create type esd_status_tip as enum ('za-preverjanje', 'vpisano', 'ni-esd', 'ni-relevantno');
create type vsebinski_status_tip as enum ('ni-zaceto', 'v-pripravi', 'za-preverjanje', 'koncano', 'ni-potrebno');
create type dovoljenje_qr_tip as enum ('za-preverjanje', 'pridobljeno', 'zavrnjeno', 'ni-potrebno');
create type strokovna_verifikacija_tip as enum ('za-preverjanje', 'v-pregledu', 'potrjeno', 'potrebni-popravki');
create type status_izvedbe_tip as enum (
  'predlog-preveriti',
  'potrjeno-za-vkljucitev',
  'terenski-popis',
  'v-pripravi-vsebin',
  'v-tehnicni-pripravi',
  'objavljeno',
  'izloceno-zamenjano'
);
create type publish_status_tip as enum ('osnutek', 'v_pregledu', 'objavljeno');

create table tocke (
  id text primary key check (id ~ '^NMZ-\d{3}$'),
  slug text not null unique,
  naziv text not null,
  obmocje text not null,
  vrsta_raw text not null,
  vrsta vrsta_obelezja not null,
  lat double precision not null,
  lon double precision not null,
  gps_zanesljivost gps_zanesljivost_tip not null default 'priblizek',
  esd text,
  esd_status esd_status_tip not null default 'za-preverjanje',
  etapa int not null check (etapa between 1 and 8),
  odsek text not null,
  vkljucitev vkljucitev_tip not null,
  iztocnica text not null,
  kljucna_tema text not null,
  zgodbe_predlog text[] not null default '{}',
  viri text[] not null default '{}',

  -- Content — empty until the association's historians write it.
  besedilo_kratko text,
  besedilo_poglobljeno text,
  foto jsonb not null default '[]', -- Foto[]: {url, opis, avtor_vir, pravice, tip}
  kviz jsonb not null default '[]', -- KvizVprasanje[]

  -- Publish gate (Phase 4). Public reads are RLS-restricted to 'objavljeno'.
  status publish_status_tip not null default 'osnutek',
  updated_at timestamptz,
  updated_by uuid references profiles (id),

  -- Client rollout tracking (mirrors the Excel project-management columns).
  foto_pravice_status vsebinski_status_tip not null default 'ni-zaceto',
  qr_generiran boolean not null default false,
  qr_tablica_namescena boolean not null default false,
  dovoljenje_qr dovoljenje_qr_tip not null default 'za-preverjanje',
  strokovna_verifikacija strokovna_verifikacija_tip not null default 'za-preverjanje',
  status_izvedbe status_izvedbe_tip not null default 'predlog-preveriti',
  odgovorna_oseba text,
  rok date,
  napredek int check (napredek between 0 and 100),
  opombe text
);

create index tocke_etapa_idx on tocke (etapa);
create index tocke_vkljucitev_idx on tocke (vkljucitev);
create index tocke_status_idx on tocke (status);

alter table tocke enable row level security;

create policy "Javnost bere samo objavljene točke"
  on tocke for select
  using (status = 'objavljeno');

create policy "Urednik in admin bereta vse točke"
  on tocke for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('urednik', 'admin')));

create policy "Urednik in admin urejata točke"
  on tocke for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('urednik', 'admin')));

-- ---------------------------------------------------------------------------
-- poti — trails. NOT read from here yet: lib/data.ts loads trails from
-- data/poti/*.geojson regardless of Supabase config until Phase 5 (trail
-- editing) exists. This table just reserves the shape for that migration.
-- ---------------------------------------------------------------------------

create type pot_vrsta_tip as enum ('etapa', 'zica');

create table poti (
  slug text primary key,
  naziv text not null,
  vrsta pot_vrsta_tip not null,
  etapa int check (etapa between 1 and 8),
  odsek text,
  barva text not null,
  status text, -- 'shematsko' | 'PLACEHOLDER — ni zgodovinsko potrjeno' | null once surveyed
  tocke_ids text[] not null default '{}',
  geometry jsonb not null, -- GeoJSON LineString
  updated_at timestamptz not null default now()
);

alter table poti enable row level security;

create policy "Javnost bere vse poti"
  on poti for select
  using (true);
