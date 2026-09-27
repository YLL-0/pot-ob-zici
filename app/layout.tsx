import type { Metadata } from "next";
import "./globals.css";
import { getBaseUrl } from "@/lib/qr";

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
    document.documentElement.setAttribute("data-vecja-pisava", "true");
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: VECJA_PISAVA_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
