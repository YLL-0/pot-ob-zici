import type { Metadata } from "next";
import "./globals.css";
import { getBaseUrl } from "@/lib/qr";
import Noga from "@/components/Noga";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "Pot ob žici — Novo mesto",
    template: "%s — Pot ob žici",
  },
  description:
    "Spominska pot ob žici okoli Novega mesta — 50 obeležij druge svetovne vojne na 8 etapah.",
};

// Reads the "Večja pisava" preference before paint, so returning visitors
// never see a flash of default-size text. Kept inline (not in
// lib/progress.ts) because it must run in <head>, before React hydrates.
const VECJA_PISAVA_INIT_SCRIPT = `
try {
  if (window.localStorage.getItem("pot-ob-zici:vecja-pisava") === "1") {
    document.documentElement.setAttribute("data-vecja-pisava", "");
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The init script may add data-vecja-pisava before hydration — expected, not a mismatch.
    <html lang="sl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: VECJA_PISAVA_INIT_SCRIPT }} />
      </head>
      {/* Column so the footer sits at the bottom of short pages, below all content on long ones. */}
      <body className="flex min-h-dvh flex-col bg-papir">
        {children}
        <Noga />
      </body>
    </html>
  );
}
