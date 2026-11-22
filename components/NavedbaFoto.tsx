import type { Foto } from "@/lib/types";

/** "https://www.partizanstvo.si/…" -> "partizanstvo.si"; falls back to the raw URL. */
function imeVira(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Photo credit in the form "Foto: avtor, vir, licenca" — each part left
 * out when it is missing, and nothing at all when all three are.
 * The source is a link to the page the photo was taken from.
 */
export function NavedbaFoto({ foto }: { foto: Pick<Foto, "avtor_vir" | "vir_url" | "licenca"> }) {
  const avtor = foto.avtor_vir?.trim() || null;
  const vir = foto.vir_url?.trim() || null;
  const licenca = foto.licenca?.trim() || null;

  const deli: React.ReactNode[] = [];
  if (avtor) deli.push(avtor);
  if (vir)
    deli.push(
      <a key="vir" href={vir} target="_blank" rel="noopener noreferrer" className="text-poudarek underline underline-offset-4">
        {imeVira(vir)}
      </a>,
    );
  if (licenca) deli.push(licenca);
  if (deli.length === 0) return null;

  return (
    <>
      Foto:{" "}
      {deli.map((del, i) => (
        <span key={i}>
          {i > 0 ? ", " : null}
          {del}
        </span>
      ))}
    </>
  );
}
