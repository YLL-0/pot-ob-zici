import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."tocke" ADD COLUMN "napis" varchar;
  ALTER TABLE "payload"."tocke" ADD COLUMN "napis_iz_registra" boolean DEFAULT true;
  ALTER TABLE "payload"."_tocke_v" ADD COLUMN "version_napis" varchar;
  ALTER TABLE "payload"."_tocke_v" ADD COLUMN "version_napis_iz_registra" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."tocke" DROP COLUMN "napis";
  ALTER TABLE "payload"."tocke" DROP COLUMN "napis_iz_registra";
  ALTER TABLE "payload"."_tocke_v" DROP COLUMN "version_napis";
  ALTER TABLE "payload"."_tocke_v" DROP COLUMN "version_napis_iz_registra";`)
}
