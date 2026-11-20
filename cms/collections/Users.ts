import type { CollectionConfig } from "payload";
import { adminAliSam, samoAdmin, samoAdminPolje } from "@/cms/access";

/**
 * Editor accounts. Email login, no public registration: only an admin can
 * create accounts (Payload's one-time "create first user" screen is the
 * only exception, and only while the collection is empty).
 */
export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Uporabnik", plural: "Uporabniki" },
  auth: true,
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
