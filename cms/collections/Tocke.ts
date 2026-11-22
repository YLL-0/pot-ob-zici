import type { CollectionBeforeValidateHook, CollectionConfig } from "payload";
import { ValidationError } from "payload";
import { objavljenoAliPrijavljen, samoPrijavljeni } from "@/cms/access";
import {
  DOVOLJENJE_QR_MOZNOSTI,
  ESD_STATUS_MOZNOSTI,
  GPS_ZANESLJIVOST_MOZNOSTI,
  STATUS_IZVEDBE_MOZNOSTI,
  STROKOVNA_VERIFIKACIJA_MOZNOSTI,
  VKLJUCITEV_MOZNOSTI,
  VRSTA_MOZNOSTI,
  VSEBINSKI_STATUS_MOZNOSTI,
  ZGODBA_MOZNOSTI,
} from "@/cms/moznosti";
import { slugify } from "@/lib/slug";
import { osveziPoIzbrisuTocke, osveziPoSpremembiTocke } from "@/cms/revalidacija";

const ID_TOCKE = /^NMZ-\d{3}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function mediaId(ref: unknown): number | string | null {
  if (typeof ref === "number" || typeof ref === "string") return ref;
  if (ref && typeof ref === "object" && "id" in ref) return (ref as { id: number | string }).id;
  return null;
}

/**
 * A published point may not carry a photo with unknown rights
 * (PROMPT_ADMIN.md: the rule most likely to be quietly dropped — keep it).
 * Drafts may, so an editor can upload first and sort out rights later.
 */
const zavrniNeznanePravice: CollectionBeforeValidateHook = async ({ data, originalDoc, req, collection }) => {
  if (data?._status !== "published") return data;
  const fotografije = (data.fotografije ?? originalDoc?.fotografije ?? []) as unknown[];
  const ids = fotografije.map(mediaId).filter((id): id is number | string => id !== null);
  if (ids.length === 0) return data;

  const { docs } = await req.payload.find({
    collection: "media",
    where: { id: { in: ids }, pravice: { equals: "neznano" } },
    depth: 0,
    limit: 0,
    pagination: false,
    req,
  });
  if (docs.length > 0) {
    const imena = docs.map((m) => `»${m.podnapis || m.filename}«`).join(", ");
    throw new ValidationError(
      {
        collection: collection.slug,
        errors: [
          {
            path: "fotografije",
            message:
              `Obeležja ni mogoče objaviti: fotografija ${imena} ima pravice uporabe »Neznano«. ` +
              "Uredi pravice fotografije ali jo odstrani z obeležja.",
          },
        ],
      },
      req.t,
    );
  }
  return data;
};

/**
 * Memorials. Field names mirror lib/types.ts `Tocka` so lib/data.ts maps a
 * document onto the public type without renames. Derived fields are not
 * stored: `qr_url` (lib/qr.ts) and `odsek` (from the stage). `status`
 * becomes Payload's `_status`; `foto` becomes the `fotografije` upload
 * relation; `updated_at` is Payload's `updatedAt`.
 */
export const Tocke: CollectionConfig = {
  slug: "tocke",
  labels: { singular: "Obeležje", plural: "Obeležja" },
  admin: {
    useAsTitle: "naziv",
    defaultColumns: ["id", "naziv", "etapa", "zaporedje", "_status"],
    listSearchableFields: ["id", "naziv", "obmocje"],
    group: "Vsebina",
  },
  defaultSort: "id",
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
  access: {
    read: objavljenoAliPrijavljen,
    create: samoPrijavljeni,
    update: samoPrijavljeni,
    delete: samoPrijavljeni,
  },
  hooks: {
    beforeValidate: [zavrniNeznanePravice],
    afterChange: [osveziPoSpremembiTocke],
    afterDelete: [osveziPoIzbrisuTocke],
  },
  fields: [
    {
      name: "id",
      type: "text",
      label: "ID",
      required: true,
      admin: { description: "Trajni ID, npr. »NMZ-017«. Po ustvarjenju ga ni mogoče spremeniti." },
      access: { update: () => false },
      validate: (value: string | null | undefined) =>
        (typeof value === "string" && ID_TOCKE.test(value)) || "ID mora biti v obliki NMZ-000.",
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "Osnovno",
          fields: [
            { name: "naziv", type: "text", label: "Naziv", required: true },
            {
              name: "slug",
              type: "text",
              label: "Slug (del naslova strani)",
              required: true,
              unique: true,
              index: true,
              admin: {
                description:
                  "Samodejno iz naziva ob ustvarjenju. Pozneje se ne spreminja sam, ker bi to pokvarilo obstoječe povezave.",
              },
              hooks: {
                beforeValidate: [
                  ({ value, data, operation }) =>
                    operation === "create" && !value && typeof data?.naziv === "string" ? slugify(data.naziv) : value,
                ],
              },
              validate: (value: string | null | undefined) =>
                (typeof value === "string" && SLUG.test(value)) ||
                "Slug sme vsebovati samo male črke brez šumnikov, številke in vezaje.",
            },
            { name: "obmocje", type: "text", label: "Območje", required: true },
            { name: "vrsta", type: "select", label: "Vrsta", required: true, options: VRSTA_MOZNOSTI },
            {
              name: "vrsta_raw",
              type: "text",
              label: "Vrsta (izvirni zapis iz Excela)",
              admin: { readOnly: true },
            },
            { name: "esd", type: "text", label: "EŠD" },
            {
              name: "esd_status",
              type: "select",
              label: "Status EŠD",
              required: true,
              defaultValue: "za-preverjanje",
              options: ESD_STATUS_MOZNOSTI,
            },
            { name: "iztocnica", type: "textarea", label: "Iztočnica", required: true },
            {
              name: "kljucna_tema",
              type: "text",
              label: "Ključna tema (izvirni zapis iz Excela)",
              admin: { readOnly: true },
            },
            {
              name: "vkljucitev",
              type: "select",
              label: "Vključitev v pot",
              required: true,
              options: VKLJUCITEV_MOZNOSTI,
            },
          ],
        },
        {
          label: "Lokacija",
          description: "Koordinate so približne, dokler niso terensko izmerjene.",
          fields: [
            // Edited only through the map pin / paste field below — never
            // as two separate number inputs (PROMPT_ADMIN.md).
            {
              name: "lokacija",
              type: "ui",
              label: "Lokacija na zemljevidu",
              admin: { components: { Field: "/cms/components/LokacijaPolje#LokacijaPolje" } },
            },
            {
              name: "lat",
              type: "number",
              label: "Zemljepisna širina",
              required: true,
              min: 45.4,
              max: 46.9,
              admin: { hidden: true },
            },
            {
              name: "lon",
              type: "number",
              label: "Zemljepisna dolžina",
              required: true,
              min: 13.3,
              max: 16.6,
              admin: { hidden: true },
            },
            {
              name: "gps_zanesljivost",
              type: "select",
              label: "Zanesljivost GPS",
              required: true,
              defaultValue: "priblizek",
              options: GPS_ZANESLJIVOST_MOZNOSTI,
            },
            { name: "gps_vir", type: "text", label: "Vir koordinat", admin: { readOnly: true } },
            { name: "gps_vir_id", type: "number", label: "ID zapisa v viru", admin: { readOnly: true } },
            { name: "gps_vir_url", type: "text", label: "Povezava na zapis v viru", admin: { readOnly: true } },
            { name: "gps_opomba", type: "textarea", label: "Opomba za terensko preverjanje" },
          ],
        },
        {
          label: "Etapa",
          fields: [
            { name: "etapa", type: "relationship", relationTo: "etape", label: "Etapa" },
            {
              name: "zaporedje",
              type: "number",
              label: "Zaporedje v etapi",
              min: 1,
              admin: { description: "Vrstni red obeležja na poti etape (1 = prvo)." },
            },
            {
              name: "trasa_stanje",
              type: "ui",
              label: "Trasa etape",
              admin: { components: { Field: "/cms/components/TrasaTocke#TrasaTocke" } },
            },
          ],
        },
        {
          label: "Vsebina",
          fields: [
            { name: "besedilo_kratko", type: "textarea", label: "Kratko besedilo" },
            { name: "besedilo_poglobljeno", type: "richText", label: "Poglobljeno besedilo" },
            {
              name: "napis",
              type: "textarea",
              label: "Napis na obeležju",
              admin: {
                rows: 8,
                description:
                  "Dobesedni prepis napisa, vrstice ločene z novo vrstico. Prepis je prevzet iz registra " +
                  "partizanstvo.si (glej »Gradivo iz registra« spodaj) — pred objavo ga preveri na terenu. " +
                  "Na javni strani se izpiše kot citat z navedbo registra.",
              },
            },
            {
              name: "zgodbe_predlog",
              type: "select",
              label: "Zgodbe",
              hasMany: true,
              options: ZGODBA_MOZNOSTI,
              validate: (value: unknown) =>
                !Array.isArray(value) || value.length <= 3 || "Obeležje ima lahko največ tri zgodbe.",
            },
            {
              name: "viri",
              type: "array",
              label: "Viri",
              labels: { singular: "Vir", plural: "Viri" },
              fields: [
                {
                  name: "url",
                  type: "text",
                  label: "Povezava",
                  required: true,
                  validate: (value: string | null | undefined) =>
                    (typeof value === "string" && /^https?:\/\/\S+$/.test(value)) ||
                    "Vpiši celotno povezavo, ki se začne s https://.",
                },
              ],
            },
            // Read-only reference material from partizanstvo.si; stores nothing.
            {
              name: "gradivo_registra",
              type: "ui",
              label: "Gradivo iz registra",
              admin: { components: { Field: "/cms/components/GradivoRegistra#GradivoRegistra" } },
            },
          ],
        },
        {
          label: "Fotografije",
          fields: [
            {
              name: "fotografije",
              type: "upload",
              relationTo: "media",
              hasMany: true,
              label: "Fotografije",
              admin: { description: "Prva fotografija je naslovna." },
            },
          ],
        },
        {
          label: "Delo",
          fields: [
            {
              name: "v_pregledu",
              type: "checkbox",
              label: "Za pregled",
              defaultValue: false,
              admin: { description: "Oznaka za uredniški pregled. Ne vpliva na objavo." },
            },
            {
              name: "status_izvedbe",
              type: "select",
              label: "Status izvedbe",
              required: true,
              defaultValue: "predlog-preveriti",
              options: STATUS_IZVEDBE_MOZNOSTI,
            },
            { name: "odgovorna_oseba", type: "text", label: "Odgovorna oseba" },
            {
              name: "rok",
              type: "date",
              label: "Rok",
              admin: { date: { pickerAppearance: "dayOnly", displayFormat: "d. M. yyyy" } },
            },
            { name: "napredek", type: "number", label: "Napredek (%)", min: 0, max: 100 },
            { name: "opombe", type: "textarea", label: "Opombe" },
            {
              name: "foto_pravice_status",
              type: "select",
              label: "Pravice fotografij (stanje)",
              required: true,
              defaultValue: "ni-zaceto",
              options: VSEBINSKI_STATUS_MOZNOSTI,
            },
            {
              type: "row",
              fields: [
                { name: "qr_generiran", type: "checkbox", label: "QR koda izdelana", defaultValue: false },
                {
                  name: "qr_tablica_namescena",
                  type: "checkbox",
                  label: "QR tablica nameščena",
                  defaultValue: false,
                },
              ],
            },
            {
              name: "dovoljenje_qr",
              type: "select",
              label: "Dovoljenje za QR tablico",
              required: true,
              defaultValue: "za-preverjanje",
              options: DOVOLJENJE_QR_MOZNOSTI,
            },
            {
              name: "strokovna_verifikacija",
              type: "select",
              label: "Strokovna verifikacija",
              required: true,
              defaultValue: "za-preverjanje",
              options: STROKOVNA_VERIFIKACIJA_MOZNOSTI,
            },
            // Quiz builder is not in this phase; kept so no data is lost.
            { name: "kviz", type: "json", label: "Kviz", admin: { hidden: true } },
          ],
        },
      ],
    },
  ],
};
