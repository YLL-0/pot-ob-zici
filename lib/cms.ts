/**
 * Whether the Payload CMS (admin + Postgres content) is configured in this
 * environment. Without it the public site runs entirely from
 * tocke.seed.json and the admin says it is unavailable (CLAUDE.md rule 2:
 * the app must run with no .env).
 *
 * Kept free of any Payload import so the no-.env path never loads Payload.
 */
export function isCmsConfigured(): boolean {
  return Boolean(process.env.DATABASE_URI && process.env.PAYLOAD_SECRET);
}

/** Supabase Storage via its S3-compatible endpoint, for uploaded photos. */
export function isMediaStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

/** Resend for admin email (password reset, invitations) — cms/email.ts. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
