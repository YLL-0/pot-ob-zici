import type { CollectionBeforeValidateHook, CollectionConfig } from "payload";
import { ValidationError } from "payload";
import { samoPrijavljeni } from "@/cms/access";
import { FOTO_TIP_MOZNOSTI, PRAVICE_MOZNOSTI } from "@/cms/moznosti";
import { osveziPoSpremembiFotografije } from "@/cms/revalidacija";

/**
 * The other side of the Tocke rule: a photo already on a published point
 * can't have its rights changed to »Neznano« — otherwise the rule could
 * be bypassed by editing the photo instead of the point.
 */
const zavrniNeznanePraviceNaObjavljenem: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  req,
  collection,
}) => {
  if (operation !== "update" || data?.pravice !== "neznano" || originalDoc?.pravice === "neznano") return data;
  const { docs } = await req.payload.find({
    collection: "tocke",
    where: { fotografije: { contains: originalDoc.id }, _status: { equals: "published" } },
    draft: false,
    depth: 0,
    limit: 0,
    pagination: false,
    req,
  });
  if (docs.length > 0) {
    throw new ValidationError(
      {
        collection: collection.slug,
        errors: [
          {
            path: "pravice",
            message:
              "Pravic ni mogoče nastaviti na »Neznano«, ker je fotografija na objavljenih obeležjih: " +
              docs.map((t) => `${t.id} ${t.naziv}`).join(", ") +
              ". Najprej jo odstrani z njih.",
          },
        ],
      },
      req.t,
    );
  }
  return data;
};

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
  hooks: {
    beforeValidate: [zavrniNeznanePraviceNaObjavljenem],
    afterChange: [osveziPoSpremembiFotografije],
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
