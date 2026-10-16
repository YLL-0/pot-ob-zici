import { ImageResponse } from "next/og";
import { getEtape, getPoint } from "@/lib/data";
import { getEtapaBarva } from "@/lib/etape";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [tocka, etape] = await Promise.all([getPoint(slug), getEtape()]);
  const barva = tocka ? getEtapaBarva(etape, tocka.etapa) : "#96582c";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#14171a",
          padding: 72,
        }}
      >
        <div style={{ width: 72, height: 10, background: barva, marginBottom: 28, display: "flex" }} />
        <div style={{ fontSize: 58, color: "#faf8f4", fontWeight: 700, lineHeight: 1.15, display: "flex" }}>
          {tocka?.naziv ?? "Pot ob žici"}
        </div>
        <div style={{ fontSize: 30, color: "#e6e1d6", marginTop: 20, display: "flex" }}>
          {tocka ? `${tocka.obmocje} · Pot ob žici` : "Novo mesto"}
        </div>
      </div>
    ),
    size,
  );
}
