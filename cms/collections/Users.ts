import type { CollectionAfterChangeHook, CollectionConfig } from "payload";
import { adminAliSam, samoAdmin, samoAdminPolje } from "@/cms/access";
import {
  VELJAVNOST_POVABILA_MS,
  ponastavitevGeslaHtml,
  ponastavitevGeslaZadeva,
  povabiloHtml,
  povabiloZadeva,
} from "@/cms/email";
import { isEmailConfigured } from "@/lib/cms";

/**
 * Invitation: when an admin creates an account, the new user gets an email
 * with a link to set their own password (valid 7 days) — the password the
 * admin typed on the create form never has to be passed on.
 *
 * Not for the one-time "create first user" screen (no one is logged in
 * then). Without email configured the account is still created and the
 * server logs that no invitation went out; if email IS configured and
 * sending fails, creation is rolled back with the reason, so an admin
 * never believes an invitation was sent when it wasn't.
 */
const posljiPovabilo: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== "create" || !req.user) return doc;
  if (!isEmailConfigured()) {
    req.payload.logger.warn(
      `Povabilo za ${doc.email} ni bilo poslano: e-pošta ni nastavljena (RESEND_API_KEY, EMAIL_FROM).`,
    );
    return doc;
  }
  const token = await req.payload.forgotPassword({
    collection: "users",
    data: { email: doc.email },
    disableEmail: true,
    expiration: VELJAVNOST_POVABILA_MS,
    req,
  });
  if (!token) throw new Error("Žetona za nastavitev gesla ni bilo mogoče ustvariti.");
  const povabil = (req.user as { ime?: string | null; email?: string }).ime || req.user.email || null;
  await req.payload.sendEmail({
    to: doc.email,
    subject: povabiloZadeva(),
    html: povabiloHtml({ req, token, user: doc, povabil }),
  });
  return doc;
};

/**
 * Editor accounts. Email login, no public registration: only an admin can
 * create accounts (Payload's one-time "create first user" screen is the
 * only exception, and only while the collection is empty). A new account
 * gets an invitation email; »Pozabljeno geslo« sends a Slovenian reset
 * email (cms/email.ts).
 */
export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Uporabnik", plural: "Uporabniki" },
  auth: {
    forgotPassword: {
      generateEmailSubject: ponastavitevGeslaZadeva,
      generateEmailHTML: (args) => ponastavitevGeslaHtml(args ?? {}),
    },
  },
  hooks: {
    afterChange: [posljiPovabilo],
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "ime", "vloga"],
    group: "Upravljanje",
  },
  access: {
    create: samoAdmin,
    delete: samoAdmin,
    read: adminAliSam,
    update: adminAliSam,
  },
  fields: [
    { name: "ime", type: "text", label: "Ime in priimek" },
    {
      name: "vloga",
      type: "select",
      label: "Vloga",
      required: true,
      defaultValue: "urednik",
      saveToJWT: true,
      options: [
        { label: "Urednik (ureja vsebino)", value: "urednik" },
        { label: "Skrbnik (ureja še uporabnike in etape)", value: "admin" },
      ],
      // A user can never promote themselves.
      access: { create: samoAdminPolje, update: samoAdminPolje },
    },
  ],
};
