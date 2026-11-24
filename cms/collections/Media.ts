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

const jeProstaLicenca = (siblingData: unknown) =>
  (siblingData as { pravice?: unknown } | undefined)?.pravice === "prosta-licenca";

const URL_VIRA = /^https?:\/\/\S+$/;

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
    // A free licence is only honoured with a full attribution, so both the
    // licence and the source link are required for that option — without
    // them the rights are not "filled in" and the photo can't be saved.
    {
      name: "licenca",
      type: "text",
      label: "Licenca",
      admin: {
        description: "Npr. »CC BY 4.0«. Obvezno pri prosti licenci.",
      },
      validate: (value: string | null | undefined, { siblingData }: { siblingData: unknown }) =>
        !jeProstaLicenca(siblingData) ||
        (typeof value === "string" && value.trim().length > 0) ||
        "Pri prosti licenci vpiši, za katero licenco gre (npr. »CC BY 4.0«).",
    },
    {
      name: "vir_url",
      type: "text",
      label: "Povezava na vir",
      admin: {
        description: "Stran, s katere je fotografija prevzeta. Obvezno pri prosti licenci.",
      },
      validate: (value: string | null | undefined, { siblingData }: { siblingData: unknown }) => {
        const imaVrednost = typeof value === "string" && value.trim().length > 0;
        if (!imaVrednost) {
          return !jeProstaLicenca(siblingData) || "Pri prosti licenci vpiši povezavo na vir fotografije.";
        }
        return URL_VIRA.test(value.trim()) || "Vpiši celotno povezavo, ki se začne s https://.";
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
    {
      name: "dovoljenje_opomba",
      type: "text",
      label: "Dovoljenje (kdo in kdaj)",
      admin: { description: "Kdo je dovolil objavo in kdaj. Pri uvozu iz registra se izpolni samodejno." },
    },
    // Provenance of a photo imported from the register (cms/prenosRegistra.ts):
    // only the resized copy is stored, so these say where the full-resolution
    // original can always be fetched again.
    {
      type: "collapsible",
      label: "Izvirnik v registru",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "izvirnik_url",
          type: "text",
          label: "Izvirna datoteka",
          admin: { readOnly: true, description: "Povezava na izvirno (nepomanjšano) datoteko v registru." },
        },
        {
          type: "row",
          fields: [
            { name: "izvirnik_sirina", type: "number", label: "Širina izvirnika (px)", admin: { readOnly: true } },
            { name: "izvirnik_visina", type: "number", label: "Višina izvirnika (px)", admin: { readOnly: true } },
          ],
        },
      ],
    },
  ],
};
