/**
 * Checks the live stage colours (`getEtape()`: Supabase or the seed) for
 * the Phase 4.3 brief: distinguishable from each other under normal vision
 * and the common colour-vision deficiencies. The white marker icon's
 * contrast is printed for information only — the icon has its own dark
 * outline (lib/mapIcons.ts), so it is never a violation.
 *
 *   npm run barve:preizkus                 # the stage colours as configured
 *   npm run barve:preizkus -- #aabbcc …    # a candidate palette, in stage order
 *
 * Method and thresholds: lib/barvePreverba.ts (shared with the admin
 * colour picker). Stages that meet on the ring (n and n+1, last and first)
 * are reported separately — they share a joint and matter most.
 *
 * Reports only; exits 1 if a threshold is missed.
 */

import { getEtape } from "../lib/data";
import { sortEtape } from "../lib/etape";
import { IKONA, MEJA_SOSEDNJI, MEJA_VSI, REFERENCA_KONTRAST, VIDI, kontrast, razdaljaBarv, type Vid } from "../lib/barvePreverba";

async function main() {
  const podane = process.argv.slice(2).filter((a) => /^#[0-9a-f]{6}$/i.test(a));
  const etape = sortEtape(await getEtape());
  const vrstice = podane.length > 0 ? podane.map((barva, i) => ({ ime: `#${i + 1}`, barva })) : etape.map((e) => ({ ime: e.naziv, barva: e.barva }));
  const n = vrstice.length;
  let napake = 0;

  // Icon contrast is information only: the marker icon has its own dark outline (lib/mapIcons.ts).
  console.log(`Barve (kontrast bele ikone je informativen — ikona ima temno obrobo; referenca ${REFERENCA_KONTRAST}:1):`);
  for (const v of vrstice) {
    const k = kontrast(v.barva, IKONA);
    const opomba = k < REFERENCA_KONTRAST ? "  (pod referenco — berljivost zagotavlja obroba)" : "";
    console.log(`  · ${v.ime.padEnd(10)} ${v.barva}  kontrast z ikono ${k.toFixed(1)}:1${opomba}`);
  }

  for (const vid of Object.keys(VIDI) as Vid[]) {
    const pari: { a: number; b: number; d: number; sosednji: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pari.push({ a: i, b: j, d: razdaljaBarv(vrstice[i]!.barva, vrstice[j]!.barva, vid), sosednji: j === i + 1 || (i === 0 && j === n - 1 && n > 2) });
      }
    }
    pari.sort((x, y) => x.d - y.d);
    const slabi = pari.filter((p) => p.d < (p.sosednji ? MEJA_SOSEDNJI : MEJA_VSI));
    napake += slabi.length;
    const najblizji = pari[0];
    console.log(
      `\n${slabi.length === 0 ? "✓" : "✗"} ${vid}: najbližji par ${najblizji ? `${vrstice[najblizji.a]!.ime} ↔ ${vrstice[najblizji.b]!.ime} (ΔE ${najblizji.d.toFixed(1)})` : "—"}`,
    );
    for (const p of slabi) {
      console.log(`    ${vrstice[p.a]!.ime} ↔ ${vrstice[p.b]!.ime}: ΔE ${p.d.toFixed(1)}${p.sosednji ? " (sosednji na obroču)" : ""}`);
    }
  }

  console.log(
    napake === 0
      ? "\nVse meje izpolnjene."
      : `\n${napake} kršitev (meje: ΔE ≥ ${MEJA_VSI}, sosednji ≥ ${MEJA_SOSEDNJI}).`,
  );
  process.exit(napake === 0 ? 0 : 1);
}

void main();
