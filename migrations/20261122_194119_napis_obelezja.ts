import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."tocke" ADD COLUMN "napis" varchar;
  ALTER TABLE "payload"."_tocke_v" ADD COLUMN "version_napis" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."tocke" DROP COLUMN "napis";
  ALTER TABLE "payload"."_tocke_v" DROP COLUMN "version_napis";`)
}
