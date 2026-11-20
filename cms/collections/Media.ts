import type { CollectionConfig } from "payload";
import { samoPrijavljeni } from "@/cms/access";
import { FOTO_TIP_MOZNOSTI, PRAVICE_MOZNOSTI } from "@/cms/moznosti";

function obvezno(sporocilo: string) {
  return (value: unknown) => (typeof value === "string" && value.trim().length > 0) || sporocilo;
}

/**
 * Photos. Caption, author/source and rights are required by validation on
 * every file — a public heritage site cannot carry images of unknown
 * origin. A photo with `pravice: neznano` may be uploaded but never
 * attached to a published point (enforced in Tocke beforeValidate).
 *
 * Sizes are the two the site renders: a card thumbnail and a wide hero.
 */
export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Fotografija", plural: "Fotografije" },
  admin: {
    useAsTitle: "podnapis",
    defaultColumns: ["filename", "podnapis", "avtor_vir", "pravice"],
    group: "Vsebina",
  },
  access: {
    read: () => true,
    create: samoPrijavljeni,
    update: samoPrijavljeni,
    delete: samoPrijavljeni,
  },
  upload: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    imageSizes: [
      { name: "kartica", width: 640, formatOptions: { format: "webp", options: { quality: 80 } } },
      { name: "naslovna", width: 1600, formatOptions: { format: "webp", options: { quality: 82 } } },
    ],
    adminThumbnail: "kartica",
  },
  fields: [
    {
      name: "podnapis",
      type: "text",
      label: "Podnapis",
      required: true,
      validate: obvezno("Vpiši podnapis fotografije."),
    },
    {
      name: "avtor_vir",
      type: "text",
      label: "Avtor / vir",
      required: true,
      validate: obvezno("Vpiši avtorja ali vir fotografije."),
    },
    {
      name: "pravice",
      type: "select",
      label: "Pravice uporabe",
      required: true,
      options: PRAVICE_MOZNOSTI,
      admin: {
        description: "Fotografije z neznanimi pravicami ni mogoče pripeti na objavljeno obeležje.",
      },
    },
    {
      name: "tip",
      type: "select",
      label: "Vrsta fotografije",
      required: true,
      defaultValue: "danes",
      options: FOTO_TIP_MOZNOSTI,
    },
  ],
};
