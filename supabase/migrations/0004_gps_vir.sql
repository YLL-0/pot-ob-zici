-- Pot ob žici — POPRAVKI_2 §1: coordinates from the partizanstvo.si register.
--
-- Mirrors lib/types.ts (GpsZanesljivost, Tocka.gps_vir*, gps_opomba),
-- scripts/apply-koordinate.ts and scripts/import-xlsx.ts.
--
-- zunanji_vir = position taken from a public register, matched by ID, not
-- yet checked in the field. Sits between the Excel approximation
-- ('priblizek') and surveyed positions. The importer never overwrites the
-- coordinates of a 'zunanji_vir', 'terensko-izmerjeno' or
-- 'preverjeno-v-gis' point with the Excel's values.

alter type gps_zanesljivost_tip add value if not exists 'zunanji_vir' before 'terensko-izmerjeno';

alter table public.tocke
  add column if not exists gps_vir text,
  add column if not exists gps_vir_id integer,
  add column if not exists gps_vir_url text,
  -- Non-null = position or register match must be verified on site before
  -- the point is treated as confirmed (shown in the admin).
  add column if not exists gps_opomba text;
