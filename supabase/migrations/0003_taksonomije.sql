-- Pot ob žici — POPRAVKI_1 §1: taxonomies back to the client's exact lists.
--
-- Mirrors lib/types.ts (Vrsta, Zgodba), lib/vrsta.ts, lib/zgodbe.ts and the
-- importer's mapping tables (scripts/import-xlsx.ts).
--
-- vrsta: seven values -> the client's five. `kompleks` and `muzej` were
-- invented during import. Approved mapping (2026-11-06), keyed on the raw
-- Excel value so it matches the importer exactly:
--   Muzejska spominska točka -> spomenik   (NMZ-011)
--   Spomeniški kompleks      -> spomenik   (NMZ-010)
--   Spominski park           -> spomenik   (NMZ-041)
--   Spominski sklop          -> grobnica   (NMZ-033)
--
-- zgodbe_predlog: `kultura-spominjanja` was invented during import and is
-- removed. Points left without a fitting client theme stay untagged — no
-- replacement tag is guessed here. `osvoboditev` needs no DDL (text[]).

-- 1. Re-type the column as text so the old enum can be dropped.
alter table public.tocke alter column vrsta type text using vrsta::text;

update public.tocke
set vrsta = case when vrsta_raw = 'Spominski sklop' then 'grobnica' else 'spomenik' end
where vrsta in ('kompleks', 'muzej');

drop type vrsta_obelezja;
create type vrsta_obelezja as enum ('spomenik', 'plosca', 'grobnica', 'bunker', 'kraj-dogodka');

alter table public.tocke alter column vrsta type vrsta_obelezja using vrsta::vrsta_obelezja;

-- 2. Drop the invented story theme.
update public.tocke
set zgodbe_predlog = array_remove(zgodbe_predlog, 'kultura-spominjanja')
where 'kultura-spominjanja' = any (zgodbe_predlog);

-- 3. Stage 8's seed colour could not carry AA-contrast text when used as a
--    filled chip (best 4.21:1). Darkened — only if nobody recoloured it yet.
update public.etape set barva = '#836d26' where id = 'etapa-8' and barva = '#967c2c';
