/* Payload admin root layout (app/(payload) is Payload's own route group). */
import config from "@payload-config";
import "@payloadcms/next/css";
import type { ServerFunctionClient } from "payload";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import type React from "react";
import Link from "next/link";
import { isCmsConfigured } from "@/lib/cms";
import { importMap } from "./admin/importMap.js";

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

/**
 * Without DATABASE_URI + PAYLOAD_SECRET (e.g. a fresh clone with no .env)
 * the admin never touches Payload's database code and says so plainly —
 * the public site keeps running from tocke.seed.json.
 */
function UrejanjeNiNaVoljo() {
  return (
    <html lang="sl">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "3rem 1rem" }}>
        <main style={{ maxWidth: "36rem", margin: "0 auto", lineHeight: 1.6 }}>
          <h1 style={{ fontSize: "1.5rem" }}>Urejanje ni na voljo</h1>
          <p>
            Baza ni nastavljena, zato urejanje vsebin v tem okolju ni mogoče. Javna stran deluje naprej iz
            shranjene kopije podatkov (tocke.seed.json).
          </p>
          <p>
            Za urejanje morata biti v okolju nastavljena <code>DATABASE_URI</code> in <code>PAYLOAD_SECRET</code>.
          </p>
          <p>
            <Link href="/">Na javno stran</Link>
          </p>
        </main>
      </body>
    </html>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  if (!isCmsConfigured()) return <UrejanjeNiNaVoljo />;
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
