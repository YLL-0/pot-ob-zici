import Link from "next/link";
import VecjaPisava from "@/components/VecjaPisava";

/** Slim site bar shared by every page: name (home link), "O projektu", "Večja pisava". */
export default function SiteHeader() {
  return (
    <header className="border-b border-crta bg-papir">
      {/* min-h = --visina-glave: fixed header height token. */}
      <div className="mx-auto flex min-h-(--visina-glave) max-w-stolpec items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          Pot ob žici
        </Link>
        <nav aria-label="Glavna navigacija" className="flex items-center gap-2 sm:gap-4">
          <Link href="/o-projektu" className="text-sm font-medium underline-offset-4 hover:underline">
            O projektu
          </Link>
          <VecjaPisava />
        </nav>
      </div>
    </header>
  );
}
