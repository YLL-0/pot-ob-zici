import type { Metadata } from "next";
import config from "@payload-config";
import { generatePageMetadata, RootPage } from "@payloadcms/next/views";
import { isCmsConfigured } from "@/lib/cms";
import { importMap } from "../importMap.js";

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  isCmsConfigured()
    ? generatePageMetadata({ config, params, searchParams })
    : Promise.resolve({ title: "Urejanje ni na voljo — Pot ob žici" });

// The layout shows the "Urejanje ni na voljo" notice when the CMS is not configured.
export default function Page({ params, searchParams }: Args) {
  if (!isCmsConfigured()) return null;
  return RootPage({ config, params, searchParams, importMap });
}
