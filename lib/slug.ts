/**
 * Slug transliteration for Slovenian diacritics.
 *
 * Slugs are stable IDs (CLAUDE.md rule: never regenerate them for existing
 * points). This function is used by scripts/import-xlsx.ts when a NEW point
 * is added and needs a first slug — it must never be re-run against an
 * existing point's `naziv` to "fix" its slug, even if the naziv changes.
 */

const DIACRITICS: Record<string, string> = {
  č: "c",
  š: "s",
  ž: "z",
  Č: "C",
  Š: "S",
  Ž: "Z",
};

export function slugify(naziv: string): string {
  const transliterated = naziv.replace(/[čšžČŠŽ]/g, (ch) => DIACRITICS[ch] ?? ch);
  return transliterated
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip any remaining combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
