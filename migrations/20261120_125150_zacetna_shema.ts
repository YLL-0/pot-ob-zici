import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Added by hand: Payload only creates its schema when it creates the
  // whole database, which never happens on Supabase.
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "payload";`)
  await db.execute(sql`
   CREATE TYPE "payload"."enum_tocke_zgodbe_predlog" AS ENUM('mesto-v-zici', 'odpor', 'zrtve', 'talci', 'zeleznicarji', 'partizanske-enote', 'otroci-in-mladi', 'zenske-v-odporu', 'bombardiranje', 'osvoboditev');
  CREATE TYPE "payload"."enum_tocke_vrsta" AS ENUM('spomenik', 'plosca', 'grobnica', 'bunker', 'kraj-dogodka');
  CREATE TYPE "payload"."enum_tocke_esd_status" AS ENUM('za-preverjanje', 'vpisano', 'ni-esd', 'ni-relevantno');
  CREATE TYPE "payload"."enum_tocke_vkljucitev" AS ENUM('Osnovna pot', 'Osnovna pot / bližina', 'Bližina poti', 'Razširjeni zahodni krak', 'Razširjeni vzhodni krak', 'Razširjeni severni krak', 'Razširjeni severovzhodni krak');
  CREATE TYPE "payload"."enum_tocke_gps_zanesljivost" AS ENUM('priblizek', 'zunanji_vir', 'terensko-izmerjeno', 'preverjeno-v-gis');
  CREATE TYPE "payload"."enum_tocke_status_izvedbe" AS ENUM('predlog-preveriti', 'potrjeno-za-vkljucitev', 'terenski-popis', 'v-pripravi-vsebin', 'v-tehnicni-pripravi', 'objavljeno', 'izloceno-zamenjano');
  CREATE TYPE "payload"."enum_tocke_foto_pravice_status" AS ENUM('ni-zaceto', 'v-pripravi', 'za-preverjanje', 'koncano', 'ni-potrebno');
  CREATE TYPE "payload"."enum_tocke_dovoljenje_qr" AS ENUM('za-preverjanje', 'pridobljeno', 'zavrnjeno', 'ni-potrebno');
  CREATE TYPE "payload"."enum_tocke_strokovna_verifikacija" AS ENUM('za-preverjanje', 'v-pregledu', 'potrjeno', 'potrebni-popravki');
  CREATE TYPE "payload"."enum_tocke_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__tocke_v_version_zgodbe_predlog" AS ENUM('mesto-v-zici', 'odpor', 'zrtve', 'talci', 'zeleznicarji', 'partizanske-enote', 'otroci-in-mladi', 'zenske-v-odporu', 'bombardiranje', 'osvoboditev');
  CREATE TYPE "payload"."enum__tocke_v_version_vrsta" AS ENUM('spomenik', 'plosca', 'grobnica', 'bunker', 'kraj-dogodka');
  CREATE TYPE "payload"."enum__tocke_v_version_esd_status" AS ENUM('za-preverjanje', 'vpisano', 'ni-esd', 'ni-relevantno');
  CREATE TYPE "payload"."enum__tocke_v_version_vkljucitev" AS ENUM('Osnovna pot', 'Osnovna pot / bližina', 'Bližina poti', 'Razširjeni zahodni krak', 'Razširjeni vzhodni krak', 'Razširjeni severni krak', 'Razširjeni severovzhodni krak');
  CREATE TYPE "payload"."enum__tocke_v_version_gps_zanesljivost" AS ENUM('priblizek', 'zunanji_vir', 'terensko-izmerjeno', 'preverjeno-v-gis');
  CREATE TYPE "payload"."enum__tocke_v_version_status_izvedbe" AS ENUM('predlog-preveriti', 'potrjeno-za-vkljucitev', 'terenski-popis', 'v-pripravi-vsebin', 'v-tehnicni-pripravi', 'objavljeno', 'izloceno-zamenjano');
  CREATE TYPE "payload"."enum__tocke_v_version_foto_pravice_status" AS ENUM('ni-zaceto', 'v-pripravi', 'za-preverjanje', 'koncano', 'ni-potrebno');
  CREATE TYPE "payload"."enum__tocke_v_version_dovoljenje_qr" AS ENUM('za-preverjanje', 'pridobljeno', 'zavrnjeno', 'ni-potrebno');
  CREATE TYPE "payload"."enum__tocke_v_version_strokovna_verifikacija" AS ENUM('za-preverjanje', 'v-pregledu', 'potrjeno', 'potrebni-popravki');
  CREATE TYPE "payload"."enum__tocke_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_media_pravice" AS ENUM('lastno-delo', 'dovoljenje-pridobljeno', 'javna-domena', 'neznano');
  CREATE TYPE "payload"."enum_media_tip" AS ENUM('danes', 'arhivska');
  CREATE TYPE "payload"."enum_users_vloga" AS ENUM('urednik', 'admin');
  CREATE TABLE "payload"."tocke_zgodbe_predlog" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "payload"."enum_tocke_zgodbe_predlog",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."tocke_viri" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar
  );
  
  CREATE TABLE "payload"."tocke" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"naziv" varchar,
  	"slug" varchar,
  	"obmocje" varchar,
  	"vrsta" "payload"."enum_tocke_vrsta",
  	"vrsta_raw" varchar,
  	"esd" varchar,
  	"esd_status" "payload"."enum_tocke_esd_status" DEFAULT 'za-preverjanje',
  	"iztocnica" varchar,
  	"kljucna_tema" varchar,
  	"vkljucitev" "payload"."enum_tocke_vkljucitev",
  	"lat" numeric,
  	"lon" numeric,
  	"gps_zanesljivost" "payload"."enum_tocke_gps_zanesljivost" DEFAULT 'priblizek',
  	"gps_vir" varchar,
  	"gps_vir_id" numeric,
  	"gps_vir_url" varchar,
  	"gps_opomba" varchar,
  	"etapa_id" varchar,
  	"zaporedje" numeric,
  	"besedilo_kratko" varchar,
  	"besedilo_poglobljeno" jsonb,
  	"v_pregledu" boolean DEFAULT false,
  	"status_izvedbe" "payload"."enum_tocke_status_izvedbe" DEFAULT 'predlog-preveriti',
  	"odgovorna_oseba" varchar,
  	"rok" timestamp(3) with time zone,
  	"napredek" numeric,
  	"opombe" varchar,
  	"foto_pravice_status" "payload"."enum_tocke_foto_pravice_status" DEFAULT 'ni-zaceto',
  	"qr_generiran" boolean DEFAULT false,
  	"qr_tablica_namescena" boolean DEFAULT false,
  	"dovoljenje_qr" "payload"."enum_tocke_dovoljenje_qr" DEFAULT 'za-preverjanje',
  	"strokovna_verifikacija" "payload"."enum_tocke_strokovna_verifikacija" DEFAULT 'za-preverjanje',
  	"kviz" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_tocke_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."tocke_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "payload"."_tocke_v_version_zgodbe_predlog" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum__tocke_v_version_zgodbe_predlog",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."_tocke_v_version_viri" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_tocke_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" varchar,
  	"version_naziv" varchar,
  	"version_slug" varchar,
  	"version_obmocje" varchar,
  	"version_vrsta" "payload"."enum__tocke_v_version_vrsta",
  	"version_vrsta_raw" varchar,
  	"version_esd" varchar,
  	"version_esd_status" "payload"."enum__tocke_v_version_esd_status" DEFAULT 'za-preverjanje',
  	"version_iztocnica" varchar,
  	"version_kljucna_tema" varchar,
  	"version_vkljucitev" "payload"."enum__tocke_v_version_vkljucitev",
  	"version_lat" numeric,
  	"version_lon" numeric,
  	"version_gps_zanesljivost" "payload"."enum__tocke_v_version_gps_zanesljivost" DEFAULT 'priblizek',
  	"version_gps_vir" varchar,
  	"version_gps_vir_id" numeric,
  	"version_gps_vir_url" varchar,
  	"version_gps_opomba" varchar,
  	"version_etapa_id" varchar,
  	"version_zaporedje" numeric,
  	"version_besedilo_kratko" varchar,
  	"version_besedilo_poglobljeno" jsonb,
  	"version_v_pregledu" boolean DEFAULT false,
  	"version_status_izvedbe" "payload"."enum__tocke_v_version_status_izvedbe" DEFAULT 'predlog-preveriti',
  	"version_odgovorna_oseba" varchar,
  	"version_rok" timestamp(3) with time zone,
  	"version_napredek" numeric,
  	"version_opombe" varchar,
  	"version_foto_pravice_status" "payload"."enum__tocke_v_version_foto_pravice_status" DEFAULT 'ni-zaceto',
  	"version_qr_generiran" boolean DEFAULT false,
  	"version_qr_tablica_namescena" boolean DEFAULT false,
  	"version_dovoljenje_qr" "payload"."enum__tocke_v_version_dovoljenje_qr" DEFAULT 'za-preverjanje',
  	"version_strokovna_verifikacija" "payload"."enum__tocke_v_version_strokovna_verifikacija" DEFAULT 'za-preverjanje',
  	"version_kviz" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__tocke_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."_tocke_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "payload"."etape" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"stevilka" numeric NOT NULL,
  	"naziv" varchar NOT NULL,
  	"odsek" varchar,
  	"barva" varchar NOT NULL,
  	"opis" varchar,
  	"vidna" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"podnapis" varchar NOT NULL,
  	"avtor_vir" varchar NOT NULL,
  	"pravice" "payload"."enum_media_pravice" NOT NULL,
  	"tip" "payload"."enum_media_tip" DEFAULT 'danes' NOT NULL,
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_kartica_url" varchar,
  	"sizes_kartica_width" numeric,
  	"sizes_kartica_height" numeric,
  	"sizes_kartica_mime_type" varchar,
  	"sizes_kartica_filesize" numeric,
  	"sizes_kartica_filename" varchar,
  	"sizes_naslovna_url" varchar,
  	"sizes_naslovna_width" numeric,
  	"sizes_naslovna_height" numeric,
  	"sizes_naslovna_mime_type" varchar,
  	"sizes_naslovna_filesize" numeric,
  	"sizes_naslovna_filename" varchar
  );
  
  CREATE TABLE "payload"."users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "payload"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ime" varchar,
  	"vloga" "payload"."enum_users_vloga" DEFAULT 'urednik' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tocke_id" varchar,
  	"etape_id" varchar,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."tocke_zgodbe_predlog" ADD CONSTRAINT "tocke_zgodbe_predlog_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."tocke"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."tocke_viri" ADD CONSTRAINT "tocke_viri_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."tocke"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."tocke" ADD CONSTRAINT "tocke_etapa_id_etape_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "payload"."etape"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."tocke_rels" ADD CONSTRAINT "tocke_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."tocke"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."tocke_rels" ADD CONSTRAINT "tocke_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_tocke_v_version_zgodbe_predlog" ADD CONSTRAINT "_tocke_v_version_zgodbe_predlog_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_tocke_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_tocke_v_version_viri" ADD CONSTRAINT "_tocke_v_version_viri_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_tocke_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_tocke_v" ADD CONSTRAINT "_tocke_v_parent_id_tocke_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."tocke"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_tocke_v" ADD CONSTRAINT "_tocke_v_version_etapa_id_etape_id_fk" FOREIGN KEY ("version_etapa_id") REFERENCES "payload"."etape"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_tocke_v_rels" ADD CONSTRAINT "_tocke_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_tocke_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_tocke_v_rels" ADD CONSTRAINT "_tocke_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tocke_fk" FOREIGN KEY ("tocke_id") REFERENCES "payload"."tocke"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_etape_fk" FOREIGN KEY ("etape_id") REFERENCES "payload"."etape"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tocke_zgodbe_predlog_order_idx" ON "payload"."tocke_zgodbe_predlog" USING btree ("order");
  CREATE INDEX "tocke_zgodbe_predlog_parent_idx" ON "payload"."tocke_zgodbe_predlog" USING btree ("parent_id");
  CREATE INDEX "tocke_viri_order_idx" ON "payload"."tocke_viri" USING btree ("_order");
  CREATE INDEX "tocke_viri_parent_id_idx" ON "payload"."tocke_viri" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tocke_slug_idx" ON "payload"."tocke" USING btree ("slug");
  CREATE INDEX "tocke_etapa_idx" ON "payload"."tocke" USING btree ("etapa_id");
  CREATE INDEX "tocke_updated_at_idx" ON "payload"."tocke" USING btree ("updated_at");
  CREATE INDEX "tocke_created_at_idx" ON "payload"."tocke" USING btree ("created_at");
  CREATE INDEX "tocke__status_idx" ON "payload"."tocke" USING btree ("_status");
  CREATE INDEX "tocke_rels_order_idx" ON "payload"."tocke_rels" USING btree ("order");
  CREATE INDEX "tocke_rels_parent_idx" ON "payload"."tocke_rels" USING btree ("parent_id");
  CREATE INDEX "tocke_rels_path_idx" ON "payload"."tocke_rels" USING btree ("path");
  CREATE INDEX "tocke_rels_media_id_idx" ON "payload"."tocke_rels" USING btree ("media_id");
  CREATE INDEX "_tocke_v_version_zgodbe_predlog_order_idx" ON "payload"."_tocke_v_version_zgodbe_predlog" USING btree ("order");
  CREATE INDEX "_tocke_v_version_zgodbe_predlog_parent_idx" ON "payload"."_tocke_v_version_zgodbe_predlog" USING btree ("parent_id");
  CREATE INDEX "_tocke_v_version_viri_order_idx" ON "payload"."_tocke_v_version_viri" USING btree ("_order");
  CREATE INDEX "_tocke_v_version_viri_parent_id_idx" ON "payload"."_tocke_v_version_viri" USING btree ("_parent_id");
  CREATE INDEX "_tocke_v_parent_idx" ON "payload"."_tocke_v" USING btree ("parent_id");
  CREATE INDEX "_tocke_v_version_version_slug_idx" ON "payload"."_tocke_v" USING btree ("version_slug");
  CREATE INDEX "_tocke_v_version_version_etapa_idx" ON "payload"."_tocke_v" USING btree ("version_etapa_id");
  CREATE INDEX "_tocke_v_version_version_updated_at_idx" ON "payload"."_tocke_v" USING btree ("version_updated_at");
  CREATE INDEX "_tocke_v_version_version_created_at_idx" ON "payload"."_tocke_v" USING btree ("version_created_at");
  CREATE INDEX "_tocke_v_version_version__status_idx" ON "payload"."_tocke_v" USING btree ("version__status");
  CREATE INDEX "_tocke_v_created_at_idx" ON "payload"."_tocke_v" USING btree ("created_at");
  CREATE INDEX "_tocke_v_updated_at_idx" ON "payload"."_tocke_v" USING btree ("updated_at");
  CREATE INDEX "_tocke_v_latest_idx" ON "payload"."_tocke_v" USING btree ("latest");
  CREATE INDEX "_tocke_v_rels_order_idx" ON "payload"."_tocke_v_rels" USING btree ("order");
  CREATE INDEX "_tocke_v_rels_parent_idx" ON "payload"."_tocke_v_rels" USING btree ("parent_id");
  CREATE INDEX "_tocke_v_rels_path_idx" ON "payload"."_tocke_v_rels" USING btree ("path");
  CREATE INDEX "_tocke_v_rels_media_id_idx" ON "payload"."_tocke_v_rels" USING btree ("media_id");
  CREATE UNIQUE INDEX "etape_stevilka_idx" ON "payload"."etape" USING btree ("stevilka");
  CREATE INDEX "etape_updated_at_idx" ON "payload"."etape" USING btree ("updated_at");
  CREATE INDEX "etape_created_at_idx" ON "payload"."etape" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_kartica_sizes_kartica_filename_idx" ON "payload"."media" USING btree ("sizes_kartica_filename");
  CREATE INDEX "media_sizes_naslovna_sizes_naslovna_filename_idx" ON "payload"."media" USING btree ("sizes_naslovna_filename");
  CREATE INDEX "users_sessions_order_idx" ON "payload"."users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "payload"."users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "payload"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "payload"."users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "payload"."users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_tocke_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("tocke_id");
  CREATE INDEX "payload_locked_documents_rels_etape_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("etape_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."tocke_zgodbe_predlog" CASCADE;
  DROP TABLE "payload"."tocke_viri" CASCADE;
  DROP TABLE "payload"."tocke" CASCADE;
  DROP TABLE "payload"."tocke_rels" CASCADE;
  DROP TABLE "payload"."_tocke_v_version_zgodbe_predlog" CASCADE;
  DROP TABLE "payload"."_tocke_v_version_viri" CASCADE;
  DROP TABLE "payload"."_tocke_v" CASCADE;
  DROP TABLE "payload"."_tocke_v_rels" CASCADE;
  DROP TABLE "payload"."etape" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."users_sessions" CASCADE;
  DROP TABLE "payload"."users" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TYPE "payload"."enum_tocke_zgodbe_predlog";
  DROP TYPE "payload"."enum_tocke_vrsta";
  DROP TYPE "payload"."enum_tocke_esd_status";
  DROP TYPE "payload"."enum_tocke_vkljucitev";
  DROP TYPE "payload"."enum_tocke_gps_zanesljivost";
  DROP TYPE "payload"."enum_tocke_status_izvedbe";
  DROP TYPE "payload"."enum_tocke_foto_pravice_status";
  DROP TYPE "payload"."enum_tocke_dovoljenje_qr";
  DROP TYPE "payload"."enum_tocke_strokovna_verifikacija";
  DROP TYPE "payload"."enum_tocke_status";
  DROP TYPE "payload"."enum__tocke_v_version_zgodbe_predlog";
  DROP TYPE "payload"."enum__tocke_v_version_vrsta";
  DROP TYPE "payload"."enum__tocke_v_version_esd_status";
  DROP TYPE "payload"."enum__tocke_v_version_vkljucitev";
  DROP TYPE "payload"."enum__tocke_v_version_gps_zanesljivost";
  DROP TYPE "payload"."enum__tocke_v_version_status_izvedbe";
  DROP TYPE "payload"."enum__tocke_v_version_foto_pravice_status";
  DROP TYPE "payload"."enum__tocke_v_version_dovoljenje_qr";
  DROP TYPE "payload"."enum__tocke_v_version_strokovna_verifikacija";
  DROP TYPE "payload"."enum__tocke_v_version_status";
  DROP TYPE "payload"."enum_media_pravice";
  DROP TYPE "payload"."enum_media_tip";
  DROP TYPE "payload"."enum_users_vloga";`)
}
