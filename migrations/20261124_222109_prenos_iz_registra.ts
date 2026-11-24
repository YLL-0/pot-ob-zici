import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."tocke" ADD COLUMN "dostop" varchar;
  ALTER TABLE "payload"."_tocke_v" ADD COLUMN "version_dostop" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "dovoljenje_opomba" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "izvirnik_url" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "izvirnik_sirina" numeric;
  ALTER TABLE "payload"."media" ADD COLUMN "izvirnik_visina" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."tocke" DROP COLUMN "dostop";
  ALTER TABLE "payload"."_tocke_v" DROP COLUMN "version_dostop";
  ALTER TABLE "payload"."media" DROP COLUMN "dovoljenje_opomba";
  ALTER TABLE "payload"."media" DROP COLUMN "izvirnik_url";
  ALTER TABLE "payload"."media" DROP COLUMN "izvirnik_sirina";
  ALTER TABLE "payload"."media" DROP COLUMN "izvirnik_visina";`)
}
