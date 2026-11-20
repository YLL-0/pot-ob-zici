/**
 * Retired. Before the Payload phase this pushed tocke.seed.json into
 * Supabase tables (public.tocke / public.etape) that no longer exist —
 * content now lives in Payload (schema `payload`).
 *
 * - Moving the seed into an empty database: `npm run migrate:payload`
 * - Regenerating the seed from the database: `npm run export:seed`
 */

console.error(
  "npm run seed ni več v uporabi: vsebina je v Payloadu.\n" +
    "  Prenos seeda v prazno bazo:   npm run migrate:payload -- --dry-run, nato brez --dry-run\n" +
    "  Seed iz baze (za commit):     npm run export:seed",
);
process.exit(1);
