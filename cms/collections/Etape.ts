import type { CollectionConfig } from "payload";
import { APIError } from "payload";
import { jePrijavljen, samoAdmin } from "@/cms/access";

const HEX = /^#[0-9a-f]{6}$/i;
const ID_ETAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Stages. `id` is the stable slug (`etapa-3`) referenced by tocke.etapa,
 * URLs, data/poti/<id>.geojson and the trase cache keys — read-only once
 * created (CLAUDE.md: never regenerate). Only admins manage stages.
 */
export const Etape: CollectionConfig = {
  slug: "etape",
  labels: { singular: "Etapa", plural: "Etape" },
  admin: {
    useAsTitle: "naziv",
    defaultColumns: ["stevilka", "naziv", "odsek", "barva", "vidna"],
    group: "Vsebina",
  },
  defaultSort: "stevilka",
  access: {
    // Public: visible stages only. Logged-in editors see all of them.
    read: ({ req }) => (jePrijavljen(req) ? true : { vidna: { equals: true } }),
    create: samoAdmin,
    update: samoAdmin,
    delete: samoAdmin,
  },
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        // Include drafts: a draft point still belongs to the stage.
        const { docs } = await req.payload.find({
          collection: "tocke",
          where: { etapa: { equals: id } },
          draft: true,
          limit: 0,
          depth: 0,
          pagination: false,
          req,
        });
        if (docs.length > 0) {
          const seznam = docs.map((t) => `${t.id} ${t.naziv}`).join(", ");
          throw new APIError(
            `Etape ni mogoče izbrisati, ker ima še ${docs.length} obeležij: ${seznam}. ` +
              "Najprej jih premakni v drugo etapo ali jim odstrani etapo.",
            400,
            undefined,
            true,
          );
        }
      },
    ],
  },
  fields: [
    {
      name: "id",
      type: "text",
      label: "ID",
      required: true,
      admin: {
        description: "Trajni ID, npr. »etapa-3«. Po ustvarjenju ga ni mogoče spremeniti.",
      },
      access: { update: () => false },
      validate: (value: string | null | undefined) =>
        (typeof value === "string" && ID_ETAPE.test(value)) ||
        "ID sme vsebovati samo male črke brez šumnikov, številke in vezaje (npr. »etapa-9«).",
    },
    {
      name: "stevilka",
      type: "number",
      label: "Številka (vrstni red)",
      required: true,
      unique: true,
      min: 1,
    },
    { name: "naziv", type: "text", label: "Naziv", required: true },
    { name: "odsek", type: "text", label: "Odsek", admin: { description: "Npr. »Šmihel – Drska«." } },
    {
      name: "barva",
      type: "text",
      label: "Barva",
      required: true,
      admin: { description: "Barva oznak, črte in vrstice etape, v obliki #rrggbb." },
      validate: (value: string | null | undefined) =>
        (typeof value === "string" && HEX.test(value)) || "Barva mora biti v obliki #rrggbb, npr. #2c7c96.",
    },
    { name: "opis", type: "textarea", label: "Opis" },
    { name: "vidna", type: "checkbox", label: "Vidna na javni strani", defaultValue: true },
  ],
};
