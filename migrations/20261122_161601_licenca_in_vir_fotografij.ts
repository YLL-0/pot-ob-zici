import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "payload"."enum_media_pravice" ADD VALUE 'prosta-licenca' BEFORE 'javna-domena';
  ALTER TABLE "payload"."media" ADD COLUMN "licenca" varchar;
  ALTER TABLE "payload"."media" ADD COLUMN "vir_url" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."media" ALTER COLUMN "pravice" SET DATA TYPE text;
  -- Without the licence columns a free-licence photo has no attribution,
  -- so it falls back to the strictest state (never shown publicly).
  UPDATE "payload"."media" SET "pravice" = 'neznano' WHERE "pravice" = 'prosta-licenca';
  DROP TYPE "payload"."enum_media_pravice";
  CREATE TYPE "payload"."enum_media_pravice" AS ENUM('lastno-delo', 'dovoljenje-pridobljeno', 'javna-domena', 'neznano');
  ALTER TABLE "payload"."media" ALTER COLUMN "pravice" SET DATA TYPE "payload"."enum_media_pravice" USING "pravice"::"payload"."enum_media_pravice";
  ALTER TABLE "payload"."media" DROP COLUMN "licenca";
  ALTER TABLE "payload"."media" DROP COLUMN "vir_url";`)
}
