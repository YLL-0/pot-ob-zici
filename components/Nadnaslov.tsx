import type { ReactNode } from "react";

/** Page heading block: small letter-spaced eyebrow, large serif title, optional lead. */
export default function Nadnaslov({ nadnaslov, naslov, uvod }: { nadnaslov: string; naslov: ReactNode; uvod?: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-nadnaslov font-semibold text-crnilo-mehko uppercase">{nadnaslov}</p>
      <h1 className="font-heading text-naslov font-semibold text-balance">{naslov}</h1>
      {uvod && <p className="max-w-besedilo text-podnaslov text-crnilo-mehko">{uvod}</p>}
    </div>
  );
}
