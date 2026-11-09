import type { ReactNode } from "react";

interface NadnaslovProps {
  nadnaslov: string;
  naslov: ReactNode;
  uvod?: ReactNode;
  /** Smaller title and tighter spacing — for a page whose main element comes right after (the map). */
  kompaktno?: boolean;
}

/** Page heading block: small letter-spaced eyebrow, large serif title, optional lead. */
export default function Nadnaslov({ nadnaslov, naslov, uvod, kompaktno = false }: NadnaslovProps) {
  return (
    <div className={kompaktno ? "space-y-1" : "space-y-3"}>
      <p className="text-nadnaslov font-semibold text-crnilo-mehko uppercase">{nadnaslov}</p>
      <h1
        className={`font-heading font-semibold text-balance ${kompaktno ? "text-naslov-kompakten" : "text-naslov"}`}
      >
        {naslov}
      </h1>
      {uvod && (
        <p className={`max-w-besedilo text-crnilo-mehko ${kompaktno ? "text-base" : "text-podnaslov"}`}>{uvod}</p>
      )}
    </div>
  );
}
