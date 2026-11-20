/**
 * Payload CMS config. Only loaded when lib/cms.ts isCmsConfigured() is
 * true (DATABASE_URI + PAYLOAD_SECRET) — with no .env the public site never
 * imports Payload and the admin route says editing is unavailable.
 *
 * Database: Supabase Postgres, Payload's tables live in their own schema
 * `payload` so they never collide with `public.trase` (computed route
 * cache, kept outside Payload). Schema changes go through committed
 * migrations (migrations/), never dev "push", so nothing touches the
 * database implicitly on startup.
 *
 * Photos: Supabase Storage through its S3-compatible API (same project and
 * account as the database, EU region, public bucket).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { sl } from "@payloadcms/translations/languages/sl";
import sharp from "sharp";
import { Etape } from "@/cms/collections/Etape";
import { Media } from "@/cms/collections/Media";
import { Tocke } from "@/cms/collections/Tocke";
import { Users } from "@/cms/collections/Users";
import { isMediaStorageConfigured } from "@/lib/cms";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || undefined,
  secret: process.env.PAYLOAD_SECRET || "",
  telemetry: false,
  admin: {
    user: Users.slug,
    importMap: { baseDir: dirname },
    meta: { titleSuffix: " — Pot ob žici (urejanje)" },
  },
  i18n: {
    supportedLanguages: { sl },
    fallbackLanguage: "sl",
  },
  collections: [Tocke, Etape, Media, Users],
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI || "" },
    schemaName: "payload",
    push: false,
    migrationDir: path.resolve(dirname, "migrations"),
  }),
  graphQL: { disable: true },
  sharp,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  plugins: isMediaStorageConfigured()
    ? [
        s3Storage({
          collections: { media: true },
          bucket: process.env.S3_BUCKET!,
          config: {
            endpoint: process.env.S3_ENDPOINT!,
            region: process.env.S3_REGION || "eu-central-1",
            forcePathStyle: true,
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID!,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
            },
          },
        }),
      ]
    : [],
});
